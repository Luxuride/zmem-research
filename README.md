---
id: README
title: "zmem: Whole-Memory Transient Compression Layer (Research & Architecture)"
type: readme
status: active
date: "2026-11-21"
tags:
  - zmem
  - readme
  - transient-memory
  - rust-for-linux
aliases:
  - "Project Overview"
  - "README"
---

# `zmem` — In-Kernel Rust Whole-Memory Transient Compression Layer (Research & Architecture Repo)

Welcome to the documentation, literature research, and architectural specification repository for **`zmem`**, a Master's thesis project designing an **in-kernel, whole-memory transient compression layer** for Linux written in Rust (`rust-for-linux`) [@ojeda2021rust].

> [!IMPORTANT]
> **Primary vs. Sub-Primary Project Goals:**
> * **Primary Goal — Whole-Memory Transient Compression Layer:** Users simply see their system RAM while cold 4 KiB pages are transparently unmapped and compressed in the background (`kstaled`/`WKdm` model [@lagar2019software; @wilson1999wkdm]), expanded directly on page fault via a language-agnostic C ops-table (`struct zmem_transient_ops`, [[architecture/c-ops-table-boundary]]), and guarded against **Sudden Entropy-Increase / Expansion OOM** via a 64-bit integer SWAR pre-filter and protected Decompression Headroom Reserve ([[architecture/allocator-and-reclaim-safety]]).
> * **Sub-Primary Goal — Clean-Room Rust `blk-mq` Swap Module & Policy Ablation Baselines:** Because the core engine (`zmem-core`) is decoupled from the kernel entry point ([[adr/001-rust-blk-mq-entry-point|ADR-001]]), `zmem.ko` also implements a clean-room Rust `blk-mq` virtual block driver (`/dev/zmem0`, modeled on `rnull`/`rbrd` [@hindborg2024rnull; @axboe2013blkmq]) as a sub-primary target. This enables both (1) direct A/B policy comparisons (execution model, tiering, SWAR entropy filtering, 4 KiB vs. 16 KiB granularity) against stock `zram` (`lz4`, `zstd`, `CONFIG_ZRAM_MULTI_COMP` [@minchan2014zram; @lee2023zramtier]) and (2) isolating the exact latency/CPU cost of routing memory compression through the Linux block-swap layer vs. direct transient page-fault compression.
>
> * Start exploring from [[INDEX|docs/INDEX.md (Master Knowledge Base Index)]] or the [[GLOSSARY|docs/GLOSSARY.md (Plain-English Terminology Glossary)]].

---

## 1. Core Architectural Rules (Non-Negotiable)

1. **Upstream-Friendly Language-Agnostic C Boundary ([[adr/002-language-agnostic-c-ops-table|ADR-002]]):** Do not pollute core C `mm/` paths with `CONFIG_RUST` conditionals. `zmem` registers through a pure-C operations table (`struct zmem_transient_ops` in [[architecture/c-ops-table-boundary]]) for direct background page compression (`store_page`), page-fault decompression (`load_page`), slot invalidation (`evict_slot`), and headroom compaction (`shrink_headroom`) [@ojeda2021rust].
2. **Two-Layer De-Risked Engine (`no_std` Core + Thin Kernel Adapters) ([[adr/001-rust-blk-mq-entry-point|ADR-001]]):**
   * **Layer 1 (`zmem-core`):** Standalone `no_std` Rust crate operating on `(slot_token: u64, &[u8; 4096])` slices—fully unit-testable in userspace (`cargo test`) against memory-trace and entropy-spike simulators.
   * **Layer 2 (`zmem.ko`):** Thin kernel module connecting `zmem-core` to `struct zmem_transient_ops` (plus an optional `kernel::block::mq` adapter modeled on `rnull`/`rbrd` [@hindborg2024rnull; @axboe2013blkmq] for direct `fio` comparison against stock `/dev/zram0`).
3. **Reclaim, Page-Fault & Entropy-Expansion OOM Safety ([[architecture/allocator-and-reclaim-safety]]):** All allocations are strictly fallible (`KBox`/`KVec`) using `GFP_NOIO`/`GFP_NOWAIT` and pre-allocated per-CPU workspaces. A protected **Decompression Headroom Reserve** paired with SWAR entropy-velocity sensing prevents mid-fault deadlocks when already-allocated compressed memory is overwritten with high-entropy data ([[research/03-algorithms-and-entropy-filtering]]).
4. **Pluggable, Swappable Policy Engine ([[adr/003-swappable-policy-traits|ADR-003]]):** Every research dimension is isolated behind orthogonal Rust traits ([[architecture/swappable-policy-traits]]) so competing policies can be swapped at build- or boot-time for controlled A/B benchmarking.

