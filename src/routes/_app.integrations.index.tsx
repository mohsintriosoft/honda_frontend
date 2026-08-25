import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Phone, MessageSquare, Webhook, CheckCircle2 } from "lucide-react";

const integrations = [
  {
    name: "Honda DMS",
    icon: Database,
    status: "connected",
    desc: "Customer, vehicle, service, insurance, AMC sync every 15 min.",
  },
  {
    name: "Telephony (Exotel)",
    icon: Phone,
    status: "connected",
    desc: "Outbound AI calls, recordings, and DTMF capture.",
  },
  {
    name: "WhatsApp BSP (Gupshup)",
    icon: MessageSquare,
    status: "connected",
    desc: "Two-way messaging via Meta-approved templates.",
  },
  {
    name: "Custom Webhooks",
    icon: Webhook,
    status: "available",
    desc: "Push events to your DMS, CRM, or BI tools.",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect your DMS, telephony, and WhatsApp providers."
      />

      <div className="p-4 md:p-6 lg:p-8 grid gap-3 md:grid-cols-2">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isConnected = integration.status === "connected";

          return (
            <Card key={integration.name}>
              <CardContent className="pt-5 flex gap-4">
                <div className="size-11 rounded-lg bg-primary/10 grid place-items-center text-primary">
                  <Icon className="size-5" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-display font-semibold">{integration.name}</div>

                    {isConnected && (
                      <span className="text-[10px] rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)] px-2 py-0.5 flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        Connected
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">{integration.desc}</p>

                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant={isConnected ? "outline" : "default"}>
                      {isConnected ? "Configure" : "Connect"}
                    </Button>

                    {isConnected && (
                      <Button size="sm" variant="ghost">
                        Logs
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
