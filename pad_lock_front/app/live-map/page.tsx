import { AppShell } from "../app-shell";
import { LiveMapPanel } from "./live-map-panel";

export default function LiveMapPage() {
  return (
    <AppShell activeHref="/live-map" headerSearchPlaceholder="Rechercher un equipement..." mainClassName="bg-[#f8fafc]" headerZIndex="z-30">
      <LiveMapPanel />
    </AppShell>
  );
}
