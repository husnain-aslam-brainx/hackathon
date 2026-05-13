# AI-powered client brief conversion system
_Exported on 13/05/2026 at 16:32:14 GMT+5 from Cursor (3.3.30)_

---

**User**

i want to build a production ready system for my company. its users range could be from 10-15 managers that can use it. here is the system description:
"AI-Powered Client Brief → Dev-Ready Tasks / Jira Tickets Converter

Objective
Build an AI-driven system that transforms raw, unstructured client briefs into:

Clear, structured, developer-ready task breakdowns
Automatically generated developer tickets


The goal is to  build a tool for PMO department which will eliminate ambiguity, reduce back-and-forth communication, and enable developers to start implementation immediately. The system must never make assumptions. Instead.

Points to consider : 


No authentication is required"
here i what i understand about system is that we will get the doc document and it will always be doc document. we will parse it get all its info. and we will make a system and user prompt and will call openai and in which we will give instruction that convert these requirement developer-ready task breakdowns and will ask that if there is any ambiquity than ask user. if there is any ambiquity ai will ask user and after all the ambiquity are resolved it will give us the tickets that user will pickup and start working on it. 
above is my understanding of system and approach. tell me if i understand it well and my approach is correct. think like a principal software engineer and product owner. dont sugar coat it. tell me other possible solutions with pros and cons. also give my solution pros and cons. give honest and expert review. give me 3-4 possible solutions and one recommended solution

---

**Cursor**

Here is a straight review from a principal-engineer + product-owner lens.

## Do you understand the problem?

**Mostly yes, with one important gap.**

You have the right **macro flow**: ingest a Word brief → extract text → call an LLM with strong instructions → surface ambiguities → resolve them → emit developer-ready work items (and optionally push to Jira).

The gap is **“the system must never make assumptions.”** That is a **product guarantee**, not something you get for free from “good prompting.” Models will still **infer, generalize, and silently fill gaps** unless the product design **forces** non-assumption behavior (schemas, required fields, explicit “unknown / not stated in brief” states, traceability to source spans, and human approval before tickets are “final”). Your clarification loop helps, but it is **not sufficient by itself** unless the model is **forbidden** from inventing details and **required** to cite or flag gaps.

So: your **story** is right; your **risk** is treating “ask when ambiguous” as equivalent to “never assumes.” It is not.

---

## Your approach — pros and cons

**Pros**

- **Fits the PMO job**: brief → structured breakdown → tickets is the right artifact.
- **DOCX as single input** is realistic for many enterprises.
- **Clarification loop** is the correct product shape when quality matters more than one-shot speed.
- **Small user base (10–15)** simplifies ops: you can afford **human-in-the-loop** and heavier models where needed.

**Cons**

- **DOCX parsing is messy**: tables, headers/footers, numbering, comments, revision marks, embedded images, pasted Excel, multi-column layout — all break naive “get all text.”
- **Token limits and cost**: long briefs need **chunking + merge**; naive “one prompt with whole doc” fails or degrades.
- **Clarification UX is hard**: the model may ask **low-value** or **duplicate** questions unless you structure **what “ambiguous” means** (missing acceptance criteria, NFRs, integrations, data model, roles, edge cases, SLAs, etc.).
- **“Tickets” without a definition of done** often become **glorified tasks** unless you enforce **AC, scope boundaries, dependencies, and test expectations**.
- **No auth** is fine for a hackathon; for “production ready” at a company it is usually **wrong** unless the briefs are non-sensitive and deployment is fully private. Even 10–15 users typically want **SSO or at least basic identity** for audit trails.

---

## 3–4 alternative solution shapes

### 1) Your approach — **LLM-centric pipeline + clarification loop** (DOCX → extract → LLM → Q&A → tickets)

- **Pros**: fastest to ship; flexible across brief styles; good PMO demo value.
- **Cons**: hardest to prove “no assumptions”; parsing edge cases; merge/chunk complexity; evaluation is subjective without golden tests.