---

## 2. Open Research Matrix

| Research Dimension | Stock `zram` Baseline | `zmem` Whole-Memory Transient Layer Axes | Primary Research Chapter & Spec |
| :--- | :--- | :--- | :--- |
| **Memory Layer & Entry** | Virtual block swap disk (`/dev/zram0` via `struct bio`) | Direct transient page-level C ops-table (`struct zmem_transient_ops`) + Two-Layer `no_std` core | [[research/01-linux-mm-and-zram-internals]], [[architecture/c-ops-table-boundary]] |
| **Execution & Headroom Pacing** | Synchronous on-BIO write; static disksize | Background PSI-paced demotion (`AsyncPsiHeadroomPolicy`) + Decompression Headroom Reserve for sudden entropy expansion | [[research/02-production-memory-compression]], [[architecture/allocator-and-reclaim-safety]] |
| **Entropy Filtering & OOM Sensor** | Blind compression (post-failure `ZRAM_HUGE` fallback) | Strided 64-bit integer SWAR cache-line probe (`SwarCachelineProbe`) acting as both CPU fast-bypass and entropy-spike OOM sensor | [[research/03-algorithms-and-entropy-filtering]], [[architecture/swappable-policy-traits]] |
| **Tiering & Granularity** | Single codec (`lz4`/`zstd`) or manual sysfs 4 KiB recompress | Age-based (`Tier 0 -> lz4 -> zstd`) vs. **Pressure-Based Progressive (`None -> lz4 -> zstd` as memory fills)**, with 4 KiB vs. 16 KiB ($N=4$) cold super-blocks | [[research/04-tiering-coalescing-and-async-reclaim]], [[architecture/swappable-policy-traits]] |
| **Verification & Baselines** | Uncompressed RAM, stock `zram` (`lz4`, `zstd`, recompress) | Adversarial limit-finding ("break-point") stress tests pushing approaches to failure across **Total Memory Provided**, **Nominal vs. Peak Memory Fluctuation**, **Saved Memory per CPU Cycle ($\eta_{\text{mem/cpu}}$)**, and **Read & Write Time** | [[research/06-benchmarking-and-methodology]], [[experiments/README]] |

---

## 3. Repository & Epistemic Architecture (Mutability Split)

### Living Documents vs. Immutable Snapshots

* **Living Documents (Mutable, Chapter-Based under `docs/`):**
  * `docs/research/01-*.md` through `06-*.md`, `docs/architecture/*.md`, and [[GLOSSARY|docs/GLOSSARY.md]] are updated in place as understanding evolves and map 1:1 to the future LaTeX thesis chapters.
* **Immutable Snapshots (Append-Only, Date/Numbered under `docs/`):**
  * `docs/adr/NNN-*.md` — Sequential Architecture Decision Records preserving *why* a design choice was made.
  * `docs/experiments/YYYY-MM-DD-<slug>.md` — Append-only benchmark and prototype logs ([[experiments/README]]).

### Epistemic Discipline in `docs/research/` and `docs/experiments/`

1. **Assumption Lifecycle (`## Assumptions`):** Assumptions are never deleted when falsified. Every assumption uses a lifecycle checkbox and `#assumption` tag (`- [ ] **Active:**`, `- [x] **Verified:**`, `- [-] **Refuted:**`). Per `scripts/check_consistency.ts`, no assumption may be marked `Verified` or `Refuted` without linking a dated experiment log (`[[experiments/YYYY-MM-DD-...]]`).
2. **Dead-End Record (`## What Was Tried`):** Permanently records rejected approaches and dead ends alongside *why* they were abandoned, while `## Conclusions` clearly separates verified literature facts from active `zmem` hypotheses.
3. **Milestone Tracking (`## Revision Log` & [[CHANGELOG]]):** Git tracks fine-grained line diffs (`git log -p`), while a compact 3-column `## Revision Log` at the bottom of each research chapter and [[CHANGELOG|docs/CHANGELOG.md]] track major pivots.

