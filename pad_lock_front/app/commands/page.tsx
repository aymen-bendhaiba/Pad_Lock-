import { ChevronDown } from "lucide-react";
import { AppShell } from "../app-shell";
import { CommandsPanel } from "./commands-panel";

export default function CommandsPage() {
  return (
    <AppShell
      activeHref="/commands"
      headerLeft={
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-[5px] bg-[#050505] px-3 text-[12px] font-semibold text-white"
        >
          Autorisation des badges RFID
          <ChevronDown size={14} />
        </button>
      }
    >
      <CommandsPanel />
    </AppShell>
  );
}