### 2) **Schema-first / form-assisted brief** (PM completes a structured template; AI only fills gaps)

- **Pros**: highest reliability; clearest “no invention” story; easiest QA and versioning.
- **Cons**: changes PM workflow (adoption friction); less “magic”; still need DOCX import if PM insists on Word.

### 3) **Hybrid extraction** — deterministic parsing for tables/lists + LLM for narrative + **mandatory traceability** (every field links to quoted source or “not found”)

- **Pros**: best engineering tradeoff for enterprise credibility; reduces hallucinated “facts.”
- **Cons**: more build work; still need good chunking/merge; harder prompts and post-processing.

### 4) **RAG over your org’s standards** (playbooks, architecture patterns, past Jira epics) + LLM

- **Pros**: tickets align with **how your company actually works**; fewer generic tasks.
- **Cons**: needs a corpus and curation; privacy/compliance; can **amplify bad past patterns** if the library is junk.

---

## Recommended solution (for “production ready” + PMO + 10–15 users)

**Recommend: Solution 3 — hybrid extraction + schema-first output + clarification loop + source traceability**, with an optional thin layer of RAG only for **style/templates**, not for inventing requirements.

**Why this is the recommendation**

- It is the most honest match to **“never assume”** without pretending an LLM is a rules engine.
- It scales to ugly DOCX better than “plain text dump → one prompt.”
- It gives you **auditability**: PMs and devs can see *why* a ticket claim exists.

**Minimum “production” bar I would not skip**

- **Structured outputs** (JSON schema) for tasks/tickets: title, description, AC, non-goals, dependencies, open questions (must be empty before “final”), **evidence quotes** per requirement slice.
- **Two-pass or merge strategy** for long docs: extract per section → consolidate → dedupe questions.
- **Human approval gate**: “draft tickets” vs “approved for Jira.”
- **Observability**: store prompts/responses hashes, model version, parser version; basic eval set of real briefs (even 10 documents).
- **Revisit “no auth”** for anything with client data: at least network isolation + identity, even if login is “boring.”

---

## Bottom line

- Your **mental model** (DOC → parse → LLM → ask on ambiguity → tickets) is **directionally correct**.
- Treat **“never assume”** as a **system design problem** (schema, traceability, explicit unknowns, approval), not a **prompting problem** alone.
- For a company PMO tool with credibility requirements, **hybrid + traceability + approval** beats **pure LLM magic**.

If you want next step as implementation: clarify whether tickets must **push to Jira via API** or **export only**, and whether briefs can contain **tables/images** — those two answers change the architecture more than the choice of OpenAI model.

---

**User**

i like that you found and emphasized on very critical point of no assumption. yes by hybrid we can reduce hallucination and risk. lets implement:
Hybrid extraction — deterministic parsing for tables/lists + LLM for narrative + mandatory traceability (every field links to quoted source or “not found”)"
approach. give me todos list to implement this

---

**Cursor**

Here is an implementation-oriented todo list for the **hybrid extraction + mandatory traceability** approach. Order matters: build **stable source blocks** first, then everything else hangs off those IDs.

---

## Phase 0 — Product and contracts

1. **Define the ticket schema** (fields you will always emit): e.g. title, description, acceptance criteria, out of scope, dependencies, labels, priority — plus **required** `evidence[]` per atomic requirement (quote + `source_block_id` or literal `"not_found"`).
2. **Define “block” types** your parser produces: `paragraph`, `list_item`, `table_cell`, `heading` (and rules for how quotes must reference them).
3. **Write 3–5 example briefs** (including nasty DOCX: merged cells, nested lists, tables) as **golden fixtures** for regression tests.

---

## Phase 1 — Deterministic DOCX ingestion

