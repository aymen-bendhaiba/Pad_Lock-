import Image from "next/image";
import type { ReactNode } from "react";
import {
  Bell,
  CircleOff,
  Command,
  FileText,
  House,
  Map,
  Search,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { AlarmNotificationBadge } from "./alarm-notification-badge";
import { LiveLocksBadge } from "./live-locks-badge";
import { ThemeToggle } from "./theme-toggle";
import { UserProfileMenu } from "./user-profile-menu";
import logo from "../public/images/logo.png";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: ReactNode;
};

type AppShellProps = {
  activeHref: string;
  children: ReactNode;
  headerSearchPlaceholder?: string;
  headerLeft?: ReactNode;
  mainClassName?: string;
  headerZIndex?: "z-20" | "z-30";
};

const navItems: NavItem[] = [
  { label: "Tableau de bord", icon: House, href: "/dashboard" },
  { label: "Carte en direct", icon: Map, href: "/live-map", badge: <LiveLocksBadge compact /> },
  { label: "Alarmes", icon: Bell, href: "/alarms", badge: <AlarmNotificationBadge /> },
  { label: "Geofences", icon: CircleOff, href: "/geofence" },
  { label: "Rapports", icon: FileText, href: "/reports" },
  { label: "Configurations", icon: Settings, href: "/configurations" },
  { label: "Commandes", icon: Command, href: "/commands" },
];

function isActiveLink(activeHref: string, href: string) {
  if (href === "/geofence") {
    return activeHref === "/geofence" || activeHref.startsWith("/geofence/");
  }

  return activeHref === href;
}

function HeaderLeft({ searchPlaceholder, customContent }: { searchPlaceholder?: string; customContent?: ReactNode }) {
  if (customContent) {
    return <div className="flex min-w-0 flex-1 items-center gap-3">{customContent}</div>;
  }

  if (!searchPlaceholder) {
    return <div className="min-w-0 flex-1" />;
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-[7px] border border-[#dfe6ee] text-[#64748b] lg:hidden"
        aria-label="Ouvrir la navigation"
      >
        <SlidersHorizontal size={17} />
      </button>
      <label className="relative block w-full max-w-[430px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" size={17} />
        <input
          className="h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white pl-10 pr-4 text-[13px] outline-none transition placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
          placeholder={searchPlaceholder}
          type="search"
        />
      </label>
    </div>
  );
}

export function AppShell({
  activeHref,
  children,
  headerSearchPlaceholder,
  headerLeft,
  mainClassName = "bg-white",
  headerZIndex = "z-20",
}: AppShellProps) {
  return (
    <main className={"min-h-screen text-[#0f172a] " + mainClassName}>
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
            {navItems.map((item) => {
              const active = isActiveLink(activeHref, item.href);
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={
                    "flex h-10 items-center justify-between rounded-[7px] px-4 text-[13px] font-medium transition " +
                    (active
                      ? "bg-[#edf2f7] text-[#111827]"
                      : "text-[#5b6b84] hover:bg-[#f3f7fa] hover:text-[#111827]")
                  }
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
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className={`sticky top-0 ${headerZIndex} flex h-14 items-center justify-between gap-4 border-b border-[#dfe6ee] bg-white/95 px-4 backdrop-blur md:px-6`}>
            <HeaderLeft searchPlaceholder={headerSearchPlaceholder} customContent={headerLeft} />

            <div className="flex items-center gap-4">
              <span className="hidden h-7 items-center rounded-full bg-[#eaf8ef] px-3 text-[12px] font-semibold text-[#16883f] sm:flex">
                <LiveLocksBadge />
              </span>
              <ThemeToggle />
              <div className="hidden h-9 border-l border-[#dfe6ee] md:block" />
              <UserProfileMenu />
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
