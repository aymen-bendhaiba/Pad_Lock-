import { AppShell } from "../app-shell";
import { AlarmsPanel } from "./alarms-panel";
import { AlarmNotificationReset } from "./alarm-notification-reset";

export default function AlarmsPage() {
  return (
    <AppShell activeHref="/alarms">
      <AlarmNotificationReset />
      <AlarmsPanel />
    </AppShell>
  );
}
