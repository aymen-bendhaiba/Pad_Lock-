import { AppShell } from "../app-shell";
import { GeofenceWorkspace } from "./geofence-workspace";

export default function GeofencePage() {
  return (
    <AppShell activeHref="/geofence" headerSearchPlaceholder="Rechercher un equipement..." headerZIndex="z-30">
      <GeofenceWorkspace />
    </AppShell>
  );
}
