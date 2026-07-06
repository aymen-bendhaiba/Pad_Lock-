import { Loader2 } from "lucide-react";
import { AppShell } from "../app-shell";

export default function GeofenceLoading() {
  return (
    <AppShell activeHref="/geofence" headerSearchPlaceholder="Rechercher un equipement..." headerZIndex="z-30">
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#f8fafc] px-6">
        <div className="flex items-center gap-3 rounded-[8px] border border-[#dfe6ee] bg-white px-4 py-3 text-[13px] font-semibold text-[#52657d]">
          <Loader2 size={16} className="animate-spin text-[#2A9D90]" />
          Chargement des geofences...
        </div>
      </div>
    </AppShell>
  );
}