4. **Choose DOCX extraction library** (e.g. Python `python-docx` / OOXML, or a pipeline that walks `word/document.xml` for fidelity) and document limitations (images, floating objects).
5. **Implement structured extractors**:
   - **Headings** with level and order.
   - **Numbered/bulleted lists** with nesting depth and stable ordering.
   - **Tables** as a 2D grid: row/col indices, optional header row detection, merged-cell handling (at minimum: “merged span” metadata or flattened text with warnings).
6. **Assign stable `block_id`** to every extracted unit (e.g. `p-042`, `li-003-002`, `t-01-r-2-c-3`) — never reuse IDs across versions of the same run; within one run they are immutable.
7. **Serialize “canonical document model”** (JSON) that the LLM and UI both consume — single source of truth after parse.

---

## Phase 2 — Traceability layer (non-negotiable)

8. **Define validation rules**: no ticket row is “valid” unless every non-optional field either has ≥1 evidence quote that **substring-matches** the referenced block text, or is explicitly `"not_found"` with a **blocking question** (your clarification loop).
9. **Build a verifier** (deterministic, no LLM): given model output JSON, check evidence quotes exist in the cited `block_id` text (normalize whitespace; optionally fuzzy threshold with **strict** default off for v1).
10. **Reject / repair loop**: if verification fails, auto-repair only when safe (e.g. trim quotes); otherwise return structured errors to the LLM for one retry with the error list.

---

## Phase 3 — LLM pipeline (narrative + structure)

11. **Chunking strategy**: chunk by heading sections using the block graph; keep **tables intact** per table; don’t split list mid-branch if possible.
12. **Pass A — “extract requirements slices”** per chunk: output only **atomic requirement candidates** + `evidence[]` (must cite `block_id` + short quote). No full Jira formatting yet.
13. **Pass B — “consolidate + dedupe”** global merge: merge duplicate candidates; reconcile conflicting statements by **raising questions** instead of guessing.
14. **Pass C — “ticketification”**: map consolidated slices to Jira-shaped objects; still **must** carry forward `evidence[]`; **forbid** introducing facts not present in evidence unless tagged `not_found` + question.
15. **Structured outputs**: use **JSON Schema** / tool calling so the model cannot omit `evidence`.

---

## Phase 4 — Ambiguity / clarification UX

16. **Question schema**: each question references which ticket/slice is blocked and which fields are `not_found`.
17. **Blocking vs non-blocking**: only emit “final” tickets when **no blocking** `not_found` on required fields (or PM explicitly overrides with audit log — optional).
18. **Session state**: store document version, block map, draft JSON, Q&A rounds (for reproducibility).

---

## Phase 5 — Delivery (Jira / export)

19. **Exporter**: CSV/Markdown for v0; Jira REST **optional** v1 with idempotent “dry run” preview.
20. **Human approval step**: “Draft” → “Approved for export” with diff view (ticket vs evidence).

---

## Phase 6 — Production hardening (still valuable at 10–15 users)

21. **Logging**: parser version, model name/version, prompt template version, hashes of inputs/outputs (not necessarily raw client text in insecure logs — policy decision).
22. **Admin/config**: model selection, temperature caps, max rounds for clarification.
23. **Basic load + failure tests**: large DOCX, empty tables, encoding edge cases.
24. **Privacy**: where files live (disk vs object storage), retention, encryption at rest — even without SSO, don’t skip this if briefs are client-confidential.

---

## Phase 7 — Evaluation (small but real)

25. **Scoring rubric** on golden set: % tickets with valid evidence linkage; count of unsupported claims; PM time-to-approve.
26. **Regression suite**: parser snapshots + verifier tests on known good/bad LLM outputs (fixture JSON).

---

### Critical path (shortest “real” vertical slice)

**4 → 6 → 8 → 9 → 11 → 12 → 15 → 19**  
(Get blocks + IDs → require evidence → verify → one chunk pass → slices → structured tickets → export.)

If you want this turned into **repo-specific tasks** next, say what stack you are using (e.g. Python/FastAPI vs Node) and whether Jira is **API** or **export-only** in v1.

