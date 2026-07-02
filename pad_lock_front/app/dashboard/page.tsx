import { AppShell } from "../app-shell";
import { DashboardPanel } from "./dashboard-panel";

export default function DashboardPage() {
  return (
    <AppShell activeHref="/dashboard" headerSearchPlaceholder="Rechercher un equipement..." mainClassName="bg-[#f8fafc]">
      <DashboardPanel />
    </AppShell>
  );
}
