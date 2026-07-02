import { AppShell } from "../../app-shell";
import { GeofenceCreateWorkspace } from "./geofence-create-workspace";

export default function CreateGeofencePage() {
  return (
    <AppShell activeHref="/geofence" headerSearchPlaceholder="Rechercher un equipement..." headerZIndex="z-30">
      <GeofenceCreateWorkspace />
    </AppShell>
  );
}