---

**User**

how we will do this in rails. do we have any library to do in rails
"Phase 1 — Deterministic DOCX ingestion
Choose DOCX extraction library (e.g. Python python-docx / OOXML, or a pipeline that walks word/document.xml for fidelity) and document limitations (images, floating objects).
Implement structured extractors:
Headings with level and order.
Numbered/bulleted lists with nesting depth and stable ordering.
Tables as a 2D grid: row/col indices, optional header row detection, merged-cell handling (at minimum: “merged span” metadata or flattened text with warnings).
Assign stable block_id to every extracted unit (e.g. p-042, li-003-002, t-01-r-2-c-3) — never reuse IDs across versions of the same run; within one run they are immutable.
Serialize “canonical document model” (JSON) that the LLM and UI both consume — single source of truth after parse."

---

**Cursor**

Here is how to do **Phase 1 in Rails** in a way that stays **deterministic** and Ruby-native, plus when **not** to rely on a gem alone.

## Two viable approaches in Rails

### 1) **Recommended for your goals: `rubyzip` + `nokogiri` on OOXML (the DOCX ZIP)**

A `.docx` file is a **ZIP** whose main story is `word/document.xml` (plus `word/numbering.xml`, `word/styles.xml`, sometimes `word/settings.xml`). Walking that XML yourself is the Ruby equivalent of “walk `document.xml` for fidelity.”

