# Train AI Agents from Call Recordings

Yes — recordings become the best training source. We add a "Call Recordings" pipeline to the Training Data Studio: ingest thousands of calls, auto-transcribe and mine them for intents, objections, FAQs and winning lines, then send every suggestion through a human approval queue before it reaches an agent.

Built now as a complete, clickable mockup with realistic mock data and simulated processing, structured so the real Cloud backend (storage + transcription + extraction) plugs in later without redesigning screens.

## Screens

### 1. Recordings ingest (`/agents/recordings`)
Three ingest tabs:
- **Bulk upload** — drag a folder or multi-select MP3/WAV/OGG, per-file rows with size, duration, agent/module tagging, progress bars.
- **Manifest import** — ZIP or CSV with recording URLs plus metadata columns (module, agent, date, outcome, language); column-mapping preview before import.
- **Dialer sync** — connect the telephony/dialer source, choose modules and date range, schedule (hourly/daily), last-sync status.

Above the tabs: library stats (total recordings, hours, transcribed %, mined suggestions, pending review) and filters by module (Sales, Service, Insurance, AMC, Win-back, Feedback), outcome, agent and date.

### 2. Recording library + detail
Table of recordings: customer, module, duration, outcome, language, quality score, status (queued → transcribing → mined → reviewed). Row opens a detail drawer with player, Hindi transcript with speaker turns, detected intents, objections raised, sentiment timeline, and "mine this call" output.

### 3. Extraction review queue (`/agents/recordings/review`)
The human gate. Cards grouped by suggestion type — new intent utterance, objection + rebuttal, Q&A pair, opening line, escalation trigger — each showing the source call snippet, confidence score, target agent, and Approve / Edit / Reject actions. Bulk approve above a confidence threshold, filter by type/module/confidence.

### 4. Training run
Approved items stage into the existing Training Data Studio. A "Train from N calls" action shows a run summary (items by type, target agent, version bump v1.4 → v1.5), a simulated progress stepper (transcribe → mine → dedupe → index → evaluate), and an after-training scorecard: intent accuracy before/after, new intents learned, objection coverage.

Navigation: "Call Recordings" and "Review Queue" added under AI Agents in the sidebar and command palette; the agent detail page gets a "Trained from X calls" stat linking into the library.

## Technical notes

- New mock layer `src/mocks/recordings.ts`: typed `Recording`, `TranscriptTurn`, `MinedSuggestion` (kind, confidence, source call ref, target agent), `IngestJob`, `TrainingRun`, with ~40 seeded Bhopali-Hindi two-wheeler calls across the six modules and a generator to simulate large volumes.
- New routes `_app.agents.recordings.index.tsx`, `_app.agents.recordings.review.tsx`; reusable components under `src/components/agents/` (IngestDropzone, RecordingTable, TranscriptViewer, SuggestionCard, TrainingRunProgress) so the later backend swap is data-layer only.
- All state is local React state driven by the mock layer; upload/transcription/mining progress is simulated with timers. No backend calls.
- Later (real pipeline): audio to Cloud storage, transcription via the AI speech-to-text endpoint, mining via a server function returning structured suggestions, tables for recordings/suggestions/training runs — the components already read the same shapes.
- Each route gets its own head() metadata; UI stays on existing design tokens and shadcn components.
