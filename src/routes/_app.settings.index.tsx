import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";


type Choice = { value: string; label: string };

// Matches what GET api/provider-settings/ actually returns (views_admin.py's
// provider_settings) -- llm_provider/stt_provider, not llm_backend/stt_backend.
type ProviderSettingsResponse = {
  success: boolean;
  llm_provider: string;
  stt_provider: string;
  llm_choices: Choice[];
  stt_choices: Choice[];
  updated_at: string;
};

// function AiBackendTab() {
//   const [config, setConfig] = useState<ProviderSettingsResponse | null>(null);
//   const [llmProvider, setLlmProvider] = useState<string>("");
//   const [sttProvider, setSttProvider] = useState<string>("");
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [saved, setSaved] = useState(false);

//   useEffect(() => {
//     let cancelled = false;

//     async function load() {
//       setLoading(true);
//       setError(null);
//       try {
//         const data: ProviderSettingsResponse = await server_get_data(get_provider_settings);
//         if (cancelled) return;
//         setConfig(data);
//         setLlmProvider(data.llm_provider);
//         setSttProvider(data.stt_provider);
//       } catch (err) {
//         console.error("Failed to load provider settings:", err);
//         if (!cancelled) {
//           handleError("network");
//           setError("Failed to load AI backend settings.");
//         }
//       } finally {
//         if (!cancelled) setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   const isDirty =
//     config !== null && (llmProvider !== config.llm_provider || sttProvider !== config.stt_provider);

//   async function handleSave() {
//     setSaving(true);
//     setError(null);
//     setSaved(false);
//     try {
//       const data = await server_post_json(post_provider_settings, {
//         llm_provider: llmProvider,
//         stt_provider: sttProvider,
//       });
//       if (data?.success === false) throw new Error(data?.error || "Save failed");
//       setConfig((prev) => (prev ? { ...prev, llm_provider: llmProvider, stt_provider: sttProvider } : prev));
//       setSaved(true);
//       setTimeout(() => setSaved(false), 2500);
//     } catch (err) {
//       console.error("Failed to save provider settings:", err);
//       handleError("network");
//       setError("Failed to save AI backend settings.");
//     } finally {
//       setSaving(false);
//     }
//   }

//   if (loading) {
//     return (
//       <Card>
//         <CardContent className="pt-6 flex items-center gap-2 text-sm text-muted-foreground">
//           <Loader2 className="h-4 w-4 animate-spin" />
//           Loading backend configuration…
//         </CardContent>
//       </Card>
//     );
//   }

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle className="font-display">AI Backend</CardTitle>
//       </CardHeader>

//       <CardContent className="space-y-5 max-w-lg">
//         <p className="text-sm text-muted-foreground">
//           Switch which provider handles conversation (LLM) and speech-to-text (STT).
//           Changes apply immediately — no restart needed.
//         </p>

//         <div>
//           <Label>LLM setting</Label>
//           <Select value={llmProvider} onValueChange={setLlmProvider}>
//             <SelectTrigger className="mt-1">
//               <SelectValue placeholder="Select an LLM provider" />
//             </SelectTrigger>
//             <SelectContent>
//               {config?.llm_choices.map((choice) => (
//                 <SelectItem key={choice.value} value={choice.value}>
//                   {choice.label}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </div>

//         <div>
//           <Label>STT setting</Label>
//           <Select value={sttProvider} onValueChange={setSttProvider}>
//             <SelectTrigger className="mt-1">
//               <SelectValue placeholder="Select an STT provider" />
//             </SelectTrigger>
//             <SelectContent>
//               {config?.stt_choices.map((choice) => (
//                 <SelectItem key={choice.value} value={choice.value}>
//                   {choice.label}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </div>

//         {error && <p className="text-sm text-destructive">{error}</p>}

