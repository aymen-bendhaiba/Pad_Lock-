import Image from "next/image";
import {
  Bell,
  CarFront,
  ChevronDown,
  CircleOff,
  Command,
  FileText,
  House,
  Map,
  Route,
  Settings,
} from "lucide-react";
import logo from "../../public/images/logo.png";
import { CommandsPanel } from "./commands-panel";

const navItems = [
  { label: "Dashboard", icon: House, href: "/dashboard" },
  { label: "Live Map", icon: Map, href: "/live-map" },
  { label: "Alarms", icon: Bell, href: "/alarms", badge: "6" },
  { label: "Geofence", icon: CircleOff, href: "/geofence" },
  { label: "Routes", icon: Route, href: "/routes" },
  { label: "Reports", icon: FileText, href: "/reports" },
  { label: "Configurations", icon: Settings, href: "/configurations" },
  { label: "Maintenance", icon: CarFront, href: "/maintenance" },
  { label: "Commands", icon: Command, href: "/commands", active: true },
];

export default function CommandsPage() {
  return (
    <main className="min-h-screen bg-white text-[#0f172a]">
      <div className="grid min-h-screen lg:grid-cols-[286px_1fr]">
        <aside className="sticky top-0 hidden h-screen border-r border-[#dfe6ee] bg-white lg:block">
          <div className="flex h-14 items-center justify-between border-b border-[#dfe6ee] px-5">
            <div className="flex items-center gap-2">
              <Image
                src={logo}
                alt="Administration des Douanes et Impots Indirect logo"
                width={30}
                height={47}
                className="h-10 w-auto"
                priority
              />
              <p className="max-w-[172px] text-[10px] font-semibold leading-tight">
                Royaume Du Maroc Administration
                <br />
                Des Douanes Et Impots Indirect
              </p>
            </div>
            <button
              className="grid size-8 place-items-center rounded-[6px] border border-[#dfe6ee] text-[#64748b]"
              type="button"
              aria-label="Notifications"
            >
              <Bell size={15} />
            </button>
          </div>

          <nav className="space-y-1 px-4 py-3">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`flex h-10 items-center justify-between rounded-[7px] px-4 text-[13px] font-medium transition ${
                  item.active
                    ? "bg-[#edf2f7] text-[#111827]"
                    : "text-[#5b6b84] hover:bg-[#f3f7fa] hover:text-[#111827]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <item.icon size={16} strokeWidth={1.8} />
                  {item.label}
                </span>
                {item.badge ? (
                  <span className="grid size-5 place-items-center rounded-full bg-[#050816] text-[10px] text-white">
                    {item.badge}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[#dfe6ee] bg-white/95 px-4 backdrop-blur md:px-6">
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-[5px] bg-[#050505] px-3 text-[12px] font-semibold text-white"
            >
              RFID Cards Authorization
              <ChevronDown size={14} />
            </button>

            <div className="flex items-center gap-4">
              <span className="hidden h-7 items-center rounded-full bg-[#eaf8ef] px-3 text-[12px] font-semibold text-[#16883f] sm:flex">
                <span className="mr-1.5 size-2 rounded-full bg-[#34C759]" />
                98 Online
              </span>
              <div className="hidden h-9 border-l border-[#dfe6ee] md:block" />
              <div className="hidden text-right md:block">
                <p className="text-[13px] font-semibold">Amina Alaoui</p>
                <p className="text-[12px] text-[#718096]">a.alaoui@harmony.ma</p>
              </div>
              <button type="button" className="flex items-center gap-2 rounded-full">
                <span className="grid size-10 place-items-center rounded-full bg-[#111827] text-[14px] font-bold text-white">
                  AA
                </span>
                <ChevronDown className="hidden text-[#718096] sm:block" size={15} />
              </button>
            </div>
          </header>

          <CommandsPanel />
        </section>
      </div>
    </main>
  );
}
