import Image from "next/image";
import {
  Bell,
  ChevronDown,
  CircleOff,
  Command,
  House,
  Map,
  PackageSearch,
  Play,
  Route,
  Search,
  Settings,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import logo from "../../public/images/logo.png";
import { AssetCard } from "./asset-card";
import { liveMapAssets } from "./live-map-data";
import { LiveMapShell } from "./live-map-shell";

const navItems = [
  { label: "Dashboard", icon: House, href: "/dashboard" },
  { label: "Live Map", icon: Map, href: "/live-map", active: true },
  { label: "Alarms", icon: Bell, href: "/alarms", badge: "6" },
  { label: "Geofence", icon: CircleOff, href: "/geofence" },
  { label: "Routes", icon: Route, href: "/routes" },
  { label: "Reports", icon: PackageSearch, href: "/reports" },
  { label: "Configurations", icon: Settings, href: "/configurations" },
  { label: "Maintenance", icon: Truck, href: "/maintenance" },
  { label: "Commands", icon: Command, href: "/commands" },
];

export default function LiveMapPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
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
              className="grid size-8 place-items-center rounded-[6px] border border-[#dfe6ee] text-[#64748b] transition hover:border-[#2A9D90] hover:text-[#2A9D90]"
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
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[#dfe6ee] bg-white/95 px-4 backdrop-blur md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="grid size-9 place-items-center rounded-[7px] border border-[#dfe6ee] text-[#64748b] lg:hidden"
                aria-label="Open navigation"
              >
                <SlidersHorizontal size={17} />
              </button>
              <label className="relative block w-full max-w-[420px]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]"
                  size={17}
                />
                <input
                  className="h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white pl-10 pr-4 text-[13px] outline-none transition placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                  placeholder="Search assets, devices..."
                  type="search"
                />
              </label>
            </div>

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
              <button
                type="button"
                className="flex items-center gap-2 rounded-full text-left"
                aria-label="Open profile menu"
              >
                <span className="grid size-10 place-items-center rounded-full bg-[#111827] text-[14px] font-bold text-white">
                  AA
                </span>
                <ChevronDown className="hidden text-[#718096] sm:block" size={15} />
              </button>
            </div>
          </header>

          <div className="grid min-h-[calc(100vh-56px)] xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="relative min-h-[calc(100vh-56px)] overflow-hidden border-r border-[#dfe6ee] bg-[#d8eadf]">
              <LiveMapShell />

              <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap justify-between gap-3 border-t border-[#dfe6ee] bg-white/95 px-4 py-3 text-[11px] text-[#64748b] backdrop-blur">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {["All (253)", "Motion (172)", "Idle (56)", "Offline (32)", "Alarm (12)"].map((item, index) => (
                    <span key={item} className="flex items-center gap-1.5">
                      <span
                        className={`size-2 rounded-full ${
                          index === 0
                            ? "bg-[#34C759]"
                            : index === 1
                              ? "bg-[#3b82f6]"
                              : index === 2
                                ? "bg-[#f97316]"
                                : index === 3
                                  ? "bg-[#94a3b8]"
                                  : "bg-[#ef4444]"
                        }`}
                      />
                      {item}
                    </span>
                  ))}
                </div>
                <div className="flex gap-x-6">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#a16207]" />
                    Locked: (322)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#a7f3d0]" />
                    Unlocked: (72)
                  </span>
                </div>
              </div>
            </section>

            <aside className="flex min-h-[calc(100vh-56px)] flex-col bg-white">
              <div className="border-b border-[#dfe6ee] p-5">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" size={17} />
                  <input
                    className="h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white pl-10 pr-4 text-[13px] outline-none transition placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                    placeholder="Search asset or device ID..."
                    type="search"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between px-5 py-4">
                <h1 className="text-[14px] font-bold">All assets (187)</h1>
                <select
                  aria-label="Filter assets"
                  className="h-8 rounded-[7px] border border-[#dfe6ee] bg-white px-2.5 text-[12px] font-medium text-[#475569] outline-none transition focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                  defaultValue="all"
                >
                  <option value="all">All</option>
                  <option value="moving">Moving</option>
                  <option value="alarm">Alarm</option>
                  <option value="locked">Locked</option>
                  <option value="unlocked">Unlocked</option>
                </select>
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
                {liveMapAssets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>

              <div className="border-t border-[#dfe6ee] bg-white px-5 py-3">
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-[#dfe6ee] bg-white text-[13px] font-semibold text-[#111827] transition hover:border-[#2563eb] hover:text-[#2563eb]"
                >
                  <Play size={18} className="text-[#2563eb]" />
                  Playback
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-[#dfe6ee] bg-[#f8fafc] px-5 py-4 text-[12px] text-[#64748b]">
                <span>Group View</span>
                <div className="flex items-center gap-4">
                  <button className="grid size-7 place-items-center rounded-full bg-white" type="button" aria-label="Previous page">
                    ‹
                  </button>
                  <span className="font-semibold text-[#475569]">1 / 23</span>
                  <button className="grid size-7 place-items-center rounded-full bg-white" type="button" aria-label="Next page">
                    ›
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
