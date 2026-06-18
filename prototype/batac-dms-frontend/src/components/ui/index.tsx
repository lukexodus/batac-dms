import React from "react";
import { Globe, Building, Shield, Lock, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog";
import { Label } from "./label";

export const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", dot: string }> = {
  "Approved": { variant: "default", dot: "bg-white" },
  "Released": { variant: "default", dot: "bg-white" },
  "Completed": { variant: "default", dot: "bg-white" },
  "In Workflow": { variant: "secondary", dot: "bg-blue-500" },
  "Pending Approval": { variant: "secondary", dot: "bg-amber-500" },
  "In Committee": { variant: "secondary", dot: "bg-purple-500" },
  "For 1st Reading": { variant: "secondary", dot: "bg-violet-500" },
  "For 2nd Reading": { variant: "secondary", dot: "bg-violet-500" },
  "3rd Reading": { variant: "secondary", dot: "bg-indigo-500" },
  "VP Certification": { variant: "secondary", dot: "bg-blue-500" },
  "Under Investigation": { variant: "destructive", dot: "bg-white" },
  "Rejected": { variant: "destructive", dot: "bg-white" },
  "Draft": { variant: "outline", dot: "bg-gray-400" },
  "Archived": { variant: "outline", dot: "bg-gray-300" },
}

export const StatusBadge = ({ status }: { status: string }) => {
  const c = statusConfig[status] || { variant: "outline", dot: "bg-gray-400" }
  return (
    <Badge variant={c.variant} className="gap-1.5 px-2.5 py-0.5 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {status}
    </Badge>
  )
}

export const classConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", Icon: any }> = {
  "Public": { variant: "default", Icon: Globe },
  "Internal": { variant: "secondary", Icon: Building },
  "Confidential": { variant: "secondary", Icon: Shield },
  "Restricted": { variant: "destructive", Icon: Lock },
}

export const ClassificationBadge = ({ level }: { level: string }) => {
  const c = classConfig[level] || classConfig["Internal"]
  const { Icon } = c
  return (
    <Badge variant={c.variant} className="gap-1 px-2 py-0.5 whitespace-nowrap">
      <Icon size={12} />
      {level}
    </Badge>
  )
}

export const PriorityTag = ({ priority }: { priority: string }) => {
  if (priority === "normal" || !priority) return null
  return (
    <Badge variant={priority === "overdue" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 uppercase">
      {priority === "overdue" ? "OVERDUE" : "URGENT"}
    </Badge>
  )
}

export const Btn = ({ 
  children, variant = "primary", size = "md", icon: Icon, onClick, disabled, className = "", type = "button" 
}: any) => {
  let btnVariant: "default" | "secondary" | "destructive" | "outline" | "ghost" = "default";
  if (variant === "secondary") btnVariant = "secondary";
  if (variant === "danger") btnVariant = "destructive";
  if (variant === "warning") btnVariant = "destructive";
  if (variant === "ghost") btnVariant = "ghost";
  if (variant === "outline") btnVariant = "outline";

  let btnSize: "default" | "sm" | "lg" | "icon" = "default";
  if (size === "xs" || size === "sm") btnSize = "sm";
  if (size === "lg") btnSize = "lg";

  return (
    <Button type={type} variant={btnVariant} size={btnSize} onClick={onClick} disabled={disabled} className={className}>
      {Icon && <Icon className={children ? "mr-2 h-4 w-4" : "h-4 w-4"} />}
      {children}
    </Button>
  )
}

export const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color = "green" }: any) => {
  const colors: Record<string, string> = {
    green: "text-green-600 bg-green-100/50",
    amber: "text-amber-600 bg-amber-100/50",
    red: "text-red-600 bg-red-100/50",
    blue: "text-blue-600 bg-blue-100/50",
    purple: "text-purple-600 bg-purple-100/50",
  }
  const c = colors[color] || colors.green

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && (
          <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${c}`}>
            <Icon size={16} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend === "up" ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
            <span className={`text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-600"}`}>{trendValue}</span>
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const SectionHdr = ({ title, subtitle, action }: any) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {action}
  </div>
)

export const PageHdr = ({ title, subtitle, breadcrumb, actions }: any) => (
  <div className="mb-6">
    {breadcrumb && (
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
        {breadcrumb.map((item: string, i: number) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} />}
            <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>{item}</span>
          </span>
        ))}
      </nav>
    )}
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-base text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  </div>
)

export const Modal = ({ open, onClose, title, subtitle, width = "max-w-2xl", children }: any) => {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose?.()}>
      <DialogContent className={width === "max-w-2xl" ? "sm:max-w-[42rem]" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        <div className="py-2">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const FLabel = ({ children, required }: any) => (
  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
    {children}{required && <span className="text-destructive ml-0.5">*</span>}
  </Label>
)

export const FRow = ({ children, cols = 2 }: any) => (
  <div className={`grid gap-4 mb-4 ${cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-1"}`}>{children}</div>
)