- **Gems**
  - [`rubyzip`](https://github.com/rubyzip/rubyzip) — read entries from the DOCX zip in memory.
  - [`nokogiri`](https://nokogiri.org/) — parse `document.xml`, `numbering.xml`, `styles.xml`.

- **Why this matches Phase 1**
  - You can emit a **canonical JSON model** with explicit **headings / list items / table cells**, **merge metadata** (`gridSpan`, `vMerge`), and **stable `block_id`s** you assign while traversing in document order.
  - You are not dependent on a higher-level gem hiding details you need for traceability.

- **Cons**
  - More engineering than a one-liner: Word’s list model (`numPr`, abstract nums, overrides) is annoying; merged cells need careful “grid expansion” logic if you want a true 2D matrix.

**Rails-wise:** put parsing in `app/services/docx/` (or `app/lib/docx/`), call from a job (`ActiveJob`) for large files, store the canonical JSON on your model (e.g. `brief.parsed_body` JSONB + `parser_version`).

---

### 2) **Higher-level Ruby gem: `docx` (ruby-docx)**

There is a maintained reader gem commonly used for “get paragraphs and tables from DOCX”:

- **Gem:** [`docx`](https://github.com/ruby-docx/docx) (`gem 'docx'`)

- **Pros**
  - Faster to **something working** (paragraphs, basic tables).

- **Cons for *your* Phase 1 bar**
  - You may still **not** get everything you want for **nested lists**, **full numbering fidelity**, and **rich merge metadata** without dropping to OOXML anyway.
  - For “mandatory traceability + stable block IDs + warnings,” you often end up **re-implementing structure** on top of simplified objects.

**Practical pattern:** spike with `docx`; if you hit limits on lists/tables/merges, **replace the extractor** with the OOXML parser while keeping the same output JSON schema.

---

## What Rails does *not* give you

Rails has **no built-in** DOCX parser. ActiveStorage handles **upload/storage**, not semantic DOCX structure. Your work is **gems + a service object + tests**.

---

## How the structured extractors map to OOXML (implementation sketch)

| Feature | Where it lives (conceptually) |
|--------|-------------------------------|
| Headings + order | Paragraphs (`w:p`) with `w:pStyle` (e.g. `Heading1`) and/or outline level; preserve **document order** as you walk `w:body` children. |
| Lists + nesting | `w:p` → `w:pPr` → `w:numPr` (`w:numId`, `w:ilvl`); resolve against `word/numbering.xml` for list type/level formatting. |
| Tables as 2D | `w:tbl` → `w:tr` → `w:tc`; read `w:gridSpan`, `w:vMerge` (`restart` vs `continue`) to mark spans / vertical merges. |
| Stable `block_id` | Assign IDs **during traversal** (`h-001`, `p-042`, `li-012`, `t-03-r-1-c-4`) — deterministic if traversal order is deterministic. |

Serialize one JSON payload, e.g.:

```json
{
  "parser_version": "docx_ooxml_v1",
  "blocks": [
    { "id": "h-001", "type": "heading", "level": 2, "text": "..." },
    { "id": "li-012", "type": "list_item", "num_id": 3, "ilvl": 1, "text": "..." },
    { "id": "t-02-r-3-c-1", "type": "table_cell", "table_index": 2, "row": 3, "col": 1, "grid_span": 2, "v_merge": "restart", "text": "..." }
  ]
}
```

(Shape is yours; the important part is **immutable IDs per run** + enough metadata for the verifier.)

---

## Libraries checklist (Rails-typical)

| Need | Gem / tool |
|------|------------|
| Unzip DOCX | `rubyzip` |
| Parse XML | `nokogiri` |
| Optional faster path | `docx` (then possibly migrate) |
| Background processing | `sidekiq` / Solid Queue + `ActiveJob` |
| Store canonical JSON | PostgreSQL `jsonb` column |

---

## Honest limitation note (any stack)

**Images / floating shapes / text boxes** often live outside the simple “body paragraph” story or in other parts (`word/header*.xml`, `word/footer*.xml`, drawings). For Phase 1, document explicitly: **“unsupported → extracted as warning block”** rather than pretending full fidelity.

---

## Bottom line

- **Best fit for your Phase 1 spec in Rails:** **`rubyzip` + `nokogiri`** on OOXML, outputting your **canonical block JSON** with your own `block_id` assignment.  
- **Optional shortcut:** start with the **`docx`** gem, **keep the JSON schema stable**, and swap the extractor if list/table/merge fidelity is insufficient.

If you tell me your **Ruby/Rails version** and whether briefs use **real numbered multilevel lists** vs mostly headings + bullets, I can narrow “OOXML first” vs “docx gem first” to a single recommendation for your repo.

---

**User**

ok now i understand whole flow. my constraint is that we dont want implement database or dont want to store data. so we need to update the steps in which we will have schema and match schema and also we dont want to export for Jira it is not our rquirement. so give me refine and tasks

---

**Cursor**

Here is a **refined flow** and **task list** for your constraints: **no database / no durable storage**, **schema + match (validate) against schema**, **no Jira export**.

---

## What changes conceptually

Without persistence, the system is **request–response (or client-orchestrated multi-step)**. The server should treat each call as **stateless** unless you explicitly add something like Redis (you said no DB; I’ll assume **no server-side durable store at all**).

Implications:

- **Source of truth between steps** must live in the **client** (browser memory / `sessionStorage` / `localStorage`) or be **re-sent** every request (full canonical JSON + prior answers + current draft).
- **“Clarification loop”** becomes: *client* shows questions → *client* sends answers + prior artifacts back → server returns updated draft. No DB tables for “sessions.”
- **Audit/replay** is weaker unless the client exports a bundle (JSON download) — that’s optional UX, not a DB.

---

## Refined end-to-end flow (no DB, no Jira)

1. **Client** uploads DOCX (multipart) **or** sends already-extracted canonical JSON (if extraction is client-side — usually still server-side for Ruby).
2. **Server** runs **Phase 1 deterministic extract** → **canonical block model** (JSON).
3. **Server** validates canonical model against **JSON Schema A** (“document blocks schema”). Fail fast with structured errors.
4. **Server** runs LLM pass(es) using only that JSON (+ user answers if round > 1).
5. **Server** validates LLM output against **JSON Schema B** (requirements slices) and **JSON Schema C** (tickets/tasks), then runs **deterministic verifier** (evidence quotes ↔ `block_id` text). Fail → return machine-readable violations (and optionally a “repair prompt” internally).
6. **Server** returns **final payload** to UI: tasks + any blocking questions. **No export step** beyond “copy/download JSON/markdown” if you want convenience.

Jira is simply **removed** from scope.

---

## Schema + “match schema” (what you actually implement)

Use two layers (both important):

1. **Syntactic validation**: output must parse as JSON and conform to **JSON Schema** (types, required fields, enums, `additionalProperties: false` where safe).
2. **Semantic validation (your traceability contract)**: deterministic checks **not fully expressible** in JSON Schema alone, e.g. “every ticket field either has evidence with quote substring in referenced block OR is explicitly `not_found`.”

**Rails gems commonly used**

- [`json_schemer`](https://github.com/davishmcclurg/json_schemer) (JSON Schema validation in Ruby) **or** `json-schema` gem.
- Optional: `dry-schema` / `dry-validation` if you prefer Ruby-first schemas instead of JSON Schema — but JSON Schema is nice for **sharing the same schemas** with the LLM tool-calling layer.

**Tasks**

- Define **JSON Schema A/B/C** files in-repo (`schemas/…`) and version them (`schema_version` field inside payloads).
- Implement `SchemaValidator.call(payload, schema_name)` service.
- Implement `TraceabilityVerifier.call(tickets, blocks)` service (pure Ruby).
- Add **golden fixture tests**: valid/invalid JSON files that must pass/fail for each schema + verifier.

---

## Refined task list (DB-less, no Jira)

### A) Contracts (schemas) — do this first

1. **Canonical document JSON schema (A)**: `blocks[]` with `id`, `type`, ordering fields, table coordinates, merge metadata, `text`, optional `warnings[]`.
2. **LLM intermediate schema (B)** (recommended): “requirement slices” each with `slice_id`, `statement`, `evidence[]` (`block_id`, `quote`), `status` (`supported` / `not_found`), `blocking_questions[]`.
3. **Final UI schema (C)** (tasks/tickets without Jira): title, description, acceptance criteria, dependencies (as text), `evidence[]`, `open_questions[]` (must be empty for “finalizable” if you want a hard gate).
4. Add **`schema_version`** + **`parser_version`** fields to every major JSON payload for forward compatibility.

### B) DOCX ingestion (still deterministic; no DB)

5. Implement extractor (prefer **OOXML + Nokogiri + Rubyzip**) producing canonical JSON.
6. Unit tests on DOCX fixtures for headings/lists/tables/merges (snapshot the JSON or key assertions).

### C) Stateless API shape (Rails)

7. **Single endpoint** or **small endpoint set**, all **stateless**:
   - `POST /parse` → returns canonical JSON (+ schema version).
   - `POST /generate` accepts `{ canonical_document, answers?, prior_draft? }` → returns draft matching schema C.
8. **Payload size strategy** (because no DB): enforce max upload size; consider **gzip JSON** client-side for multi-step calls; optionally chunk generation server-side but still return one response.

### D) LLM orchestration (no persistence)

9. Prompt templates versioned in code (`config/prompts/v1/...`) with strict “no evidence → not_found + question” rules.
10. If using OpenAI **structured outputs / JSON schema**: align OpenAI schema with your **Schema B/C** (or generate from one source of truth).
11. Implement **validate → verify → (optional single repair retry)** in one request to reduce client round-trips.

### E) Clarification loop without storage

12. UI stores: `canonical_document`, latest `draft`, `questions`, `answers` map keyed by `question_id`.
13. Server returns `questions[]` with stable `question_id` (UUIDs generated server-side per request are fine; client must echo them back with answers).

### F) Delivery (no Jira)

14. UI renders tasks; optional **“Download bundle.json”** (client-generated) for PM convenience — still not a database.

### G) Production-ish concerns without a DB

15. **Logging policy**: avoid logging full brief text; log hashes + schema/parser versions only.
16. **Rate limits / timeouts** for uploads + model calls.
17. **Privacy**: ephemeral processing in memory; document that files are not retained (and ensure Tempfiles are unlinked).

---

## What you should explicitly drop from earlier plans

- Any “store `brief` model / jsonb / ActiveRecord persistence” — replace with **in-request memory** + **client-carried state**.
- Jira API, webhooks, field mapping, dry-run export.
- “Approval gate stored as status” — replace with **UI-only states** (draft vs final copy) unless you add storage later.

---

## Recommended operating mode (simplest honest architecture)

**Rails API + browser-held state + strict schemas + verifier.**  
One refinement that saves pain: make `POST /process` accept **either** a DOCX file **or** `{ canonical_document }` so the client can avoid re-uploading the binary after the first parse (still no DB—just client caching).

If you want, next message can specify whether you’re **API-only (React/Vue)** or **Hotwire-only**—the task list is the same, but the “client holds state” wiring differs slightly.

---

**User**

let start implementing and writing code first we need to make contracts so make contracts first we will make LLM intermediate schema

---

**Cursor**

Exploring the project structure so we can add the LLM intermediate schema contracts in the right place.



Adding the LLM intermediate contract as versioned JSON Schema plus a small Ruby validator using `json_schemer` (standard for JSON Schema in Ruby).



Creating versioned JSON Schema and a `Contracts::Llm` validator. Adding the `json_schemer` gem.



Fixing the test to load the fixture from `test/fixtures/contracts` (Rails `file_fixture` uses `test/fixtures/files`).



Pinning Minitest to 5.x — Rails 7.1's test runner is incompatible with Minitest 6.



Using `::Contracts` in tests — Ruby resolves `Contracts` under the test class `ContractsLlm...` first.



Identifying the issue: Rails treats `app/contracts` like `app/models` — the `contracts` segment is omitted from the constant path, so Zeitwerk expects `Llm::RequirementSlicesValidator`, not `Contracts::Llm::...`. Moving the validator to `lib/contracts/llm/` so `Contracts::Llm::RequirementSlicesValidator` resolves correctly (`autoload_lib` loads `lib`).



Here is what was added and how to use it.

### 1. LLM intermediate JSON Schema (v1)

```1:120:config/schemas/llm/requirement_slices/v1.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://hackathon.local/schemas/llm/requirement_slices/v1.json",
  "title": "LLM intermediate: requirement slices",
  ...
}
```

- **Root:** `schema_version` (fixed to `llm.requirement_slices.v1`), optional `canonical_document_ref` / `document_title`, `slices[]`.
- **Slice:** `slice_id`, `statement`, `status` (`supported` | `not_found`), `evidence[]` (`block_id`, `quote`), `blocking_questions[]` (`question_id`, `text`, optional `rationale`).
- **Rules:** `supported` ⇒ `evidence` has at least one item; `not_found` ⇒ `blocking_questions` has at least one item; `additionalProperties: false` on those objects.

### 2. Ruby validator (`json_schemer`)

- **Gem:** `json_schemer` in the Gemfile; **Minitest pinned** to `~> 5.25` so `bin/rails test` works with Rails 7.1.
- **Code:** `lib/contracts/llm/requirement_slices_validator.rb` defines `Contracts::Llm::RequirementSlicesValidator`.

Rails treats **`app/contracts`** like **`app/models`** (the `contracts` segment is not part of the constant path), which broke Zeitwerk. Putting this under **`lib/contracts/...`** matches `Contracts::Llm::...` and works with `config.autoload_lib`.

Usage:

```ruby
::Contracts::Llm::RequirementSlicesValidator.valid?(parsed_json_hash)
::Contracts::Llm::RequirementSlicesValidator.errors_for(parsed_json_hash)
```

### 3. Tests + fixture

- Fixture: `test/fixtures/contracts/llm/requirement_slices_valid.json`
- Tests: `test/contracts/llm/requirement_slices_contract_test.rb` (happy path + invalid `supported` / `not_found` / `schema_version` / extra root key)

All six tests pass, and `bin/rails zeitwerk:check` is clean.

Next logical step: define the **canonical document** JSON Schema (Phase 1 blocks) and a **traceability verifier** that checks quotes against block text (outside JSON Schema). Say when you want to add those and we can wire them the same way.

---

**User**

before implementing the canonical document JSON Schema (Phase 1 blocks) and a traceability verifier i want we change our implementation little bit. first we take doc from user and than do the verifciation and continue. we need to implement it in steps from start to end. so that i can verify each step as we procced

---

**Cursor**

Scaffolding a step-by-step pipeline: Step 1 — accept DOCX and run upload verification. Later steps will plug in (parse → LLM → …). Exploring the app structure.



Implementing an explicit step-by-step pipeline: a manifest listing all steps (only Step 1 implemented) and Step 1 — validate the uploaded DOCX before any parsing.



Here is what was implemented and how to verify it.

## Step-by-step pipeline

1. **`GET /brief_pipeline/manifest`** — Lists the full pipeline in order. Each step has `id`, `label`, `http_method`, `path`, and `status` (`implemented` or `pending`). Only **`validate_upload`** is `implemented` today.
2. **`POST /brief_pipeline/step/validate_upload`** — Multipart field **`document`** (the `.docx`). This step only checks the file; it does **not** parse XML yet.

Later steps (`parse_document`, `requirement_slices`, `traceability`, `final_tasks`) are listed in the manifest as **`pending`**; you add routes + controller actions one at a time as we go.

## Step 1 behavior (`BriefPipeline::ValidateUpload`)

- File must be present (`document`).
- Filename must end with **`.docx`** (case-insensitive).
- Non-empty size, max **15 MB**.
- First bytes must be **ZIP** magic **`PK\x03\x04`** (real `.docx` is a ZIP).
- After checks, the upload is **rewound** so a later step can read the full file again.

## Code layout

| Piece | Role |
|--------|------|
| `BriefPipeline::Manifest` | Ordered step list + metadata (single place to flip `pending` → `implemented`) |
| `BriefPipeline::ValidateUpload` | Step 1 service (pure, easy to unit test) |
| `BriefPipeline::PipelineController` | JSON endpoints |
| `BriefPipeline::BaseController` | JSON + `skip_forgery_protection` so **curl/Postman** work; tighten later for browser/API tokens |

## How you can verify

```bash
# 1) See the full pipeline and what is implemented
curl -s http://localhost:3000/brief_pipeline/manifest | jq

# 2) Upload a real .docx (or any file named .docx with ZIP magic at the start)
curl -s -F "document=@/path/to/brief.docx" http://localhost:3000/brief_pipeline/step/validate_upload | jq
```

Tests: `test/services/brief_pipeline/validate_upload_test.rb` (service) and `test/integration/brief_pipeline_pipeline_integration_test.rb` (HTTP).

---

**Next increment (when you are ready):** add **`POST /brief_pipeline/step/parse_document`**, wire it in `Manifest` + routes, implement DOCX → canonical JSON, and mark that step `implemented`. Say when to implement Step 2 and we’ll hook it in the same pattern (manifest + route + service + tests).

---

**User**

this is the monolithic app. also implement frontend where we can upload doc

---

**Cursor**

Adding a monolithic Rails UI for DOCX upload that posts to the existing pipeline endpoint and displays results. Exploring the app's views and assets.



Adding an HTML UI (`BriefPipeline::UiController`) with CSRF-protected multipart upload, keeping the JSON API on `PipelineController` for curl/tests.



Using the `csrf-token` meta tag and the `X-CSRF-Token` header — `form_with` may omit a visible hidden field in this setup.



Checking the rendered form for a CSRF hidden field:



Checking how `form_with` renders:



