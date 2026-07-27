import { cn } from "@/shared/lib/cn";

import { BuzzMark } from "./BuzzMark";

export type FuzzyLogoProps = {
  /** Retained for API compatibility; the Menger mark has no turbulence filter. */
  fuzz?: boolean;
  className?: string;
  ariaLabel?: string;
  loop?: boolean;
  /** When looping, hide the mark for this many seconds between plays. */
  loopRestSeconds?: number;
  /** Set false when a parent drives its own opacity animation over the mark. */
  pulse?: boolean;
  reverse?: boolean;
  variant?: string;
};

/**
 * The animated Hyperbuzz mark. Upstream morphed a bee silhouette through a
 * keyframed SVG animation; Hyperbuzz renders the static Menger-carpet mark
 * with a lightweight CSS pulse instead — cheaper, and it paints correctly on
 * the first frame during cold boot.
 *
 * The full prop surface is kept so existing call sites (boot splash, agent
 * turn-liveness indicator, transcript list) need no changes; `fuzz`, `reverse`
 * and `variant` are now inert.
 */
export function FuzzyLogo({
  className,
  ariaLabel = "Hyperbuzz logo",
  loop = false,
  loopRestSeconds = 0,
  pulse = true,
}: FuzzyLogoProps) {
  // A rest-window loop already reads as "alive"; skip the pulse so the two
  // opacity animations don't fight.
  const hasRestWindow = loop && loopRestSeconds > 0;

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "block",
        pulse && !hasRestWindow && "buzz-logo--pulse",
        className,
      )}
      role="img"
    >
      <BuzzMark className="block h-auto w-full" />
    </span>
  );
}

export default FuzzyLogo;
