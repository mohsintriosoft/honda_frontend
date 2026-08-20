import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/settings/")({
  head: () => ({ meta: [{ title: "Settings — Triosoft" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Workspace, AI voices, business hours, and provider keys." />
      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="company" orientation="vertical">
          <div className="grid lg:grid-cols-[200px_1fr] gap-6">
            <TabsList className="flex-col h-auto items-stretch bg-transparent p-0 gap-1">
              {["company","branches","voices","hours","languages","api","whatsapp","telephony"].map((k) => (
                <TabsTrigger key={k} value={k} className="justify-start capitalize data-[state=active]:bg-accent">{k}</TabsTrigger>
              ))}
            </TabsList>

            <div>
              <TabsContent value="company">
                <Card><CardHeader><CardTitle className="font-display">Company</CardTitle></CardHeader>
                  <CardContent className="space-y-3 max-w-lg">
                    <div><Label>Company name</Label><Input className="mt-1" defaultValue="Om Honda" /></div>
                    <div><Label>Display name</Label><Input className="mt-1" defaultValue="Om Honda — Bhopal" /></div>
                    <div><Label>Primary contact</Label><Input className="mt-1" defaultValue="Priya Mehta" /></div>
                    <Button className="mt-2">Save</Button>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="branches">
                <Card><CardContent className="pt-6 space-y-2">
                  {["MP Nagar","Kolar Road","Ayodhya Bypass"].map((b) => (
                    <div key={b} className="flex items-center justify-between border rounded-md p-3">
                      <span className="text-sm font-medium">{b}</span>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                  ))}
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="voices">
                <Card><CardContent className="pt-6 text-sm text-muted-foreground">Clone, preview, and assign AI voices per campaign.</CardContent></Card>
              </TabsContent>
              <TabsContent value="hours">
                <Card><CardContent className="pt-6 space-y-3 max-w-md">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                    <div key={d} className="flex items-center justify-between border-b pb-2">
                      <span className="text-sm w-12">{d}</span>
                      <div className="flex items-center gap-2 text-sm">
                        <Input className="w-24 h-8" defaultValue="09:00" />
                        <span>to</span>
                        <Input className="w-24 h-8" defaultValue={d === "Sun" ? "off" : "19:00"} />
                      </div>
                      <Switch defaultChecked={d !== "Sun"} />
                    </div>
                  ))}
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="languages">
                <Card><CardContent className="pt-6 text-sm">Hindi, English, Hinglish enabled.</CardContent></Card>
              </TabsContent>
              <TabsContent value="api">
                <Card><CardContent className="pt-6 space-y-3 max-w-lg">
                  <div><Label>API Key</Label>
                    <Input className="mt-1 font-mono" type="password" defaultValue="trio_sk_om_honda_2026_•••••" /></div>
                  <Button size="sm" variant="outline">Rotate key</Button>
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="whatsapp">
                <Card><CardContent className="pt-6 text-sm text-muted-foreground">BSP credentials, sender numbers, template approval status.</CardContent></Card>
              </TabsContent>
              <TabsContent value="telephony">
                <Card><CardContent className="pt-6 text-sm text-muted-foreground">Caller IDs, DID rotation, recording storage.</CardContent></Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </>
  );
}
