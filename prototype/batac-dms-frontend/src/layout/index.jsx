import React from 'react';
import {
  Layers, Briefcase, Scale, Activity, FileCheck, Folder, Globe,
  ChevronRight, ChevronLeft, Bell, Settings, ChevronDown
} from 'lucide-react';

export const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }
    body { font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif; }
    .font-mono { font-family: 'IBM Plex Mono', 'Courier New', monospace !important; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .line-clamp-1 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
    .line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .sidebar-bg { background-color: #0D3D20; }
    .sidebar-mid { background-color: #1A6B35; }
    .nav-active { background-color: #00A651 !important; }
    .nav-hover:hover { background-color: #1A6B35; }
    .brand-btn { background-color: #00A651; }
    .brand-btn:hover { background-color: #0D3D20; }
    .brand-text { color: #00A651; }
    .brand-border { border-color: #00A651; }
    .brand-ring:focus { outline: 2px solid #00A651; outline-offset: 2px; }
    .brand-bg-light { background-color: #E8F5ED; }
    .brand-bg-50 { background-color: #F0FAF4; }
    .seal-ring { stroke: #F59E0B; }
  `}</style>
)

const starPoints = (cx, cy, rOuter, rInner) => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(" ")
}

export const CitySeal = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Seal of the City of Batac">
    <circle cx="50" cy="50" r="49" fill="#D1D5DB" />
    <circle cx="50" cy="50" r="48" fill="#1E3A8A" />
    <text x="50" y="9" textAnchor="middle" fill="#FBBF24" fontSize="6.5" fontFamily="Georgia, serif" fontWeight="700" letterSpacing="1.5">CITY OF BATAC</text>
    <text x="50" y="98" textAnchor="middle" fill="#FBBF24" fontSize="5.5" fontFamily="Georgia, serif" fontWeight="700" letterSpacing="2">OFFICIAL SEAL</text>
    <polygon points={starPoints(6.5, 50, 5.5, 2.2)} fill="#FBBF24" />
    <polygon points={starPoints(93.5, 50, 5.5, 2.2)} fill="#FBBF24" />
    <circle cx="50" cy="50" r="39" fill="#DC2626" />
    {Array.from({ length: 14 }, (_, i) => {
      const a = ((Math.PI * 2) / 14) * i
      return <circle key={i} cx={50 + 34.5 * Math.cos(a)} cy={50 + 34.5 * Math.sin(a)} r="0.9" fill="#FFFFFF" />
    })}
    <circle cx="50" cy="50" r="30.5" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="0.5" />
    <path d="M 20.5 50 A 29.5 29.5 0 0 1 79.5 50 Z" fill="#7DB8F0" />
    <path d="M 20.5 50 A 29.5 29.5 0 0 0 79.5 50 Z" fill="#1A7A36" />
    <g stroke="#FBBF24" strokeWidth="1.3" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const a = (deg * Math.PI) / 180
        return <line key={deg} x1={50 + 6 * Math.cos(a)} y1={34 + 6 * Math.sin(a)} x2={50 + 9.5 * Math.cos(a)} y2={34 + 9.5 * Math.sin(a)} />
      })}
    </g>
    <circle cx="50" cy="34" r="5" fill="#FEF3C7" />
    <circle cx="29.5" cy="42" r="5" fill="#16A34A" />
    <rect x="28.5" y="46" width="2" height="5" fill="#78350F" />
    <rect x="37" y="44" width="26" height="9" fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="0.4" />
    {[39.5, 44, 48.5, 53, 57.5].map(x => <rect key={x} x={x} y="46.5" width="2" height="4" fill="#9CA3AF" />)}
    <rect x="20.7" y="52.5" width="58.6" height="1.4" fill="#D1D5DB" />
    <g stroke="#FDE68A" strokeWidth="0.8" strokeLinecap="round">
      <line x1="27" y1="64" x2="25" y2="56" />
      <line x1="30" y1="64" x2="29" y2="55" />
      <line x1="33" y1="64" x2="33" y2="56" />
    </g>
  </svg>
)

export const CitySealOfficial = ({ size = 56, className = "" }) => (
  <img
    src="/assets/city-seal-official.jpg"
    alt="Official Seal of the City of Batac, Ilocos Norte"
    width={size}
    height={size}
    className={`rounded-full flex-shrink-0 ${className}`}
    style={{ width: size, height: size, objectFit: "contain" }}
  />
)

export const QRDisplay = ({ size = 80 }) => {
  const N = 21
  const cs = size / N
  const isBlack = (r, c) => {
    const inTL = r < 7 && c < 7
    const inTR = r < 7 && c >= 14
    const inBL = r >= 14 && c < 7
    const finder = (rr, cc) => (rr === 0 || rr === 6 || cc === 0 || cc === 6) || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4)
    if (inTL) return finder(r, c)
    if (inTR) return finder(r, c - 14)
    if (inBL) return finder(r - 14, c)
    if (r === 6 && c >= 8 && c <= 12) return c % 2 === 0
    if (c === 6 && r >= 8 && r <= 12) return r % 2 === 0
    if (r >= 8 && c >= 8) return ((r * 29 + c * 17 + r * c * 3) % 11) < 4
    return false
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" />
      {Array.from({ length: N }, (_, r) =>
        Array.from({ length: N }, (_, c) =>
          isBlack(r, c) ? <rect key={`${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill="#111" /> : null
        )
      )}
    </svg>
  )
}

export const DEBUG_USER_ROLE = "mayor"; // "mayor" or "sp"

const navGroups = [
  {
    label: "PROTOTYPE",
    items: [{ id: "kitchen", label: "Design System", icon: Layers }],
  },
  {
    label: "DASHBOARDS",
    items: [
      { id: "mayor", label: "Mayor's Dashboard", icon: Briefcase },
      { id: "sp", label: "SP Secretary Dashboard", icon: Scale },
    ].filter(i => i.id === DEBUG_USER_ROLE),
  },
  {
    label: "OPERATIONS",
    items: [
      { id: "dts", label: "Document Tracking", icon: Activity },
      { id: "wms", label: "Approval Interface", icon: FileCheck },
      { id: "dms", label: "Document Repository", icon: Folder },
    ],
  },
  {
    label: "PUBLIC",
    items: [{ id: "portal", label: "Citizen Portal", icon: Globe }],
  },
]

export const Sidebar = ({ page, setPage, collapsed, setCollapsed }) => (
  <div className={`sidebar-bg flex flex-col flex-shrink-0 transition-all duration-200 ${collapsed ? "w-16" : "w-64"}`} style={{ minHeight: "100vh" }}>
    <div className={`flex items-center gap-3 border-b border-opacity-20 border-white p-4 flex-shrink-0 ${collapsed ? "justify-center px-2" : ""}`}
      style={{ borderBottomColor: "rgba(255,255,255,0.15)" }}>
      <CitySeal size={collapsed ? 30 : 34} />
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight">City of Batac</p>
          <p className="text-xs leading-tight" style={{ color: "#86efac" }}>LGU Platform · v0.1</p>
        </div>
      )}
    </div>

    <nav className="flex-1 overflow-y-auto py-3">
      {navGroups.map(g => (
        <div key={g.label} className="mb-1">
          {!collapsed && (
            <p className="px-4 py-1.5 text-[10px] font-semibold tracking-widest" style={{ color: "#4ade80", opacity: 0.7 }}>
              {g.label}
            </p>
          )}
          {g.items.map(item => {
            const active = page === item.id
            const { icon: Icon } = item
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 py-2.5 text-sm transition-colors text-left nav-hover ${collapsed ? "justify-center px-2" : "px-4"} ${active ? "nav-active" : ""}`}
                style={{ color: active ? "white" : "rgba(255,255,255,0.65)" }}
              >
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && active && <span className="ml-auto w-1 h-4 rounded-full" style={{ backgroundColor: "#86efac" }} />}
              </button>
            )
          })}
        </div>
      ))}
    </nav>

    <div className="flex-shrink-0 p-3" style={{ borderTopColor: "rgba(255,255,255,0.15)", borderTopWidth: 1, borderTopStyle: "solid" }}>
      {!collapsed && (
        <div className="flex items-center gap-2.5 p-2 mb-2 rounded-lg cursor-pointer" style={{ transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 brand-btn">{DEBUG_USER_ROLE === "mayor" ? "MK" : "SP"}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{DEBUG_USER_ROLE === "mayor" ? "Mark Christian R. Chua" : "SP Secretary"}</p>
            <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{DEBUG_USER_ROLE === "mayor" ? "Mayor · City of Batac" : "Secretariat · City of Batac"}</p>
          </div>
        </div>
      )}
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs transition-colors"
        style={{ color: "rgba(255,255,255,0.5)" }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
        {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Collapse</span></>}
      </button>
    </div>
  </div>
)

export const TopBar = ({ title, subtitle }) => (
  <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0" style={{ minHeight: 52 }}>
    <div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-1">
      <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
        <Bell size={17} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
      </button>
      <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"><Settings size={17} /></button>
      <div className="h-7 w-px bg-gray-200 mx-1" />
      <div className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white brand-btn">MK</div>
        <ChevronDown size={13} className="text-gray-400" />
      </div>
    </div>
  </div>
)
