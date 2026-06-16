import Image from "next/image";
import {
  Activity,
  Bell,
  CalendarDays,
  CarFront,
  ChartNoAxesColumn,
  ChevronDown,
  CircleAlert,
  CircleGauge,
  CircleOff,
  Command,
  Database,
  FileText,
  Globe2,
  House,
  Lock,
  Map,
  Route,
  Search,
  Settings,
  SlidersHorizontal,
  Unlock,
  Wifi,
  WifiOff,
} from "lucide-react";
import logo from "../../public/images/logo.png";

const navItems = [
  { label: "Dashboard", icon: House, active: true },
  { label: "Live Map", icon: Map },
  { label: "Alarms", icon: Bell, badge: "6" },
  { label: "Geofence", icon: CircleOff },
  { label: "Routes", icon: Route },
  { label: "Reports", icon: FileText },
  { label: "Configurations", icon: Settings },
  { label: "Maintenance", icon: CarFront },
  { label: "Commands", icon: Command },
];

const metrics = [
  {
    label: "Total Assets",
    value: "518",
    trend: "+12.1% from last month",
    icon: Database,
  },
  { label: "Online", value: "241", trend: "85% from last month", icon: Wifi },
  { label: "Offline", value: "139", trend: "18% from last month", icon: WifiOff },
  { label: "Moving", value: "125", trend: "15% from last month", icon: Activity },
  { label: "Idle", value: "189", trend: "18% from last month", icon: CircleGauge },
  { label: "Locked", value: "189", trend: "83% from last month", icon: Lock },
  { label: "Unlocked", value: "189", trend: "18% from last month", icon: Unlock },
  { label: "Alarm", value: "189", trend: "-4% from last month", icon: CircleAlert },
];

const alarms = [
  { label: "Overspeed", value: 186, width: "61%" },
  { label: "Geofence", value: 305, width: "88%" },
  { label: "Low Battery", value: 237, width: "72%" },
  { label: "Tamper", value: 73, width: "24%" },
  { label: "Door Open", value: 209, width: "66%" },
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-[#dfe6ee] bg-white lg:block">
          <div className="flex h-14 items-center justify-between border-b border-[#dfe6ee] px-4">
            <div className="flex items-center gap-2">
              <Image
                src={logo}
                alt="Administration des Douanes et Impots Indirect logo"
                width={30}
                height={47}
                className="h-10 w-auto"
                priority
              />
              <p className="max-w-[150px] text-[10px] font-semibold leading-tight">
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

          <nav className="space-y-1 px-3 py-3">
            {navItems.map((item) => (
              <a
                key={item.label}
                href="#"
                className={`flex h-10 items-center justify-between rounded-[7px] px-3 text-[13px] font-medium transition ${
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="grid size-9 place-items-center rounded-[7px] border border-[#dfe6ee] text-[#64748b] lg:hidden"
                aria-label="Open navigation"
              >
                <SlidersHorizontal size={17} />
              </button>
              <label className="relative block w-full max-w-[390px]">
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

          <div className="mx-auto max-w-[1180px] px-4 py-7 md:px-6">
            <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <h1 className="text-[26px] font-bold tracking-normal text-black">
                Dashboard
              </h1>
              <button
                type="button"
                className="flex h-10 w-fit items-center gap-2 rounded-[7px] border border-[#dfe6ee] bg-white px-3 text-[13px] font-medium text-[#1f2937]"
              >
                <CalendarDays size={16} />
                12/04/2026 - 05/05/2026
              </button>
            </div>

            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-[8px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[13px] font-semibold text-[#0f172a]">
                      {metric.label}
                    </p>
                    <span className="grid size-8 place-items-center rounded-[7px] bg-[#f5f7fa] text-[#7b8797]">
                      <metric.icon size={15} />
                    </span>
                  </div>
                  <p className="mt-5 text-[28px] font-bold leading-none text-[#0f172a]">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-[#718096]">
                    {metric.trend}
                  </p>
                </article>
              ))}
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
              <article className="rounded-[8px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold">Fleet Activity</h2>
                    <p className="mt-1 text-[12px] text-[#718096]">
                      Weekly movement summary
                    </p>
                  </div>
                  <button
                    type="button"
                    className="h-9 rounded-[7px] border border-[#dfe6ee] px-3 text-[12px] font-medium text-[#475569]"
                  >
                    Last 7 days
                  </button>
                </div>

                <div className="relative h-[230px] overflow-hidden rounded-[8px] bg-[linear-gradient(180deg,#ffffff,#fbfcfd)]">
                  <svg
                    className="h-full w-full"
                    viewBox="0 0 760 230"
                    role="img"
                    aria-label="Fleet activity chart showing command load, live movement and lock events"
                  >
                    <defs>
                      <linearGradient id="movementFill" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#2A9D90" stopOpacity="0.16" />
                        <stop offset="55%" stopColor="#34C759" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#2A9D90" stopOpacity="0.18" />
                      </linearGradient>
                      <linearGradient id="pulseStroke" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#0C4E71" />
                        <stop offset="48%" stopColor="#2A9D90" />
                        <stop offset="100%" stopColor="#34C759" />
                      </linearGradient>
                    </defs>
                    {[36, 78, 120, 162, 204].map((y) => (
                      <line
                        key={y}
                        x1="28"
                        x2="732"
                        y1={y}
                        y2={y}
                        stroke="#e7edf3"
                        strokeWidth="1"
                      />
                    ))}
                    <path
                      d="M28 155 C90 106 130 66 202 72 C276 78 314 121 374 119 C434 117 466 65 526 79 C586 93 616 146 732 103 L732 170 C635 199 586 174 526 153 C468 132 435 175 374 171 C310 167 275 126 204 122 C130 118 86 154 28 188 Z"
                      fill="url(#movementFill)"
                    />
                    <path
                      d="M28 155 C90 106 130 66 202 72 C276 78 314 121 374 119 C434 117 466 65 526 79 C586 93 616 146 732 103"
                      fill="none"
                      stroke="url(#pulseStroke)"
                      strokeLinecap="round"
                      strokeWidth="4"
                    />
                    <path
                      d="M28 188 C96 151 146 130 205 132 C268 134 300 166 365 167 C427 168 465 135 526 148 C591 162 637 179 732 170"
                      fill="none"
                      stroke="#ff7a45"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                    <path
                      d="M28 122 C118 92 163 102 221 112 C283 123 322 97 380 87 C455 73 499 111 556 113 C622 115 664 84 732 88"
                      fill="none"
                      stroke="#94a3b8"
                      strokeDasharray="5 8"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                    {[
                      [202, 72, "#2A9D90"],
                      [374, 119, "#34C759"],
                      [526, 79, "#ff7a45"],
                      [205, 132, "#ff7a45"],
                    ].map(([cx, cy, color]) => (
                      <g key={`${cx}-${cy}`}>
                        <circle cx={cx} cy={cy} r="8" fill={`${color}`} opacity="0.16" />
                        <circle cx={cx} cy={cy} r="4" fill={`${color}`} />
                      </g>
                    ))}
                    {days.map((day, index) => (
                      <text
                        key={day}
                        x={35 + index * 138}
                        y="221"
                        fill="#718096"
                        fontSize="11"
                      >
                        {day}
                      </text>
                    ))}
                  </svg>
                  <div className="absolute left-5 top-5 flex gap-2">
                    {["Movement", "Alerts", "Baseline"].map((item, index) => (
                      <span
                        key={item}
                        className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#475569] shadow-sm"
                      >
                        <span
                          className={`mr-1.5 inline-block size-2 rounded-full ${
                            index === 0
                              ? "bg-[#2A9D90]"
                              : index === 1
                                ? "bg-[#ff7a45]"
                                : "bg-[#94a3b8]"
                          }`}
                        />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-[8px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
                <h2 className="text-[15px] font-bold">Connection Status</h2>
                <div className="mt-6 grid place-items-center">
                  <div className="relative grid size-[150px] place-items-center rounded-full bg-[conic-gradient(#34C759_0_295deg,#cbd5e1_295deg_360deg)]">
                    <div className="grid size-[96px] place-items-center rounded-full bg-white">
                      <div className="text-center">
                        <p className="text-[29px] font-bold leading-none">82%</p>
                        <p className="mt-1 text-[12px] text-[#718096]">Online</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-3 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[#64748b]">
                      <span className="size-2 rounded-full bg-[#34C759]" />
                      Online
                    </span>
                    <strong>282</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[#64748b]">
                      <span className="size-2 rounded-full bg-[#cbd5e1]" />
                      Offline
                    </span>
                    <strong>131</strong>
                  </div>
                </div>
              </article>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
              <article className="rounded-[8px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="text-[15px] font-bold">Top Alarms</h2>
                    <p className="mt-1 text-[12px] text-[#718096]">
                      Weekly movement summary
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-[7px] bg-[#111827] px-3 text-[12px] font-medium text-white"
                  >
                    Reports
                    <ChartNoAxesColumn size={14} />
                  </button>
                </div>
                <div className="space-y-4">
                  {alarms.map((alarm) => (
                    <div key={alarm.label} className="grid grid-cols-[1fr_44px] items-center gap-3">
                      <div className="h-9 rounded-[4px] bg-[#eef4f7]">
                        <div
                          className="flex h-full items-center rounded-[4px] bg-[#2A9D90] px-3 text-[12px] font-medium text-white"
                          style={{ width: alarm.width }}
                        >
                          {alarm.label}
                        </div>
                      </div>
                      <span className="text-[12px] font-medium text-[#1f2937]">
                        {alarm.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#64748b]">
                  {["All (253)", "Motion (172)", "Idle (56)", "Offline (32)", "Alarm (12)"].map(
                    (item, index) => (
                      <span key={item} className="flex items-center gap-1.5">
                        <span
                          className={`size-2 rounded-full ${
                            index === 0
                              ? "bg-[#34C759]"
                              : index === 1
                                ? "bg-[#3b82f6]"
                                : index === 2
                                  ? "bg-[#ff7a45]"
                                  : index === 3
                                    ? "bg-[#94a3b8]"
                                    : "bg-[#ef4444]"
                          }`}
                        />
                        {item}
                      </span>
                    ),
                  )}
                </div>
              </article>

              <article className="rounded-[8px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold">Asset Distribution</h2>
                    <p className="mt-1 text-[12px] text-[#718096]">
                      Weekly movement summary
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-[7px] border border-[#dfe6ee] px-3 text-[12px] font-medium"
                  >
                    <Globe2 size={14} />
                    Global view
                  </button>
                </div>
                <div className="relative h-[220px] overflow-hidden rounded-[16px] bg-[#f8fafc]">
                  <svg className="h-full w-full" viewBox="0 0 480 220" aria-hidden>
                    <path
                      d="M92 78 L120 92 L153 74 L185 96 L219 82 L253 103 L294 86 L330 106 L367 91"
                      fill="none"
                      stroke="#dbeafe"
                      strokeWidth="2"
                    />
                    <circle cx="120" cy="92" r="24" fill="#eef4ff" />
                    <circle cx="252" cy="154" r="34" fill="#f1f5f9" />
                    <circle cx="366" cy="99" r="18" fill="#f1f5f9" />
                    <circle cx="162" cy="76" r="7" fill="#4f7cff" />
                    <circle cx="127" cy="132" r="7" fill="#34C759" />
                    <circle cx="294" cy="99" r="7" fill="#ff7a45" />
                    <circle cx="332" cy="166" r="7" fill="#ef4444" />
                    <circle cx="162" cy="76" r="15" fill="#4f7cff" opacity=".12" />
                    <circle cx="127" cy="132" r="15" fill="#34C759" opacity=".12" />
                    <circle cx="294" cy="99" r="15" fill="#ff7a45" opacity=".12" />
                    <circle cx="332" cy="166" r="15" fill="#ef4444" opacity=".12" />
                  </svg>
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] text-[#64748b]">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#4f7cff]" />
                    Europe (142)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#34C759]" />
                    North America (74)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#ff7a45]" />
                    Asia (126)
                  </span>
                </div>
              </article>
            </section>

            <div className="mt-5 flex flex-wrap justify-end gap-x-8 gap-y-2 pb-2 text-[11px] text-[#64748b]">
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
      </div>
    </main>
  );
}
