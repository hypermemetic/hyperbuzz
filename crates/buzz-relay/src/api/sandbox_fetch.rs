//! `POST /sandbox-fetch` — SSRF-safe outbound GET proxy for sandboxed HTML embeds.
//!
//! A sandboxed embed cannot fetch external resources directly (CSP), so the
//! relay performs the GET on its behalf. The outbound request mirrors the
//! proven SSRF pattern from `buzz_workflow::executor`: resolve DNS off the
//! async runtime, reject private/loopback/link-local/reserved addresses via
//! `buzz_core::network::is_private_ip`, pin the validated IP into the reqwest
//! client with `.resolve()` (defeats DNS-rebinding TOCTOU), disable redirects,
//! and cap the streamed body.
//!
//! Auth is identical to the other bridge POST endpoints (`/events`, `/query`):
//! host-bound tenant, NIP-98 verification, admission rate limit, replay guard,
//! and relay-membership enforcement.

use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Json,
};
use base64::Engine;
use serde_json::Value;

use buzz_core::TenantContext;

use crate::state::AppState;

use super::{api_error, internal_error};
use super::bridge::{
    check_nip98_replay, enforce_http_admission, nip98_expected_url, verify_bridge_auth,
};

/// Outbound request timeout.
const FETCH_TIMEOUT_SECS: u64 = 5;

/// Maximum response body size (1 MiB). Bodies larger than this are truncated:
/// reading aborts at the cap and the capped prefix is returned.
const FETCH_MAX_RESPONSE_BYTES: usize = 1024 * 1024;

#[derive(serde::Deserialize)]
struct SandboxFetchRequest {
    url: String,
}

/// Resolve `host` to IP addresses and reject if any are private/reserved.
///
/// Uses the OS resolver (blocking, run on a threadpool via `spawn_blocking`).
/// Rejects the request if DNS resolution fails or returns zero addresses.
///
/// Returns the first validated IP address so the caller can pin DNS resolution
/// in the HTTP client, preventing DNS rebinding TOCTOU attacks.
async fn check_ssrf(host: &str, port: u16) -> Result<std::net::IpAddr, String> {
    let addr_str = format!("{host}:{port}");
    let addrs: Vec<std::net::IpAddr> = tokio::task::spawn_blocking(move || {
        use std::net::ToSocketAddrs;
        addr_str
            .to_socket_addrs()
            .map(|iter| iter.map(|sa| sa.ip()).collect::<Vec<_>>())
    })
    .await
    .map_err(|e| format!("SSRF check task failed: {e}"))?
    .map_err(|e| format!("DNS resolution failed: {e}"))?;

    if addrs.is_empty() {
        return Err("DNS resolution returned no addresses".into());
    }

    for ip in &addrs {
        if buzz_core::network::is_private_ip(ip) {
            return Err(format!(
                "SSRF blocked: '{host}' resolved to private/reserved address {ip}"
            ));
        }
    }

    Ok(addrs[0])
}

