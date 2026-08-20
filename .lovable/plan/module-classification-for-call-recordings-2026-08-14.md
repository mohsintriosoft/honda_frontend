# Module Classification for Call Recordings

Right now the ingest screen only assumes a module (filename pattern, CSV column, dialer campaign) — there is no visible step that proves *which* workflow a call belongs to, and no way to correct a wrong guess. This plan adds an explicit classification layer so every recording is confidently routed to Sales, Service, Insurance, AMC, Win-back or Feedback before it can train an agent.

## How a call gets its module (4 signals, in priority order)

```text
1. Explicit metadata   dialer campaign / CSV "module" column / filename tag   -> confidence 100%
2. Dispositon + CRM    call outcome, customer's vehicle & service history     -> 80-95%
3. AI transcript       keyword + intent classifier on the Hindi transcript    -> 55-95%
4. Unclassified        nothing matched                                        -> human must tag
```

The highest-priority available signal wins; the UI always shows which signal was used, so an operator can see "Dialer campaign: Service Reminder July" vs "AI-classified from transcript, 71%".

## Screen changes

### 1. Ingest step: "Module mapping"
Each of the three ingest tabs gets an explicit module-source control before the job can start:
- Bulk upload — choose "Detect from filename pattern" (with a live preview showing how the first files parse), or force one module for the whole batch.
- Manifest import — the `module` column is required in mapping; rows with an unknown value are flagged in the preview.
- Dialer sync — map each dialer campaign / queue to a module once; the mapping is remembered and shown as a list of campaign → module rows.
Fallback selector: "If module can't be determined → AI-classify from transcript / send to Unclassified".

### 2. Library: classification column
The recordings table gets a **Module** cell showing the label plus a small source chip (Metadata / CRM / AI 78% / Unclassified). New filter "Classification: all / auto / needs review". Bulk action: select rows → "Set module".

### 3. Detail drawer: classification panel
Above the transcript: detected module, confidence, the signal used, the top matching keywords/intents that drove the AI guess (e.g. "insurance", "policy expire", "zero dep"), and the runner-up module with its score. A dropdown lets the reviewer override the module; overriding marks the call as human-verified and feeds the classifier as a labelled example.

### 4. New tab: "Needs classification"
On `/agents/recordings`, a tab listing every call that is Unclassified or below the confidence threshold (default 70%, adjustable). Each row shows a transcript snippet and one-click module buttons; bulk-assign supported. A KPI card "N calls need module review" sits with the existing library stats.

### 5. Guard before training
The "Train from N calls" action excludes unclassified and low-confidence calls and shows a note: "312 calls excluded — module unconfirmed. Review them first." Each suggestion in the review queue already carries a module badge; it now also shows how that module was determined.

## Technical notes

- Extend `Recording` in `src/mocks/recordings.ts` with `moduleSource: "metadata" | "crm" | "ai" | "manual" | "unknown"`, `moduleConfidence: number`, `moduleAlternatives: { module, score }[]`, and `moduleSignals: string[]` (matched keywords/intents). Seed a realistic mix: ~65% metadata, ~25% AI, ~10% unclassified.
- Add a `classifyRecording()` mock in the same file: keyword lexicon per module (service: service, pickup, oil, chain; insurance: policy, premium, zero dep, expire; amc: amc, renew plan; sales: test ride, down payment, EMI, model names; winback: wait, nahi aaya, voucher; feedback: kaisa raha, complaint, rework) scored against the transcript, returning top match + alternatives. Deterministic, no backend.
- Add `CAMPAIGN_MODULE_MAP` mock for the dialer tab.
- New components under `src/components/agents/`: `ModuleBadge.tsx` (label + source chip + confidence), `ClassificationPanel.tsx` (drawer panel with override), `ModuleMappingControls.tsx` (per-ingest-tab mapping UI).
- Route changes limited to `_app.agents.recordings.index.tsx` (new tab, column, filter, KPI, training guard) and a module-source line in `_app.agents.recordings.review.tsx`.
- All local state driven by the mock layer; when the real pipeline lands, `classifyRecording()` is replaced by a server function returning the same shape.
