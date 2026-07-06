import { Loader2 } from "lucide-react";
import { AppShell } from "../app-shell";

export default function LiveMapLoading() {
  return (
    <AppShell activeHref="/live-map" headerSearchPlaceholder="Rechercher sur la carte...">
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#d8eadf] px-6">
        <div className="flex items-center gap-3 rounded-[8px] border border-[#c6ddd2] bg-white px-4 py-3 text-[13px] font-semibold text-[#52657d]">
          <Loader2 size={16} className="animate-spin text-[#2A9D90]" />
          Chargement de la carte en direct...
        </div>
      </div>
    </AppShell>
  );
}