/// Handle `POST /sandbox-fetch` — authenticated, membership-gated outbound GET.
pub async fn sandbox_fetch(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Row zero: bind this HTTP request to its community from the request host
    // before anything else, identical to the other bridge endpoints. Unmapped
    // host fails closed with a generic 404 — never a default tenant.
    let raw_host = headers
        .get(axum::http::header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let tenant = crate::tenant::bind_community(&state.db, raw_host)
        .await
        .map_err(|_| {
            api_error(
                StatusCode::NOT_FOUND,
                "relay: no community is configured for this host",
            )
        })?;

    let url = nip98_expected_url(&state.config.relay_url, &tenant, "/sandbox-fetch");
    let (pubkey, event_id_bytes) = verify_bridge_auth(
        &headers,
        "POST",
        &url,
        Some(&body),
        state.config.require_auth_token,
    )?;
    let pubkey_hex = pubkey.to_hex();

    let result =
        sandbox_fetch_authed(&state, &tenant, &headers, &body, pubkey, event_id_bytes).await;
    match &result {
        Ok(_) => {
            tracing::info!(
                pubkey = %pubkey_hex,
                route = "/sandbox-fetch",
                status = 200u16,
                "HTTP bridge request"
            );
        }
        Err((status, _)) => {
            tracing::warn!(
                pubkey = %pubkey_hex,
                route = "/sandbox-fetch",
                status = status.as_u16(),
                "HTTP bridge request"
            );
        }
    }
    result
}

/// Post-auth execution for [`sandbox_fetch`]: admission, replay, membership,
/// request parse, SSRF-checked outbound GET.
async fn sandbox_fetch_authed(
    state: &Arc<AppState>,
    tenant: &TenantContext,
    headers: &HeaderMap,
    body: &[u8],
    pubkey: nostr::PublicKey,
    event_id_bytes: [u8; 32],
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    enforce_http_admission(state, tenant, &pubkey).await?;
    check_nip98_replay(state, tenant, event_id_bytes).await?;
    let pubkey_bytes = pubkey.to_bytes().to_vec();

    // Require an authenticated relay member (NIP-OA owner fallback), scoped to
    // the request's community — same gate as /events and /query.
    let auth_tag = headers.get("x-auth-tag").and_then(|v| v.to_str().ok());
    super::relay_members::enforce_relay_membership(
        state,
        tenant.community(),
        &pubkey_bytes,
        auth_tag,
    )
    .await?;

    let req: SandboxFetchRequest = serde_json::from_slice(body)
        .map_err(|e| api_error(StatusCode::BAD_REQUEST, &format!("invalid request: {e}")))?;

    let parsed_url = reqwest::Url::parse(&req.url)
        .map_err(|e| api_error(StatusCode::BAD_REQUEST, &format!("invalid URL: {e}")))?;

    // Scheme allowlist: http/https only — no file:, ftp:, gopher:, etc.
    match parsed_url.scheme() {
        "http" | "https" => {}
        other => {
            return Err(api_error(
                StatusCode::BAD_REQUEST,
                &format!("unsupported URL scheme: {other}"),
            ));
        }
    }

    let host = parsed_url
        .host_str()
        .ok_or_else(|| api_error(StatusCode::BAD_REQUEST, "URL has no host"))?
        .to_owned();

    // Default ports: 443 for https, 80 for http.
    let port = parsed_url.port_or_known_default().unwrap_or(80);

    let safe_ip = check_ssrf(&host, port)
        .await
        .map_err(|e| api_error(StatusCode::BAD_REQUEST, &e))?;

    // Client is built per-request because `resolve()` pins DNS for a specific
    // host. This disables connection pooling but is required for SSRF safety:
    // without pinning, reqwest performs its own DNS resolution which could
    // return a different address than the one validated above (DNS rebinding
    // TOCTOU).
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(FETCH_TIMEOUT_SECS))
        // Disable redirects — a redirect to an internal host bypasses the SSRF check.
        .redirect(reqwest::redirect::Policy::none())
        .resolve(&host, std::net::SocketAddr::new(safe_ip, port))
        .build()
        .map_err(|e| internal_error(&format!("HTTP client build failed: {e}")))?;

    // Method GET only — the proxy never issues writes on behalf of an embed.
    let resp = client
        .get(parsed_url)
        .send()
        .await
        .map_err(|e| api_error(StatusCode::BAD_GATEWAY, &format!("upstream fetch failed: {e}")))?;

    let status = resp.status().as_u16();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_owned();

    // Read incrementally to prevent OOM from a malicious server returning a
    // multi-GB payload. `resp.bytes()` would buffer the entire body before we
    // could check the size; chunked reading lets us abort at the cap and
    // return the truncated prefix.
    let mut body_bytes: Vec<u8> = Vec::new();
    let mut resp = resp;
    loop {
        let chunk = resp.chunk().await.map_err(|e| {
            api_error(
                StatusCode::BAD_GATEWAY,
                &format!("reading response body: {e}"),
            )
        })?;
        match chunk {
            Some(bytes) => {
                let remaining = FETCH_MAX_RESPONSE_BYTES - body_bytes.len();
                if bytes.len() >= remaining {
                    body_bytes.extend_from_slice(&bytes[..remaining]);
                    break; // Cap reached — abort the stream, keep the prefix.
                }
                body_bytes.extend_from_slice(&bytes);
            }
            None => break,
        }
    }

    let body_base64 = base64::engine::general_purpose::STANDARD.encode(&body_bytes);

    Ok(Json(serde_json::json!({
        "status": status,
        "contentType": content_type,
        "bodyBase64": body_base64,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A host resolving to loopback must be rejected by the SSRF check.
    #[tokio::test]
    async fn ssrf_check_rejects_loopback() {
        let result = check_ssrf("127.0.0.1", 80).await;
        let err = result.expect_err("loopback address must be rejected");
        assert!(err.contains("SSRF blocked"), "unexpected error: {err}");
    }

    /// `localhost` (DNS name resolving to loopback) must be rejected.
    #[tokio::test]
    async fn ssrf_check_rejects_localhost_name() {
        let result = check_ssrf("localhost", 80).await;
        let err = result.expect_err("localhost must be rejected");
        assert!(err.contains("SSRF blocked"), "unexpected error: {err}");
    }

    /// A private RFC 1918 address must be rejected.
    #[tokio::test]
    async fn ssrf_check_rejects_private_ip() {
        let result = check_ssrf("10.0.0.1", 80).await;
        let err = result.expect_err("private address must be rejected");
        assert!(err.contains("SSRF blocked"), "unexpected error: {err}");
    }

    /// A link-local (cloud metadata) address must be rejected.
    #[tokio::test]
    async fn ssrf_check_rejects_link_local() {
        let result = check_ssrf("169.254.169.254", 80).await;
        let err = result.expect_err("link-local address must be rejected");
        assert!(err.contains("SSRF blocked"), "unexpected error: {err}");
    }
}
