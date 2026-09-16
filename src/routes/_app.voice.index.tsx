import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Headphones, PhoneCall, Languages, UserPlus, Loader2, Phone } from "lucide-react";
import { formatRelative } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  get_recordings,
  get_quick_call_meta,
  post_quick_call_save,
  post_plivo_call,
  LIVE_CALL_STATUSES,
  server_get_data,
  server_post_json,
} from "@/components/ServiceConnection/serviceconnection"; // adjust import path to wherever serviceconnection.js actually lives

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface RecordingCustomer {
  id: number;
  name: string;
  phone_number: string;
}

interface RecordingRow {
  id: number;
  session_id: string;
  customer: RecordingCustomer | null;
  segment: { id: number; name: string } | null;
  agent: { id: number; name?: string } | null;
  status: string;
  final_intent_code: string;
  direction: string;
  started_at_ist: string | null;
  started_at_ist_date: string | null;
  started_at_ist_time: string | null;
  duration_seconds: number | null;
  quality_pct: number | null;
}

interface DealerMeta {
  id: number;
  name: string;
  branches: { id: number; name: string }[];
}

const LIVE_POLL_MS = 4000;
const COMPLETED_POLL_MS = 20000;

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function VoicePage() {
  const [live, setLive] = useState<RecordingRow[]>([]);
  const [completed, setCompleted] = useState<RecordingRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [completedLoading, setCompletedLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Live calls — polled. A call disappears from this list the moment its   */
  /* status moves out of initiated/ringing/ongoing (completed/failed/etc),  */
  /* since the next poll's filter simply won't include it anymore.         */
  /* ---------------------------------------------------------------------- */

  const fetchLive = useCallback(async () => {
    try {
      const res = await server_get_data(get_recordings, {
        status: LIVE_CALL_STATUSES,
        page_size: 50,
      });
      setLive(res?.results ?? []);
    } catch (err) {
      console.error("Failed to fetch live calls:", err);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Completed calls — first page, refreshed on a slower interval          */
  /* ---------------------------------------------------------------------- */

  const fetchCompleted = useCallback(async () => {
    try {
      const res = await server_get_data(get_recordings, {
        status: "completed",
        page_size: 25,
      });
      setCompleted(res?.results ?? []);
    } catch (err) {
      console.error("Failed to fetch completed calls:", err);
    } finally {
      setCompletedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    fetchCompleted();

    const liveTimer = setInterval(fetchLive, LIVE_POLL_MS);
    const completedTimer = setInterval(fetchCompleted, COMPLETED_POLL_MS);

    return () => {
      clearInterval(liveTimer);
      clearInterval(completedTimer);
    };
  }, [fetchLive, fetchCompleted]);

  return (
    <>
      <PageHeader
        title="AI Voice Calls"
        description="Live monitor, recordings, transcripts, and dispositions for every AI conversation."
      >
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
          <UserPlus className="size-4" />
          Add / Call customer
        </Button>
      </PageHeader>

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="live">
          <TabsList>
            <TabsTrigger value="live" className="gap-2">
              <span className="size-1.5 rounded-full bg-[color:var(--success)] animate-pulse" />
              Live ({live.length})
            </TabsTrigger>

            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>

            <TabsTrigger value="recordings">Recordings</TabsTrigger>
          </TabsList>

          {/* LIVE */}
          <TabsContent value="live" className="mt-4 space-y-2">
            {liveLoading && (
              <p className="text-sm text-muted-foreground">Loading live calls…</p>
            )}

            {!liveLoading && live.length === 0 && (
              <p className="text-sm text-muted-foreground">No live calls right now.</p>
            )}

            {live.map((c) => (
              <LiveCallCard key={c.session_id} call={c} />
            ))}
          </TabsContent>

          {/* COMPLETED */}
          <TabsContent value="completed" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead>Disposition</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {completedLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-6">
                          Loading completed calls…
                        </TableCell>
                      </TableRow>
                    )}

                    {!completedLoading && completed.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-6">
                          No completed calls yet.
                        </TableCell>
                      </TableRow>
                    )}

                    {completed.map((c) => (
                      <TableRow key={c.session_id}>
                        <TableCell>
                          <Link
                            to={`/voice/${c.session_id}`}
                            className="font-medium text-sm hover:text-primary"
                          >
                            {c.customer?.name || "Unknown"}
                          </Link>
                        </TableCell>

                        <TableCell className="text-sm">{c.segment?.name || "—"}</TableCell>

                        <TableCell>
                          <StatusBadge status={c.final_intent_code || c.status} />
                        </TableCell>

                        <TableCell className="text-sm tabular-nums">
                          {c.quality_pct != null ? `${c.quality_pct}%` : "—"}
                        </TableCell>

                        <TableCell className="text-xs tabular-nums">
                          {c.duration_seconds != null
                            ? `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s`
                            : "—"}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {c.started_at_ist ? formatRelative(c.started_at_ist) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECORDINGS */}
          <TabsContent value="recordings" className="mt-4">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Recordings library — searchable by customer, campaign, intent, or keyword.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddCallCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCalled={fetchLive}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Live call card                                                             */
/* -------------------------------------------------------------------------- */

function LiveCallCard({ call }: { call: RecordingRow }) {
  const name = call.customer?.name || call.customer?.phone_number || "Unknown";

  return (
    <Card>
      <CardContent className="py-3 space-y-3">
        <div className="flex items-center gap-4">
          <div className="size-10 rounded-full bg-[color:var(--success)]/15 grid place-items-center">
            <PhoneCall className="size-5 text-[color:var(--success)] animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2">
              {name}

              <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-secondary px-1.5 py-0.5 text-muted-foreground">
                <Languages className="size-3" />
                Bhopali Hindi
              </span>

              {call.agent?.name && (
                <span className="text-[10px] rounded-full bg-secondary px-1.5 py-0.5 text-muted-foreground">
                  {call.agent.name}
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              {call.segment?.name || "—"}
            </div>
          </div>

          {/* Audio waveform (purely decorative while a call is live) */}
          <div className="hidden md:flex items-center gap-0.5 h-8">
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="w-0.5 bg-[color:var(--success)] rounded-full animate-pulse"
                style={{
                  height: `${20 + Math.sin(i + Date.now() / 300) * 40 + Math.random() * 30}%`,
                  animationDelay: `${i * 40}ms`,
                }}
              />
            ))}
          </div>

          <StatusBadge status={call.status} />

          <Button size="sm" variant="outline" asChild>
            <Link to={`/voice/${call.session_id}`}>
              <Headphones className="size-4" />
              Listen
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Add / Call customer dialog                                                 */
/* -------------------------------------------------------------------------- */

function AddCallCustomerDialog({
  open,
  onOpenChange,
  onCalled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCalled: () => void;
}) {
  const [dealers, setDealers] = useState<DealerMeta[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dealerId, setDealerId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [submitting, setSubmitting] = useState<"add" | "call" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const metaLoaded = useRef(false);

  useEffect(() => {
    if (!open || metaLoaded.current) return;

    setMetaLoading(true);
    server_get_data(get_quick_call_meta)
      .then((res) => {
        setDealers(res?.dealers ?? []);
        metaLoaded.current = true;
      })
      .catch((err) => {
        console.error("Failed to load dealer/branch meta:", err);
        setError("Couldn't load dealers/branches. Try again.");
      })
      .finally(() => setMetaLoading(false));
  }, [open]);

  function resetForm() {
    setName("");
    setPhone("");
    setDealerId("");
    setBranchId("");
    setError(null);
    setSuccessMsg(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  const selectedDealer = dealers.find((d) => String(d.id) === dealerId);

  async function saveCustomer() {
    setError(null);

    if (!dealerId) {
      setError("Select a dealer.");
      return null;
    }

    const res = await server_post_json(post_quick_call_save, {
      name,
      phone_number: phone,
      dealer_id: Number(dealerId),
      branch_id: branchId ? Number(branchId) : undefined,
    });

    if (!res?.ok) {
      setError(res?.error || "Failed to save customer.");
      return null;
    }

    return res;
  }

  async function handleAdd() {
    setSubmitting("add");
    try {
      const res = await saveCustomer();
      if (res) {
        setSuccessMsg(`Saved ${res.name || res.phone_number}.`);
      }
    } catch (err) {
      console.error("Add customer failed:", err);
      setError("Something went wrong saving the customer.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCall() {
    setSubmitting("call");
    try {
      const saved = await saveCustomer();
      if (!saved) return;

      // NOTE: field names here are inferred (customer_id/phone_number/
      // dealer_id/branch_id) — confirm against views_voice.plivo_call's
      // actual body handling before relying on this in production.
      const callRes = await server_post_json(post_plivo_call, {
        customer_id: saved.customer_id,
        phone_number: saved.phone_number,
        dealer_id: Number(dealerId),
        branch_id: branchId ? Number(branchId) : undefined,
      });

      if (callRes?.ok === false) {
        setError(callRes?.error || "Call could not be placed.");
        return;
      }

      setSuccessMsg(`Calling ${saved.name || saved.phone_number}…`);
      onCalled();

      setTimeout(() => handleOpenChange(false), 900);
    } catch (err) {
      console.error("Call customer failed:", err);
      setError("Something went wrong placing the call.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add / Call customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vc-name">Name</Label>
            <Input
              id="vc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vc-phone">Phone number</Label>
            <Input
              id="vc-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              inputMode="numeric"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dealer</Label>
              <Select
                value={dealerId}
                onValueChange={(v) => {
                  setDealerId(v);
                  setBranchId("");
                }}
                disabled={metaLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dealer" />
                </SelectTrigger>
                <SelectContent>
                  {dealers.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select
                value={branchId}
                onValueChange={setBranchId}
                disabled={!selectedDealer}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {selectedDealer?.branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {successMsg && <p className="text-sm text-[color:var(--success)]">{successMsg}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleAdd}
            disabled={submitting !== null || !phone}
          >
            {submitting === "add" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Add only
          </Button>

          <Button onClick={handleCall} disabled={submitting !== null || !phone}>
            {submitting === "call" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Phone className="size-4" />
            )}
            Add &amp; call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}