---

## 4. Repository Index (Auto-Synchronized)

<!-- AUTO-INDEX:START -->
### Research Chapters (`docs/research/`)

| ID | Chapter | Status |
| :--- | :--- | :--- |
| `RES-01` | [[research/01-linux-mm-and-zram-internals\|Linux Memory Management, Block Swap (zram) Limitations, and Whole-Memory Transient Compression]] | `active` |
| `RES-02` | [[research/02-production-memory-compression\|Whole-Memory Background Compression in Client OSes and Warehouse-Scale Systems]] | `active` |
| `RES-03` | [[research/03-algorithms-and-entropy-filtering\|Compression Codecs, Integer SWAR Entropy Pre-Filtering, and the Entropy-Expansion OOM Problem]] | `active` |
| `RES-04` | [[research/04-tiering-coalescing-and-async-reclaim\|Background Multi-Tier Demotion, Super-Block Coalescing, and Decompression Headroom Pacing]] | `active` |
| `RES-05` | [[research/05-rust-for-linux-block-layer\|Rust for Linux Kernel Boundaries: C Ops-Table Transient Memory Interface and Two-Layer Design]] | `active` |
| `RES-06` | [[research/06-benchmarking-and-methodology\|Benchmarking Methodology: Whole-Memory Pressure, Entropy-Spike OOM Workloads, and Verification Harness]] | `active` |

### Architecture Specifications (`docs/architecture/`)

| ID | Specification | Status |
| :--- | :--- | :--- |
| `ARCH-ALLOCATOR` | [[architecture/allocator-and-reclaim-safety\|Fallible Allocation, Decompression Headroom Reserve, and Entropy-Expansion OOM Safety]] | `active` |
| `ARCH-C-BOUNDARY` | [[architecture/c-ops-table-boundary\|Language-Agnostic C Ops-Table Boundary for Whole-Memory Transient Compression]] | `active` |
| `ARCH-OVERVIEW` | [[architecture/overview-and-dataflow\|zmem Whole-Memory Transient Compression Architecture and Dataflow]] | `active` |
| `ARCH-POLICY-TRAITS` | [[architecture/swappable-policy-traits\|Swappable Policy Engine and Rust Trait Specifications]] | `active` |

### Architecture Decision Records (`docs/adr/`)

| ADR | Decision | Status | Date |
| :--- | :--- | :--- | :--- |
| `ADR-001` | [[adr/001-rust-blk-mq-entry-point\|Two-Layer Whole-Memory Transient Compression Engine with C Ops Hook and Optional blk-mq Benchmark Adapter]] | `accepted` | 2026-11-21 |
| `ADR-002` | [[adr/002-language-agnostic-c-ops-table\|Language-Agnostic C Ops-Table Boundary (struct zmem_transient_ops) with Zero CONFIG_RUST Pollution in mm/]] | `accepted` | 2026-11-21 |
| `ADR-003` | [[adr/003-swappable-policy-traits\|Pluggable Swappable Policy Engine via Orthogonal Rust Traits]] | `accepted` | 2026-11-21 |

### Recent Experiments (`docs/experiments/`)

| Date | Experiment | Status |
| :--- | :--- | :--- |
| — | *No experiment runs logged yet (see [[experiments/README]])* | — |
<!-- AUTO-INDEX:END -->

---

## 5. Devcontainer, Static Site Builder & TypeScript (`tsx`) Automation

All repository hygiene and static-site generator scripts live in `scripts/` (`scripts/check_consistency.ts`, `scripts/gen.ts`, `scripts/build_site.ts`, and `scripts/site/*`), executed via `tsx`. Dependencies are managed deterministically via `.devcontainer/devcontainer.json` and `package.json`.

```bash
# 1. Run all consistency checks (wikilinks, citations, PDFs/HTML, frontmatter, assumption lifecycle guard)
make check

# 2. Build the Preact + DaisyUI + Tailwind static site into dist/ (for GitHub Pages)
make build

# 3. Scaffold the next sequential ADR or dated experiment log
make new-adr SLUG=entropy-headroom-watermark
make new-exp SLUG=swar-entropy-spike

# 4. Regenerate docs/INDEX.md and the auto-index section in README.md
make sync-indexes
```
