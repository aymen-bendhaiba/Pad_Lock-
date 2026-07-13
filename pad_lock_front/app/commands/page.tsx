import { AppShell } from "../app-shell";
import { CommandsPanel } from "./commands-panel";

export default function CommandsPage() {
  return (
    <AppShell activeHref="/commands">
      <CommandsPanel />
    </AppShell>
  );
}
