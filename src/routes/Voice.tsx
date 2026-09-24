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
import {
  PhoneCall,
  PhoneOff,
  Languages,
  UserPlus,
  Loader2,
  Phone,
  Search,
  Volume2,
  VolumeX,
} from "lucide-react";
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
  get_segments,
  get_quick_vehicle_customer_lookup,
  post_quick_vehicle_save,
  post_plivo_call,
  LIVE_CALL_STATUSES,
  server_get_data,
  server_post_json,
  post_plivo_end_call,
  getListenWsUrl2,
} from "@/components/ServiceConnection/serviceconnection";

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
  agent: { id: number; persona_name?: string; agent_name?: string; module?: string } | null;
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

function apiErrorMessage(err: any, fallback: string) {
  if (err?.response?.status === 403) return "You don't have permission to do this.";
  const data = err?.response?.data;
  return data?.error || fallback;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function VoicePage() {
  const [live, setLive] = useState<RecordingRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchLive = useCallback(async () => {
    try {
      const res = await server_get_data(get_recordings, {
        status: LIVE_CALL_STATUSES,
        page_size: 50,
      });
      setLive(res?.results ?? []);
      setLiveError(null);
    } catch (err) {
      console.error("Failed to fetch live calls:", err);
      setLiveError(apiErrorMessage(err, "Couldn't load live calls."));
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const liveTimer = setInterval(fetchLive, LIVE_POLL_MS);
    return () => clearInterval(liveTimer);
  }, [fetchLive]);

  return (
    <>
      <PageHeader
        title="AI Voice Calls"
        description="Live monitor, recordings, transcripts, and dispositions for every AI conversation."
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
            <UserPlus className="size-4" />
            Add / Call customer
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="live">
          <TabsList>
            <TabsTrigger value="live" className="gap-2">
              <span className="size-1.5 rounded-full bg-[color:var(--success)] animate-pulse" />
              Live ({live.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-4 space-y-2">
            {liveLoading && <p className="text-sm text-muted-foreground">Loading live calls…</p>}

            {!liveLoading && liveError && <p className="text-sm text-destructive">{liveError}</p>}

            {!liveLoading && !liveError && live.length === 0 && (
              <p className="text-sm text-muted-foreground">No live calls right now.</p>
            )}

            {live.map((c) => (
              <LiveCallCard key={c.session_id} call={c} onEnded={fetchLive} />
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <AddCallCustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} onCalled={fetchLive} />
    </>
  );
}

function scheduleLivePcmFrame(
  ctx: AudioContext,
  cursors: { user: number; bot: number },
  source: "user" | "bot",
  sampleRate: number,
  base64Payload: string,
) {
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

  if (float32.length === 0) return;

  const buffer = ctx.createBuffer(1, float32.length, sampleRate);
  buffer.getChannelData(0).set(float32);

  const node = ctx.createBufferSource();
  node.buffer = buffer;
  node.connect(ctx.destination);

  const startAt = Math.max(cursors[source], ctx.currentTime);
  node.start(startAt);
  cursors[source] = startAt + buffer.duration;
}

function useLiveAudioListener(sessionId: string) {
  const [listening, setListening] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const cursorsRef = useRef({ user: 0, bot: 0 });

  function stop() {
    wsRef.current?.close();
    wsRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setListening(false);
    setConnecting(false);
  }

  function start() {
    setError(null);
    setConnecting(true);

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    cursorsRef.current = { user: ctx.currentTime, bot: ctx.currentTime };

    const ws = new WebSocket(getListenWsUrl2(sessionId));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnecting(false);
      setListening(true);
    };
    ws.onerror = () => {
      setError("Couldn't connect to the live audio stream.");
    };
    ws.onclose = (evt) => {
      setListening(false);
      setConnecting(false);
      const messages: Record<number, string> = {
        4500: "Live audio isn't configured on the server yet (CHANNEL_LAYERS missing).",
        4401: "Your session has expired — sign in again to listen.",
        4403: "Your role can't monitor live calls.",
        4404: "This call is no longer available to monitor.",
      };
      if (messages[evt.code]) setError(messages[evt.code]);
    };
    ws.onmessage = (evt) => {
      try {
        const { source, sample_rate, payload } = JSON.parse(evt.data);
        if (ctxRef.current && (source === "user" || source === "bot")) {
          scheduleLivePcmFrame(ctxRef.current, cursorsRef.current, source, sample_rate, payload);
        }
      } catch (err) {
        console.error("Bad live audio frame:", err);
      }
    };
  }

  function toggle() {
    if (listening || connecting) stop();
    else start();
  }

  useEffect(() => stop, []);

  return { listening, connecting, error, toggle };
}

function LiveCallCard({ call, onEnded }: { call: RecordingRow; onEnded: () => void }) {
  const name = call.customer?.name || call.customer?.phone_number || "Unknown";

  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  const {
    listening,
    connecting,
    error: listenError,
    toggle: toggleListen,
  } = useLiveAudioListener(call.session_id);

  async function handleEndCall() {
    const confirmed = window.confirm(
      `End the live call with ${name} now? This hangs up immediately.`,
    );
    if (!confirmed) return;

    setEnding(true);
    setEndError(null);

    try {
      const res = await server_post_json(post_plivo_end_call, {
        session_id: call.session_id,
      });
      if (!res?.success) {
        setEndError(res?.error || "Couldn't end this call.");
      }
    } catch (err) {
      console.error("Failed to end call:", err);
      setEndError(apiErrorMessage(err, "Something went wrong ending this call."));
    } finally {
      setEnding(false);
      onEnded();
    }
  }

  return (
    <Card>
      <CardContent className="py-3 space-y-2">
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

              {(call.agent?.persona_name || call.agent?.agent_name) && (
                <span className="text-[10px] rounded-full bg-secondary px-1.5 py-0.5 text-muted-foreground">
                  {call.agent.persona_name || call.agent.agent_name}
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground">{call.segment?.name || "—"}</div>
          </div>

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

          <Button
            size="sm"
            variant={listening ? "default" : "outline"}
            onClick={toggleListen}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : listening ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
            {listening ? "Stop" : "Listen live"}
          </Button>

          <Button size="sm" variant="destructive" onClick={handleEndCall} disabled={ending}>
            {ending ? <Loader2 className="size-4 animate-spin" /> : <PhoneOff className="size-4" />}
            End call
          </Button>
        </div>

        {(endError || listenError) && (
          <p className="text-xs text-destructive pl-14">{endError || listenError}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Recordings library (tab currently not rendered)                            */
/* -------------------------------------------------------------------------- */

const RECORDING_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
  { value: "declined", label: "Declined" },
  { value: "ringing", label: "Ringing" },
  { value: "ongoing", label: "Ongoing" },
];

const RECORDINGS_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

function RecordingsLibraryTab() {
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const requestSeq = useRef(0);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (pageToLoad: number, filters: { search: string; status: string }, append: boolean) => {
      const seq = ++requestSeq.current;
      append ? setLoadingMore(true) : setLoading(true);

      try {
        const res = await server_get_data(get_recordings, {
          page: pageToLoad,
          page_size: RECORDINGS_PAGE_SIZE,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        });

        if (seq !== requestSeq.current) return;

        const results: RecordingRow[] = res?.results ?? [];
        setRows((prev) => (append ? [...prev, ...results] : results));
        setHasMore(Boolean(res?.next));
        setCount(res?.count ?? results.length);
        setPage(pageToLoad);
      } catch (err) {
        console.error("Failed to fetch recordings:", err);
        if (!append) setRows([]);
      } finally {
        if (seq === requestSeq.current) {
          append ? setLoadingMore(false) : setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    fetchPage(1, { search, status }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchPage(1, { search: value, status }, false);
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleLoadMore() {
    fetchPage(page + 1, { search, status }, true);
  }

  const hasFilters = Boolean(search || status);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by customer name or phone…"
              className="pl-8"
            />
          </div>

          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {RECORDING_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-6">
                  Loading recordings…
                </TableCell>
              </TableRow>
            )}

            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-6">
                  {hasFilters ? "No recordings match your filters." : "No recordings yet."}
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              rows.map((r) => (
                <TableRow key={r.session_id}>
                  <TableCell>
                    <Link to={`/voice/${r.id}`} className="font-medium text-sm hover:text-primary">
                      {r.customer?.name || r.customer?.phone_number || "Unknown"}
                    </Link>
                  </TableCell>

                  <TableCell className="text-sm">{r.segment?.name || "—"}</TableCell>

                  <TableCell>
                    {r.final_intent_code ? (
                      <StatusBadge status={r.final_intent_code} />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>

                  <TableCell className="text-xs tabular-nums">
                    {r.duration_seconds != null
                      ? `${Math.floor(r.duration_seconds / 60)}m ${r.duration_seconds % 60}s`
                      : "—"}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {r.started_at_ist ? formatRelative(r.started_at_ist) : "—"}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {!loading && hasMore && (
          <div className="flex justify-center py-3 border-t">
            <Button size="sm" variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore && <Loader2 className="size-4 animate-spin" />}
              Load more ({rows.length} of {count})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Add / Call customer dialog                                                 */
/* -------------------------------------------------------------------------- */

interface SegmentOption {
  id: number;
  name: string;
}

interface VehicleHit {
  id: number;
  vehicle_name: string;
  vehicle_model: string;
  registration_no: string;
}

interface FoundCustomer {
  id: number;
  name: string | null;
  phone_number: string;
  dealer_id: number | null;
  dealer: string | null;
  default_branch_id: number | null;
  default_branch: string | null;
  vehicles: VehicleHit[];
}

const PHONE_RE = /^[6-9]\d{9}$/;
const NAME_RE = /^[A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F .'-]*$/;

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
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dealerId, setDealerId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");

  const [vehicleName, setVehicleName] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [segmentId, setSegmentId] = useState<string>("");

  const [foundCustomer, setFoundCustomer] = useState<FoundCustomer | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ kind: "ok" | "info" | "err"; text: string } | null>(
    null,
  );

  const [submitting, setSubmitting] = useState<"call" | "quickcall" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const metaLoaded = useRef(false);

  // The dealer list is scoped to the caller's own dealer -- with one entry
  // there's nothing to choose, so pre-select it.
  const defaultDealerId = dealers.length === 1 ? String(dealers[0].id) : "";

  useEffect(() => {
    if (!open || metaLoaded.current) return;

    setMetaLoading(true);
    Promise.all([server_get_data(get_quick_call_meta), server_get_data(get_segments)])
      .then(([metaRes, segRes]) => {
        const list: DealerMeta[] = metaRes?.dealers ?? [];
        setDealers(list);
        setSegments(segRes?.segments ?? []);
        if (list.length === 1) setDealerId(String(list[0].id));
        metaLoaded.current = true;
      })
      .catch((err) => {
        console.error("Failed to load dealer/branch/segment meta:", err);
        setError(apiErrorMessage(err, "Couldn't load dealers/branches/segments. Try again."));
      })
      .finally(() => setMetaLoading(false));
  }, [open]);

  function resetForm() {
    setName("");
    setPhone("");
    setDealerId(defaultDealerId);
    setBranchId("");
    setVehicleName("");
    setLastServiceDate("");
    setDueDate("");
    setSegmentId("");
    setFoundCustomer(null);
    setSelectedVehicleId(null);
    setLookupMsg(null);
    setError(null);
    setWarning(null);
    setSuccessMsg(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  const selectedDealer = dealers.find((d) => String(d.id) === dealerId);

  async function handleFindByPhone() {
    if (!PHONE_RE.test(phone)) {
      setLookupMsg({ kind: "err", text: "Enter a 10-digit number starting 6/7/8/9, then Find." });
      return;
    }

    setLookupLoading(true);
    setLookupMsg(null);

    try {
      const res = await server_get_data(get_quick_vehicle_customer_lookup(phone));

      if (!res?.ok) {
        setLookupMsg({ kind: "err", text: res?.error || "Lookup failed." });
        return;
      }

      if (!res.customer) {
        setFoundCustomer(null);
        setSelectedVehicleId(null);
        setLookupMsg({ kind: "info", text: "New number — a customer will be created on save." });
        return;
      }

      const customer: FoundCustomer = res.customer;
      setFoundCustomer(customer);
      setSelectedVehicleId(null);

      if (customer.dealer_id) {
        setDealerId(String(customer.dealer_id));
        setBranchId(customer.default_branch_id ? String(customer.default_branch_id) : "");
      }
      if (customer.name) setName(customer.name);

      setLookupMsg({
        kind: "ok",
        text: `Found ${customer.name || "existing customer"} — click a vehicle below to edit it, or fill in a new one.`,
      });
    } catch (err) {
      console.error("Customer lookup failed:", err);
      setLookupMsg({ kind: "err", text: apiErrorMessage(err, "Couldn't reach the lookup API.") });
    } finally {
      setLookupLoading(false);
    }
  }

  function handlePickVehicle(v: VehicleHit) {
    setSelectedVehicleId(String(v.id));
    setVehicleName(v.vehicle_name || "");
  }

  function handleClearVehicle() {
    setSelectedVehicleId(null);
    setVehicleName("");
    setLastServiceDate("");
    setDueDate("");
    setSegmentId("");
  }

  async function saveCustomer() {
    setError(null);

    if (!PHONE_RE.test(phone)) {
      setError("Enter a 10-digit number starting 6/7/8/9.");
      return null;
    }
    if (name && !NAME_RE.test(name)) {
      setError("Name can only contain letters, space, . - '");
      return null;
    }
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

  async function saveVehicleIfNeeded(customerId: number) {
    const wantsVehicle = Boolean(vehicleName || lastServiceDate || dueDate || segmentId);
    if (!wantsVehicle) return null;

    const res = await server_post_json(post_quick_vehicle_save, {
      customer_id: customerId,
      vehicle_id: selectedVehicleId ? Number(selectedVehicleId) : undefined,
      branch_id: branchId ? Number(branchId) : undefined,
      vehicle_name: vehicleName,
      last_service_date: lastServiceDate || undefined,
      next_service_due_date: dueDate || undefined,
      segment_id: segmentId ? Number(segmentId) : undefined,
    });

    if (!res?.ok) {
      return { ok: false as const, error: res?.error || "Failed to save vehicle." };
    }
    if (res.vehicle_id) setSelectedVehicleId(String(res.vehicle_id));
    if (res.segment_warning) setWarning(res.segment_warning);
    return { ok: true as const, segment: res.segment as string | null };
  }

  async function placeCall(customerId: number, label: string) {
    const callRes = await server_post_json(post_plivo_call, { customer_id: customerId });
    if (!callRes?.success) {
      setError(callRes?.error || "Call could not be placed.");
      return false;
    }
    setSuccessMsg(`Calling ${label}…`);
    onCalled();
    setTimeout(() => handleOpenChange(false), 900);
    return true;
  }

  async function handleQuickCall() {
    if (!foundCustomer) return;

    setSubmitting("quickcall");
    setError(null);
    try {
      await placeCall(foundCustomer.id, foundCustomer.name || foundCustomer.phone_number);
    } catch (err) {
      console.error("Quick call failed:", err);
      setError(apiErrorMessage(err, "Something went wrong placing the call."));
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCall() {
    setSubmitting("call");
    try {
      const saved = await saveCustomer();
      if (!saved) return;

      if (saved.do_not_call) {
        setError("This customer is marked Do-Not-Call — the call was not placed.");
        return;
      }

      const vehicleRes = await saveVehicleIfNeeded(saved.customer_id);
      if (vehicleRes && !vehicleRes.ok) {
        setWarning(`Vehicle not saved: ${vehicleRes.error} — calling anyway.`);
      }

      await placeCall(saved.customer_id, saved.name || saved.phone_number);
    } catch (err) {
      console.error("Call customer failed:", err);
      setError(apiErrorMessage(err, "Something went wrong placing the call."));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add / Call customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Customer
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
                <Select value={branchId} onValueChange={setBranchId} disabled={!selectedDealer}>
                  <SelectTrigger>
                    <SelectValue placeholder="— optional —" />
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

            <div className="space-y-1.5">
              <Label htmlFor="vc-phone">Mobile Number</Label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                  +91
                </span>
                <Input
                  id="vc-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFindByPhone();
                    }
                  }}
                  placeholder="9584929738"
                  inputMode="numeric"
                  maxLength={10}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleFindByPhone}
                  disabled={lookupLoading}
                >
                  {lookupLoading ? <Loader2 className="size-4 animate-spin" /> : "Find"}
                </Button>
                {foundCustomer && (
                  <Button type="button" onClick={handleQuickCall} disabled={submitting !== null}>
                    {submitting === "quickcall" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Phone className="size-4" />
                    )}
                    Call
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                10 digits only — existing customer ho to "Find" se uski gaadi bhi load ho jaayegi,
                phir seedha "Call" kar sakte ho
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vc-name">Customer Name</Label>
              <Input
                id="vc-name"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^A-Za-z\u0900-\u097F .'-]/g, ""))}
                placeholder="Rakesh Kumar"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">Sirf letters, space, . - '</p>
            </div>

            {lookupMsg && (
              <p
                className={`text-sm ${
                  lookupMsg.kind === "err"
                    ? "text-destructive"
                    : lookupMsg.kind === "ok"
                      ? "text-[color:var(--success)]"
                      : "text-muted-foreground"
                }`}
              >
                {lookupMsg.text}
              </p>
            )}

            {foundCustomer && foundCustomer.vehicles.length > 0 && (
              <div className="rounded-md border p-2 space-y-1.5">
                <div className="text-xs text-muted-foreground">
                  Existing vehicles — click to edit:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {foundCustomer.vehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handlePickVehicle(v)}
                      className={`text-xs rounded-full px-2 py-1 border ${
                        selectedVehicleId === String(v.id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {v.vehicle_name || v.registration_no || `#${v.id}`}
                    </button>
                  ))}
                  {selectedVehicleId && (
                    <button
                      type="button"
                      onClick={handleClearVehicle}
                      className="text-xs text-muted-foreground underline"
                    >
                      clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vehicle Details{" "}
              <span className="normal-case font-normal">
                — optional, leave blank to only save the customer
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vc-vehicle-name">Vehicle Name</Label>
                <Input
                  id="vc-vehicle-name"
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  placeholder="Honda Activa"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vc-last-service">Last Service Date</Label>
                <Input
                  id="vc-last-service"
                  type="date"
                  value={lastServiceDate}
                  onChange={(e) => setLastServiceDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional — leave blank for a first-service customer with no history
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Segment</Label>
                <Select value={segmentId} onValueChange={setSegmentId} disabled={metaLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="— optional —" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Sets the AI agent's RAG context for this vehicle
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vc-due-date">Due Date</Label>
                <Input
                  id="vc-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Feeds the dialer's due_date context directly — leave blank to auto-calculate from
                  Last Service Date instead
                </p>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {warning && <p className="text-sm text-amber-600">{warning}</p>}
          {successMsg && <p className="text-sm text-[color:var(--success)]">{successMsg}</p>}
        </div>

        <DialogFooter className="gap-2">
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
