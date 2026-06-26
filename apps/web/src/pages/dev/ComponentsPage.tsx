import React from "react";
import { Navigate } from "react-router-dom";
import { FileText } from "lucide-react";
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarName,
} from "@batac/ui";

const COLORS = {
  primary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  neutral: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  success: [100, 300, 500, 900],
  danger: [50, 100, 200, 500, 700, 900],
  warning: [100, 500, 900],
  info: [100, 500, 900],
};

const TYPOGRAPHY = [
  { class: "text-2xl font-bold text-text-primary", label: "page heading" },
  { class: "text-xl font-semibold", label: "section heading" },
  { class: "text-base", label: "body" },
  { class: "text-sm", label: "body small / default app body" },
  { class: "text-sm text-text-secondary", label: "helper text" },
  { class: "text-xs text-text-muted", label: "caption" },
  { class: "font-mono text-xs font-medium", label: "document number, final" },
  { class: "font-mono text-xs font-medium italic text-text-secondary", label: "document number, preliminary" },
  { class: "font-mono text-xs text-text-muted", label: "timestamp" },
  { class: "text-3xl font-bold", label: "dashboard metric" },
  { class: "text-xs font-semibold uppercase tracking-wide text-text-muted", label: "dashboard metric label" },
];

export default function ComponentsPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 space-y-16 max-w-7xl mx-auto">


      <h1 className="text-2xl font-bold text-text-primary">Design System & Components</h1>
      
      {/* 1. Token System */}
      <section className="space-y-8">
        <h2 className="text-xl font-semibold border-b pb-2">Token System</h2>
        
        <div className="space-y-6">
          {Object.entries(COLORS).map(([colorName, steps]) => (
            <div key={colorName}>
              <h3 className="capitalize font-medium mb-2">{colorName}</h3>
              <div className="flex flex-wrap gap-4">
                {steps.map((step) => (
                  <div key={step} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-10 h-10 rounded shadow-sm bg-${colorName}-${step}`}
                      title={`bg-${colorName}-${step}`}
                    ></div>
                    <span className="font-mono text-xs text-text-muted">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 pt-6">
          <h3 className="font-medium mb-4 border-b pb-2">Typography</h3>
          {TYPOGRAPHY.map((type, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-4 border-b border-border/50 pb-2">
              <div className={type.class}>The quick brown fox jumps over the lazy dog.</div>
              <div className="font-mono text-xs text-text-muted">{type.class} <br/> ({type.label})</div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Button */}
      <section className="space-y-8">
        <h2 className="text-xl font-semibold border-b pb-2">Button</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-2 font-medium">Variant \ Size</th>
                {["xs", "sm", "default", "lg", "icon", "icon-sm"].map(size => <th key={size} className="p-2 font-medium">{size}</th>)}
              </tr>
            </thead>
            <tbody>
              {["default", "primary", "secondary", "destructive", "ghost", "ghost-danger", "link", "outline"].map(variant => (
                <React.Fragment key={variant}>
                  {/* Without Icon */}
                  <tr>
                    <td className="p-2 border-t font-mono text-xs">{variant}</td>
                    {(["xs", "sm", "default", "lg", "icon", "icon-sm"] as const).map(size => (
                      <td key={size} className="p-2 border-t">
                        <Button variant={variant as any} size={size}>
                          {size.includes("icon") ? <FileText /> : "Button"}
                        </Button>
                      </td>
                    ))}
                  </tr>
                  {/* With Icon (skip on icon sizes to avoid duplicate visual) */}
                  <tr>
                    <td className="p-2 font-mono text-xs text-text-muted">{variant} + icon</td>
                    {(["xs", "sm", "default", "lg", "icon", "icon-sm"] as const).map(size => (
                      <td key={size} className="p-2">
                        <Button variant={variant as any} size={size}>
                          <FileText />
                          {!size.includes("icon") && "Button"}
                        </Button>
                      </td>
                    ))}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex gap-4 mt-8">
          <Button variant="default" disabled>Default Disabled</Button>
          <Button variant="destructive" disabled>Destructive Disabled</Button>
        </div>
      </section>

      {/* 3. Tabs */}
      <section className="space-y-8">
        <h2 className="text-xl font-semibold border-b pb-2">Tabs</h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="font-medium mb-4">Default (Pill)</h3>
            <Tabs defaultValue="tab1" className="w-[400px]">
              <TabsList>
                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                <TabsTrigger value="tab3">Tab 3</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1">Content 1</TabsContent>
              <TabsContent value="tab2">Content 2</TabsContent>
              <TabsContent value="tab3">Content 3</TabsContent>
            </Tabs>
          </div>

          <div>
            <h3 className="font-medium mb-4">Underline Variant</h3>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList variant="underline">
                <TabsTrigger variant="underline" value="overview">Overview</TabsTrigger>
                <TabsTrigger variant="underline" value="workflow">Workflow</TabsTrigger>
                <TabsTrigger variant="underline" value="history">History</TabsTrigger>
                <TabsTrigger variant="underline" value="attachments">Attachments</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="p-4 bg-neutral-50 rounded">Overview Content</TabsContent>
              <TabsContent value="workflow" className="p-4 bg-neutral-50 rounded">Workflow Content</TabsContent>
              <TabsContent value="history" className="p-4 bg-neutral-50 rounded">History Content</TabsContent>
              <TabsContent value="attachments" className="p-4 bg-neutral-50 rounded">Attachments Content</TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* 4. Avatar */}
      <section className="space-y-8">
        <h2 className="text-xl font-semibold border-b pb-2">Avatar / AvatarName</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-medium mb-4">AvatarImage</h3>
            <div className="flex items-center gap-4">
              <Avatar size="sm"><AvatarImage src="https://github.com/shadcn.png" /><AvatarFallback>CN</AvatarFallback></Avatar>
              <Avatar size="md"><AvatarImage src="https://github.com/shadcn.png" /><AvatarFallback>CN</AvatarFallback></Avatar>
              <Avatar size="lg"><AvatarImage src="https://github.com/shadcn.png" /><AvatarFallback>CN</AvatarFallback></Avatar>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-4">AvatarName</h3>
            <div className="space-y-6">
              {[
                "Gladys R. Lagura", 
                "Mark Christian R. Chua", 
                "Albert D. Chua",
                "Bernadine D. Nalupta",
                "Emmerson T. Chua",
                "Marlon N. Pungtilan"
              ].map(name => (
                <div key={name} className="flex items-center gap-6">
                  <span className="w-48 font-medium">{name}</span>
                  <AvatarName size="sm" name={name} />
                  <AvatarName size="md" name={name} />
                  <AvatarName size="lg" name={name} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
