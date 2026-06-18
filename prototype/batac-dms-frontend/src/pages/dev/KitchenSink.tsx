import React from 'react';
import { 
  Check, RotateCcw, Download, Printer, Eye, XCircle, 
  CheckCircle, AlertTriangle, AlertCircle, Inbox, Search 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Define a custom page header for the kitchen sink until we build the real layout
const PageHdr = ({ title, subtitle, breadcrumb }: { title: string, subtitle: string, breadcrumb: string[] }) => (
  <div className="mb-6">
    <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
      {breadcrumb.join(' / ')}
    </div>
    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
  </div>
);

export const KitchenSinkPage = () => (
  <div className="p-6 max-w-5xl">
    <PageHdr title="Design System" subtitle="Batac City LGU Platform — shadcn/ui Conversion v1"
      breadcrumb={["Prototype", "Design System"]} />

    {/* Color Palette */}
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Color Palette</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Brand Primary</p>
          <div className="flex gap-2 flex-wrap">
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg mb-1 bg-primary" />
              <p className="text-[9px] text-muted-foreground">Primary</p>
            </div>
          </div>
        </div>
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Semantic Status</p>
          <div className="flex flex-wrap gap-3">
            {[["Success", "var(--status-approved)"], ["Warning", "var(--status-archived)"], ["Danger", "var(--status-rejected)"], ["Info", "var(--status-filed)"]].map(([name, bg]) => (
              <div key={name} className="flex items-center gap-2">
                <div style={{ backgroundColor: `hsl(${bg})` }} className="w-7 h-7 rounded-lg" />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Typography */}
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Typography</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 divide-y divide-gray-50">
          {[
            ["Display · 36px Bold", "text-4xl font-bold text-foreground", "City of Batac LGU Platform"],
            ["Heading XL · 24px Bold", "text-2xl font-bold text-foreground", "Document Management System"],
            ["Heading LG · 20px Semibold", "text-xl font-semibold text-foreground", "SP Secretary's Dashboard"],
            ["Heading MD · 16px Semibold", "text-base font-semibold text-foreground", "Pending Signatures Queue"],
            ["Body · 14px Regular", "text-sm text-muted-foreground", "Resolution No. 7SP 2026-047 has been certified."],
            ["Small · 12px Regular", "text-xs text-muted-foreground", "Submitted by Engr. Santos · 1d in queue"],
            ["Mono · Tracking Number", "font-mono text-sm text-primary font-medium", "DTS-2026-000045"],
          ].map(([label, cls, sample]) => (
            <div key={label} className="flex items-baseline gap-4 pt-3 first:pt-0">
              <span className="text-[10px] text-muted-foreground w-40 flex-shrink-0">{label}</span>
              <span className={cls}>{sample}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Buttons */}
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Buttons</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="default">Primary Action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Reject Document</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="default"><Check className="mr-2 h-4 w-4" /> Approve</Button>
          <Button variant="destructive"><XCircle className="mr-2 h-4 w-4" /> Reject</Button>
          <Button variant="outline"><RotateCcw className="mr-2 h-4 w-4" /> Return for Revision</Button>
          <Button variant="secondary"><Download className="mr-2 h-4 w-4" /> Download</Button>
          <Button variant="secondary"><Printer className="mr-2 h-4 w-4" /> Print Cover Sheet</Button>
          <Button variant="secondary"><Eye className="mr-2 h-4 w-4" /> View</Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </CardContent>
    </Card>

    {/* Badges */}
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Status Badges</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {["Approved", "Pending Approval", "Draft", "Rejected"].map(s => (
            <Badge key={s} variant="outline">{s}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Alerts */}
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="default" className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4 !text-green-600" />
          <AlertTitle>Document Approved</AlertTitle>
          <AlertDescription>Resolution No. 7SP 2026-047 has been approved.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>SLA Breach</AlertTitle>
          <AlertDescription>Leave Application has exceeded the 3-day limit.</AlertDescription>
        </Alert>
        <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4 !text-amber-600" />
          <AlertTitle>SLA Warning</AlertTitle>
          <AlertDescription>Purchase Request is approaching its deadline.</AlertDescription>
        </Alert>
        <Alert variant="default" className="border-blue-200 bg-blue-50 text-blue-800">
          <Inbox className="h-4 w-4 !text-blue-600" />
          <AlertTitle>Review Period</AlertTitle>
          <AlertDescription>Ordinance requires executive action before June 14.</AlertDescription>
        </Alert>
      </CardContent>
    </Card>

    {/* Forms */}
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Form Elements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Text Input</label>
            <Input placeholder="Enter document title..." />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Date Input</label>
            <Input type="date" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Select</label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="All Document Types" />
              </SelectTrigger>
              <SelectContent>
                {["All Document Types", "SP Resolution", "SP Ordinance", "Travel Order", "Purchase Request"].map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input placeholder="Search tracking numbers, titles..." className="pl-9" />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Comment <span className="text-destructive">*</span>
            </label>
            <Textarea placeholder="State your reason..." />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);
