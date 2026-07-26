/**
 * The Hyperbuzz mark — a Menger carpet (2D face of a Menger sponge), echoing
 * the menger.sh / hypermemetic identity. Rendered in `currentColor` as a plain
 * static SVG so it paints complete on the first frame and inherits the
 * surrounding text color. Kept as the `BuzzMark` export so every existing
 * import stays valid.
 */
export function BuzzMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={["buzz-mark", className].filter(Boolean).join(" ")}
      viewBox="0 0 100 100"
      fill="currentColor"
    >
      <rect x="0.00" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="11.11" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="33.33" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="44.44" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="55.56" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="77.78" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="0.00" width="11.11" height="11.11" rx="1.78" />
      <rect x="0.00" y="11.11" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="11.11" width="11.11" height="11.11" rx="1.78" />
      <rect x="33.33" y="11.11" width="11.11" height="11.11" rx="1.78" />
      <rect x="55.56" y="11.11" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="11.11" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="11.11" width="11.11" height="11.11" rx="1.78" />
      <rect x="0.00" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="11.11" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="33.33" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="44.44" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="55.56" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="77.78" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="22.22" width="11.11" height="11.11" rx="1.78" />
      <rect x="0.00" y="33.33" width="11.11" height="11.11" rx="1.78" />
      <rect x="11.11" y="33.33" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="33.33" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="33.33" width="11.11" height="11.11" rx="1.78" />
      <rect x="77.78" y="33.33" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="33.33" width="11.11" height="11.11" rx="1.78" />
      <rect x="0.00" y="44.44" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="44.44" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="44.44" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="44.44" width="11.11" height="11.11" rx="1.78" />
      <rect x="0.00" y="55.56" width="11.11" height="11.11" rx="1.78" />
      <rect x="11.11" y="55.56" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="55.56" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="55.56" width="11.11" height="11.11" rx="1.78" />
      <rect x="77.78" y="55.56" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="55.56" width="11.11" height="11.11" rx="1.78" />
      <rect x="0.00" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="11.11" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="33.33" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="44.44" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="55.56" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="77.78" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="66.67" width="11.11" height="11.11" rx="1.78" />
      <rect x="0.00" y="77.78" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="77.78" width="11.11" height="11.11" rx="1.78" />
      <rect x="33.33" y="77.78" width="11.11" height="11.11" rx="1.78" />
      <rect x="55.56" y="77.78" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="77.78" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="77.78" width="11.11" height="11.11" rx="1.78" />
      <rect x="0.00" y="88.89" width="11.11" height="11.11" rx="1.78" />
      <rect x="11.11" y="88.89" width="11.11" height="11.11" rx="1.78" />
      <rect x="22.22" y="88.89" width="11.11" height="11.11" rx="1.78" />
      <rect x="33.33" y="88.89" width="11.11" height="11.11" rx="1.78" />
      <rect x="44.44" y="88.89" width="11.11" height="11.11" rx="1.78" />
      <rect x="55.56" y="88.89" width="11.11" height="11.11" rx="1.78" />
      <rect x="66.67" y="88.89" width="11.11" height="11.11" rx="1.78" />
      <rect x="77.78" y="88.89" width="11.11" height="11.11" rx="1.78" />
      <rect x="88.89" y="88.89" width="11.11" height="11.11" rx="1.78" />
    </svg>
  );
}
