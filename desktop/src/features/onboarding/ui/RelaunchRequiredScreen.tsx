import { RecoveryScreen } from "./RecoveryScreen";

export function RelaunchRequiredScreen() {
  return (
    <RecoveryScreen
      testId="relaunch-required"
      title="Restart Hyperbuzz to finish recovery"
      body="Your identity was updated. Hyperbuzz needs to restart so syncing and agents run under it."
    />
  );
}
