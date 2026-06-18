import React from 'react';
import {
  Layers, Briefcase, Scale, Activity, FileCheck, Folder, Globe,
  Bell, Settings, ChevronDown, LogOut
} from 'lucide-react';

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAppStore } from "@/store/useAppStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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
    
    /* Variables overridden for Shadcn Sidebar */
    :root {
      --sidebar-background: 144 65% 15%; /* #0D3D20 */
      --sidebar-foreground: 0 0% 100%;
      --sidebar-primary: 149 100% 33%; /* #00A651 */
      --sidebar-primary-foreground: 0 0% 100%;
      --sidebar-accent: 142 61% 26%; /* #1A6B35 */
      --sidebar-accent-foreground: 0 0% 100%;
      --sidebar-border: 144 65% 20%;
      --sidebar-ring: 149 100% 33%;
    }
    
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

const starPoints = (cx: number, cy: number, rOuter: number, rInner: number) => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(" ")
}

export const CitySeal = ({ size = 40 }: { size?: number }) => (
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

export const CitySealOfficial = ({ size = 56, className = "" }: { size?: number, className?: string }) => (
  <img
    src="/assets/city-seal-official.jpg"
    alt="Official Seal of the City of Batac, Ilocos Norte"
    width={size}
    height={size}
    className={`rounded-full flex-shrink-0 ${className}`}
    style={{ width: size, height: size, objectFit: "contain" }}
  />
)

export const QRDisplay = ({ size = 80 }: { size?: number }) => {
  const N = 21
  const cs = size / N
  const isBlack = (r: number, c: number) => {
    const inTL = r < 7 && c < 7
    const inTR = r < 7 && c >= 14
    const inBL = r >= 14 && c < 7
    const finder = (rr: number, cc: number) => (rr === 0 || rr === 6 || cc === 0 || cc === 6) || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4)
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

export const DEBUG_USER_ROLE = "sp"; // "mayor" or "sp"

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

export const Sidebar = () => {
  const { page, setPage, userRole } = useAppStore();
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === "collapsed" && !isMobile

  const handleNav = (id: string) => {
    setPage(id)
  }

  return (
    <ShadcnSidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 flex flex-row items-center gap-3 border-b border-sidebar-border h-[65px]">
        <CitySeal size={isCollapsed ? 28 : 34} />
        {!isCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground leading-tight">City of Batac</span>
            <span className="text-xs text-sidebar-primary-foreground/80 leading-tight font-medium">LGU Platform · v0.1</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="py-3">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="pt-0 pb-2">
            <SidebarGroupLabel className="text-sidebar-primary-foreground/70 text-[10px] tracking-widest font-semibold px-4 mb-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = page === item.id
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton 
                        isActive={isActive}
                        onClick={() => setPage(item.id)}
                        tooltip={item.label}
                        className={`h-10 text-sidebar-foreground/80 ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : ""}`}
                      >
                        <item.icon className="h-[18px] w-[18px]" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full h-auto p-2 justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
                <AvatarFallback className="bg-transparent">{DEBUG_USER_ROLE === "mayor" ? "MK" : "SP"}</AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex flex-col items-start ml-2 min-w-0">
                  <span className="text-xs font-semibold truncate w-full">
                    {DEBUG_USER_ROLE === "mayor" ? "Mark Christian R. Chua" : "SP Secretary"}
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/60 truncate w-full">
                    {DEBUG_USER_ROLE === "mayor" ? "Mayor · City of Batac" : "Secretariat · City of Batac"}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="right" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{DEBUG_USER_ROLE === "mayor" ? "Mark Christian R. Chua" : "SP Secretary"}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {DEBUG_USER_ROLE === "mayor" ? "mayor@batac.gov.ph" : "sp@batac.gov.ph"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPage("login")}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  )
}

export const TopBar = ({ title, subtitle }: { title: string, subtitle?: string }) => {
  return (
    <header className="sticky top-0 z-10 flex h-[65px] shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-2 h-9 w-9 text-muted-foreground hover:bg-muted" />
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">{title}</h1>
          {subtitle && <span className="text-xs text-muted-foreground font-medium">{subtitle}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-muted h-9 w-9">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>
        <div className="h-6 w-px bg-border mx-1.5" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="pl-2 pr-2 h-9 gap-2 hover:bg-muted">
              <div className="h-6 w-6 rounded-full bg-[#00A651] text-white flex items-center justify-center text-[10px] font-bold">
                {DEBUG_USER_ROLE === "mayor" ? "MK" : "SP"}
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
             <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Account Settings</span>
             </DropdownMenuItem>
             <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
             </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