//         <div className="flex items-center gap-3">
//           <Button className="mt-1" onClick={handleSave} disabled={!isDirty || saving}>
//             {saving ? (
//               <>
//                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//                 Saving…
//               </>
//             ) : (
//               "Save"
//             )}
//           </Button>

//           {saved && (
//             <span className="flex items-center gap-1 text-sm text-green-600 mt-1">
//               <CheckCircle2 className="h-4 w-4" />
//               Saved
//             </span>
//           )}
//         </div>

//         {config && (
//           <p className="text-xs text-muted-foreground">
//             Last updated {new Date(config.updated_at).toLocaleString()}
//           </p>
//         )}
//       </CardContent>
//     </Card>
//   );
// }

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace, AI voices, business hours, and provider keys."
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="company" orientation="vertical">
          <div className="grid lg:grid-cols-[200px_1fr] gap-6">
            <TabsList className="flex-col h-auto items-stretch bg-transparent p-0 gap-1">
              {[
                "company",
                "branches",
                "voices",
                "hours",
                "languages",
                "api",
                "whatsapp",
                "telephony",
              ].map((k) => (
                <TabsTrigger
                  key={k}
                  value={k}
                  className="justify-start capitalize data-[state=active]:bg-accent"
                >
                  {k}
                </TabsTrigger>
              ))}
            </TabsList>

            <div>
              {/* Company */}
              <TabsContent value="company">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display">Company</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-3 max-w-lg">
                    <div>
                      <Label>Company name</Label>

                      <Input className="mt-1" defaultValue="Om Honda" />
                    </div>

                    <div>
                      <Label>Display name</Label>

                      <Input className="mt-1" defaultValue="Om Honda — Bhopal" />
                    </div>

                    <div>
                      <Label>Primary contact</Label>

                      <Input className="mt-1" defaultValue="Priya Mehta" />
                    </div>

                    <Button className="mt-2">Save</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Branches */}
              <TabsContent value="branches">
                <Card>
                  <CardContent className="pt-6 space-y-2">
                    {["MP Nagar", "Kolar Road", "Ayodhya Bypass"].map((b) => (
                      <div
                        key={b}
                        className="flex items-center justify-between border rounded-md p-3"
                      >
                        <span className="text-sm font-medium">{b}</span>

                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Voices */}
              <TabsContent value="voices">
                <Card>
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Clone, preview, and assign AI voices per campaign.
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Business Hours */}
              <TabsContent value="hours">
                <Card>
                  <CardContent className="pt-6 space-y-3 max-w-md">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                      <div key={d} className="flex items-center justify-between border-b pb-2">
                        <span className="text-sm w-12">{d}</span>

                        <div className="flex items-center gap-2 text-sm">
                          <Input className="w-24 h-8" defaultValue="09:00" />

                          <span>to</span>

                          <Input
                            className="w-24 h-8"
                            defaultValue={d === "Sun" ? "off" : "19:00"}
                          />
                        </div>

                        <Switch defaultChecked={d !== "Sun"} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Languages */}
              <TabsContent value="languages">
                <Card>
                  <CardContent className="pt-6 text-sm">
                    Hindi, English, Hinglish enabled.
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI Backend */}
              {/* <TabsContent value="ai-backend">
                <AiBackendTab />
              </TabsContent> */}

              {/* API */}
              <TabsContent value="api">
                <Card>
                  <CardContent className="pt-6 space-y-3 max-w-lg">
                    <div>
                      <Label>API Key</Label>

                      <Input
                        className="mt-1 font-mono"
                        type="password"
                        defaultValue="trio_sk_om_honda_2026_•••••"
                      />
                    </div>

                    <Button size="sm" variant="outline">
                      Rotate key
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* WhatsApp */}
              <TabsContent value="whatsapp">
                <Card>
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    BSP credentials, sender numbers, template approval status.
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Telephony */}
              <TabsContent value="telephony">
                <Card>
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Caller IDs, DID rotation, recording storage.
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </>
  );
}