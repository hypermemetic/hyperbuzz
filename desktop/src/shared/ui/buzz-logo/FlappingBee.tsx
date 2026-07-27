import { BuzzMark } from "./BuzzMark";

/**
 * The boot-splash / setup mark. Historically a bee whose wings flapped via
 * compositor-driven CSS; Hyperbuzz renders the Menger-carpet mark instead.
 *
 * Kept as the `FlappingBee` export (same single-prop signature) so every
 * existing import site — the cold-boot gate, setup step, and pending-invite
 * gate — stays valid without touching those call sites.
 */
export function FlappingBee({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={["buzz-mark", "bee-sprite", "relative", className]
        .filter(Boolean)
        .join(" ")}
    >
      <BuzzMark className="block h-auto w-full" />
    </div>
  );
}

export default FlappingBee;
