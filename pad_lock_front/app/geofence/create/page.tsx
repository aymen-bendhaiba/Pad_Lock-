import Image from "next/image";
import {
  Bell,
  CircleOff,
  Command,
  FileText,
  House,
  Map,
  Search,
  Settings,
} from "lucide-react";
import { AlarmNotificationBadge } from "../../alarm-notification-badge";
import { LiveLocksBadge } from "../../live-locks-badge";
import { ThemeToggle } from "../../theme-toggle";
import logo from "../../../public/images/logo.png";
import { UserProfileMenu } from "../../user-profile-menu";
import { GeofenceCreateWorkspace } from "./geofence-create-workspace";

const navItems = [
  { label: "Tableau de bord", icon: House, href: "/dashboard" },
  { label: "Carte en direct", icon: Map, href: "/live-map", badge: <LiveLocksBadge compact /> },
  { label: "Alarmes", icon: Bell, href: "/alarms", badge: <AlarmNotificationBadge /> },
  { label: "Geofences", icon: CircleOff, href: "/geofence", active: true },
  { label: "Rapports", icon: FileText, href: "/reports" },
  { label: "Configurations", icon: Settings, href: "/configurations" },
  { label: "Commandes", icon: Command, href: "/commands" },
];

export default function CreateGeofencePage() {
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
            <label className="relative block w-full max-w-[430px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]"
                size={17}
              />
              <input
                className="h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white pl-10 pr-4 text-[13px] outline-none transition placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                placeholder="Rechercher un equipement..."
                type="search"
              />
            </label>

            <div className="flex items-center gap-4">
              <span className="hidden h-7 items-center rounded-full bg-[#eaf8ef] px-3 text-[12px] font-semibold text-[#16883f] sm:flex"><LiveLocksBadge /></span>
              <ThemeToggle />
              <div className="hidden h-9 border-l border-[#dfe6ee] md:block" />
              <UserProfileMenu />
            </div>
          </header>

          <GeofenceCreateWorkspace />
        </section>
      </div>
    </main>
  );
}