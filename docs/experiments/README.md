---
id: EXP-README
title: "Immutable Experiment Logs and Verification Workflow"
type: guide
status: active
date: "2026-11-21"
tags:
  - zmem
  - experiment
  - methodology
aliases:
  - "Experiment Workflow Guide"
  - "EXP-README"
---

# Immutable Experiment Logs and Verification Workflow

## 1. Purpose & Immutability Rule

The `docs/experiments/` directory holds **date-stamped, append-only snapshots** (`YYYY-MM-DD-<slug>.md`) recording specific hypotheses, prototype evaluations, `virtme-ng` verification gates, and `fio` / `mmtests` benchmark runs ([[research/06-benchmarking-and-methodology]]).

* **Zero unverified or synthetic data:** Experiment logs are created only when an actual prototype test or benchmark run is executed.
* **Never rewrite historical experiment outcomes:** Once an experiment run is completed, its log remains an immutable record of what was tested on that date.
* **Promote verified takeaways upward:** When an experiment verifies or refutes an assumption (`#assumption`), update the corresponding assumption's lifecycle checkbox (`- [x] **Verified:**` or `- [-] **Refuted:**`) and `## Revision Log` in `docs/research/01-*.md` through `06-*.md`, or record an architectural pivot in a new `docs/adr/NNN-*.md`.

## 2. Creating a New Experiment Log

Use the TypeScript (`tsx`) generator script (or `Makefile` target) to scaffold a new dated experiment from `docs/templates/experiment.md`:

```bash
# Via Makefile:
make new-exp SLUG=swar-cacheline-entropy-probe

# Or directly via npx tsx:
npx tsx scripts/gen.ts new-exp swar-cacheline-entropy-probe

# Synchronize docs/INDEX.md and README.md tables after adding an experiment:
make sync-indexes

# Verify frontmatter, wikilinks, and citations:
make check
```

## 3. Required Epistemic Structure

Every `docs/experiments/YYYY-MM-DD-*.md` file is validated by `scripts/check_consistency.ts` and MUST contain:
1. Valid YAML frontmatter (`id`, `title`, `type: experiment`, `status`, `date`, `tags`, `aliases`).
2. `## Assumptions` — Lifecycle-tracked experimental assumptions (`- [ ] **Active:**`, `- [x] **Verified:**`, `- [-] **Refuted:**`) tagged with `#assumption`.
3. `## What Was Tried` — Exact kernel configs, `virtme-ng` commands, workload parameters, dead ends, and failed runs.
4. `## Conclusions` — Quantitative takeaways (P50/P99/P99.9 latency, Memory/CPU PSI, effective compression ratio) with bidirectional wikilinks to `docs/research/` and `docs/adr/`.
