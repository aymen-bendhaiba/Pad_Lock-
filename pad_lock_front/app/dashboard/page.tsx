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

const distributionBars = [
  { place: "Europe", assets: 142, trend: 154 },
  { place: "N. America", assets: 74, trend: 92 },
  { place: "Asia", assets: 126, trend: 138 },
  { place: "Africa", assets: 54, trend: 66 },
  { place: "MENA", assets: 86, trend: 101 },
  { place: "S. America", assets: 36, trend: 50 },
  { place: "Others", assets: 26, trend: 34 },
];

export default function DashboardPage() {
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
                href="#"
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

          <div className="w-full px-4 py-7 md:px-5 xl:px-6">
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

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
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

                <div className="grid min-h-[252px] gap-4 rounded-[10px] border border-[#e6edf4] bg-[#fbfdff] p-4 lg:grid-cols-[1fr_260px]">
                  <div className="rounded-[10px] border border-[#e6edf4] bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-semibold text-[#111827]">
                          Weekly movement lanes
                        </p>
                        <p className="mt-1 text-[11px] text-[#718096]">
                          Moving, idle, and alert volume by day
                        </p>
                      </div>
                      <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[11px] font-semibold text-[#16883f]">
                        +14% active
                      </span>
                    </div>
                    <div className="grid h-[158px] grid-cols-6 items-end gap-3">
                    {[
                      ["Mon", 62, 4, 18],
                      ["Tue", 88, 2, 9],
                      ["Wed", 74, 3, 14],
                      ["Thu", 96, 1, 6],
                      ["Fri", 52, 6, 27],
                      ["Sat", 69, 2, 11],
                    ].map(([day, active, locks, alerts]) => (
                      <div
                        key={day}
                        className="flex min-w-[70px] flex-col justify-end"
                      >
                        <div className="mb-3 flex h-[118px] items-end justify-center gap-1.5 rounded-[8px] bg-[#f8fafc] px-2 pb-2">
                          <span
                            className="w-3.5 rounded-t-full bg-[#2A9D90]"
                            style={{ height: `${active}%` }}
                          />
                          <span
                            className="w-3.5 rounded-t-full bg-[#34C759]"
                            style={{ height: `${Math.max(Number(active) - 16, 22)}%` }}
                          />
                          <span
                            className="w-3.5 rounded-t-full bg-[#f97316]"
                            style={{ height: `${Math.max(Number(alerts) + 18, 18)}%` }}
                          />
                        </div>
                        <p className="text-center text-[11px] font-bold text-[#111827]">
                          {day}
                        </p>
                        <p className="mt-1 text-center text-[10px] text-[#718096]">
                          {locks} locks
                        </p>
                      </div>
                    ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#64748b]">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#2A9D90]" />
                        Moving
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#34C759]" />
                        Idle
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#f97316]" />
                        Alert
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[10px] bg-[#0f172a] p-4 text-white">
                    <p className="text-[12px] font-semibold text-[#9fb0c7]">
                      Fleet pulse
                    </p>
                    <p className="mt-2 text-[34px] font-bold leading-none">742</p>
                    <p className="mt-1 text-[12px] text-[#9fb0c7]">
                      total movements this week
                    </p>
                    <div className="mt-5 space-y-3">
                      {[
                        ["Moving", "68%", "#34C759"],
                        ["Idle", "21%", "#2A9D90"],
                        ["Alert", "11%", "#f97316"],
                      ].map(([label, value, color]) => (
                        <div key={label}>
                          <div className="mb-1 flex justify-between text-[11px]">
                            <span>{label}</span>
                            <span>{value}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/12">
                            <div
                              className="h-full rounded-full"
                              style={{ width: value, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
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
                      Live distribution across all zones
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
                <div className="rounded-[10px] border border-[#e6edf4] bg-[#fbfdff] p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {["7D", "14D", "1M", "Custom"].map((range, index) => (
                        <span
                          key={range}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            index === 0
                              ? "bg-[#34C759] text-white"
                              : "bg-[#eef2f6] text-[#64748b]"
                          }`}
                        >
                          {range}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                      <span className="rounded-full bg-[#eefbf1] px-2.5 py-1 text-[#16883f]">
                        Europe 142
                      </span>
                      <span className="rounded-full bg-[#fff1eb] px-2.5 py-1 text-[#f97316]">
                        Asia 126
                      </span>
                    </div>
                  </div>

                  <svg
                    className="h-[220px] w-full"
                    viewBox="0 0 520 220"
                    role="img"
                    aria-label="Regional movement chart with activity bars and trend line"
                  >
                    <defs>
                      <linearGradient id="distributionBar" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#34C759" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#34C759" stopOpacity="0.12" />
                      </linearGradient>
                    </defs>
                    {[42, 82, 122, 162].map((y) => (
                      <line
                        key={y}
                        x1="34"
                        x2="496"
                        y1={y}
                        y2={y}
                        stroke="#e8eef4"
                      />
                    ))}
                    <path
                      d={`M ${distributionBars
                        .map((item, index) => `${58 + index * 70} ${190 - item.trend}`)
                        .join(" L ")}`}
                      fill="none"
                      stroke="#ef4444"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                    />
                    {distributionBars.map((item, index) => {
                      const x = 46 + index * 70;
                      const height = item.assets * 0.95;
                      const y = 184 - height;

                      return (
                        <g key={item.place}>
                          <rect
                            x={x}
                            y={y}
                            width="24"
                            height={height}
                            rx="6"
                            fill="url(#distributionBar)"
                          />
                          <circle
                            cx={x + 12}
                            cy={190 - item.trend}
                            r="4"
                            fill="#ef4444"
                          />
                          <text
                            x={x + 12}
                            y="207"
                            fill="#718096"
                            fontSize="10"
                            textAnchor="middle"
                          >
                            {item.place}
                          </text>
                        </g>
                      );
                    })}
                    <text x="8" y="45" fill="#94a3b8" fontSize="10">
                      160
                    </text>
                    <text x="8" y="85" fill="#94a3b8" fontSize="10">
                      120
                    </text>
                    <text x="8" y="125" fill="#94a3b8" fontSize="10">
                      80
                    </text>
                    <text x="8" y="165" fill="#94a3b8" fontSize="10">
                      40
                    </text>
                  </svg>

                  <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-[#64748b]">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#34C759]" />
                      Assets by place
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#ef4444]" />
                      Movement trend
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#cbd5e1]" />
                      Others (26)
                    </span>
                  </div>
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
