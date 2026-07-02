import { AppShell } from "../app-shell";
import { ReportsPanel } from "./reports-panel";

export default function ReportsPage() {
  return (
    <AppShell activeHref="/reports">
      <ReportsPanel />
    </AppShell>
  );
}
