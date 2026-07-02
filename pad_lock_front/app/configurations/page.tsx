import { AppShell } from "../app-shell";
import { ConfigurationsPanel } from "./configurations-panel";

export default function ConfigurationsPage() {
  return (
    <AppShell activeHref="/configurations" headerSearchPlaceholder="Rechercher une configuration..." mainClassName="bg-[#f8fafc]">
      <ConfigurationsPanel />
    </AppShell>
  );
}
