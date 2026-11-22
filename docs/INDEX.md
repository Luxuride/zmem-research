---
id: INDEX
title: "zmem Knowledge Base Master Index"
type: index
status: active
date: "2026-11-22"
tags:
  - zmem
  - index
  - moc
aliases:
  - "Master Index"
  - "Master Knowledge Base Index (MOC)"
  - "MOC"
---

# `zmem` Knowledge Base Master Index

> [!NOTE]
> This Map of Content (MOC) is synchronized by `npx tsx scripts/gen.ts sync-indexes`. Open the `docs/` directory as your Obsidian Vault root to browse the full knowledge graph.

## 1. Living Research Chapters (`docs/research/`)

| ID | Chapter | Status | Last Updated |
| :--- | :--- | :--- | :--- |
| `RES-01` | [[research/01-linux-mm-and-zram-internals\|Linux Memory Management, Block Swap (zram) Limitations, and Whole-Memory Transient Compression]] | `active` | 2026-11-21 |
| `RES-02` | [[research/02-production-memory-compression\|Whole-Memory Background Compression in Client OSes and Warehouse-Scale Systems]] | `active` | 2026-11-21 |
| `RES-03` | [[research/03-algorithms-and-entropy-filtering\|Compression Codecs, Integer SWAR Entropy Pre-Filtering, and the Entropy-Expansion OOM Problem]] | `active` | 2026-11-21 |
| `RES-04` | [[research/04-tiering-coalescing-and-async-reclaim\|Background Multi-Tier Demotion, Super-Block Coalescing, and Decompression Headroom Pacing]] | `active` | 2026-11-21 |
| `RES-05` | [[research/05-rust-for-linux-block-layer\|Rust for Linux Kernel Boundaries: C Ops-Table Transient Memory Interface and Two-Layer Design]] | `active` | 2026-11-21 |
| `RES-06` | [[research/06-benchmarking-and-methodology\|Benchmarking Methodology: Whole-Memory Pressure, Entropy-Spike OOM Workloads, and Verification Harness]] | `active` | 2026-11-21 |

## 2. Living Architecture Specifications (`docs/architecture/`)

| ID | Specification | Status | Last Updated |
| :--- | :--- | :--- | :--- |
| `ARCH-ALLOCATOR` | [[architecture/allocator-and-reclaim-safety\|Fallible Allocation, Decompression Headroom Reserve, and Entropy-Expansion OOM Safety]] | `active` | 2026-11-21 |
| `ARCH-C-BOUNDARY` | [[architecture/c-ops-table-boundary\|Language-Agnostic C Ops-Table Boundary for Whole-Memory Transient Compression]] | `active` | 2026-11-21 |
| `ARCH-OVERVIEW` | [[architecture/overview-and-dataflow\|zmem Whole-Memory Transient Compression Architecture and Dataflow]] | `active` | 2026-11-21 |
| `ARCH-POLICY-TRAITS` | [[architecture/swappable-policy-traits\|Swappable Policy Engine and Rust Trait Specifications]] | `active` | 2026-11-21 |

## 3. Immutable Architecture Decision Records (`docs/adr/`)

| ADR | Decision Title | Status | Date |
| :--- | :--- | :--- | :--- |
| `ADR-001` | [[adr/001-rust-blk-mq-entry-point\|Two-Layer Whole-Memory Transient Compression Engine with C Ops Hook and Optional blk-mq Benchmark Adapter]] | `accepted` | 2026-11-21 |
| `ADR-002` | [[adr/002-language-agnostic-c-ops-table\|Language-Agnostic C Ops-Table Boundary (struct zmem_transient_ops) with Zero CONFIG_RUST Pollution in mm/]] | `accepted` | 2026-11-21 |
| `ADR-003` | [[adr/003-swappable-policy-traits\|Pluggable Swappable Policy Engine via Orthogonal Rust Traits]] | `accepted` | 2026-11-21 |

## 4. Immutable Experiment Logs (`docs/experiments/`)

See [[experiments/README|Experiment Workflow Guide]] for instructions on recording new runs.

| Date | Experiment | Status |
| :--- | :--- | :--- |
| — | *No experiment runs logged yet (see [[experiments/README]])* | — |

## 5. Glossary, Changelog & Citations (`citations/`)

* **Plain-English Terminology Glossary:** [[GLOSSARY|Plain-English Glossary of Kernel & Memory Compression Terms]]
* **Milestone Changelog:** [[CHANGELOG|Research & Architecture Milestone Changelog]]
* **Citation Index & License Registry:** [[citations/sources|Master Citation Sources Table]]
* **Private PDF Submodule Guide:** [[citations/sources#Private PDF Submodule (citations/pdfs/)|Reference PDFs Submodule Guide (citations/pdfs/)]]

## 6. Assumptions Lifecycle Registry (`#assumption`)

- [ ] **Active** ([[research/01-linux-mm-and-zram-internals|RES-01]]): `[A-RES-01-1]` Compressing and decompressing cold 4 KiB RAM pages directly through a transient page-level C ops-table (`struct zmem_transient_ops`) reduces page-fault decompression latency compared to routing pages through `struct bio` and the block layer (`/dev/zram0`).
- [ ] **Active** ([[research/01-linux-mm-and-zram-internals|RES-01]]): `[A-RES-01-2]` Decoupling `zmem` into a standalone `no_std` Rust core engine (`&[u8; 4096]` interface) plus thin kernel adapters allows identical policy code to run both as a transparent whole-memory compression layer and in a `blk-mq` benchmark harness against stock `zram` ([[adr/001-rust-blk-mq-entry-point|ADR-001]]).
- [ ] **Active** ([[research/01-linux-mm-and-zram-internals|RES-01]]): `[A-RES-01-3]` Partitioning `zmem`'s small-object arena into per-core shards with atomic 64-bit `SlotDescriptor` transitions reduces multi-core lock contention compared to `zram_table_entry` bit-spinlocks and `zsmalloc` under concurrent page faults and background compression.
- [ ] **Active** ([[research/02-production-memory-compression|RES-02]]): `[A-RES-02-1]` A dynamically sized in-RAM transient compression pool that unmaps and compresses cold pages in the background allows workloads to exceed physical uncompressed RAM capacity without manual swap-disk provisioning ([[architecture/overview-and-dataflow]]).
- [ ] **Active** ([[research/02-production-memory-compression|RES-02]]): `[A-RES-02-2]` Pacing `zmem`'s in-kernel background compression worker via Linux PSI stall counters (`memory` and `cpu` PSI `[@weiner2022tmo]`) bounds application tail-latency degradation during bursty compute phases without requiring an external userspace daemon.
- [ ] **Active** ([[research/02-production-memory-compression|RES-02]]): `[A-RES-02-3]` Combining fast pre-filtering with background multi-tier compression (`lz4` $\rightarrow$ `zstd`) outperforms single-codec static compression across workloads mixing compressible heap allocations and incompressible quantized tensors (`[@lagar2019software; @weiner2022tmo]`).
- [ ] **Active** ([[research/03-algorithms-and-entropy-filtering|RES-03]]): `[A-RES-03-1]` Sampling strided 64-byte cache lines in a 4 KiB page via 64-bit integer SWAR (`SwarCachelineProbe`) accurately classifies page compressibility with low false-negative and false-positive rates across mixed heap and quantized tensor workloads.
- [ ] **Active** ([[research/03-algorithms-and-entropy-filtering|RES-03]]): `[A-RES-03-2]` Fast-bypassing incompressible pages via `SwarCachelineProbe` reduces P99/P99.9 compression CPU latency and significantly improves **Saved Memory per CPU Cycle ($\eta_{\text{mem/cpu}}$)** during high-entropy write bursts compared to blind compression (`NoopFilter` / stock `zram` `ZRAM_HUGE` fallback, where incompressible pages yield 0 saved bytes while burning thousands of cycles).
- [ ] **Active** ([[research/03-algorithms-and-entropy-filtering|RES-03]]): `[A-RES-03-3]` Feeding `CompressibilityFilter` verdict ratios into `zmem`'s headroom controller enables early emergency compaction and clean OOM signaling during sudden entropy-expansion spikes on already-allocated memory without kernel deadlocks ([[architecture/allocator-and-reclaim-safety]]).
- [ ] **Active** ([[research/04-tiering-coalescing-and-async-reclaim|RES-04]]): `[A-RES-04-1]` An autonomous in-kernel pipeline (bounded Tier 0 staging $\rightarrow$ Tier 1 `lz4` $\rightarrow$ PSI-paced Tier 2 `zstd`) achieves lower page-reclaim tail latency than synchronous single-tier `zstd` while approaching single-tier `zstd` effective compression ratios on aged working sets.
- [ ] **Active** ([[research/04-tiering-coalescing-and-async-reclaim|RES-04]]): `[A-RES-04-2]` Maintaining a protected Decompression Headroom Reserve coupled with emergency Tier 1 $\rightarrow$ Tier 2 compaction prevents page-fault decompression deadlocks when workloads suddenly overwrite compressed memory with high-entropy data ([[architecture/allocator-and-reclaim-safety]]).
- [ ] **Active** ([[research/04-tiering-coalescing-and-async-reclaim|RES-04]]): `[A-RES-04-3]` Coalescing $N=4$ cold 4 KiB pages into a 16 KiB Tier 2 `zstd` super-block improves effective compression ratio ($\text{CR}_{\text{eff}}$) over isolated 4 KiB `zstd` pages by sharing the LZ77 sliding window and FSE/Huffman tables (`[@collet2016zstd]`), while keeping page-fault latency bounded when restricted to cold pages.
- [ ] **Active** ([[research/04-tiering-coalescing-and-async-reclaim|RES-04]]): `[A-RES-04-4]` Pressure-based progressive compression (`PressureAdaptiveTierPolicy`: starting with `None` below $W_{\text{low}}$, activating `lz4` above $W_{\text{low}}$, and escalating to `zstd` plus background `lz4` $\rightarrow$ `zstd` recompression above $W_{\text{high}}$) achieves higher **Saved Memory per CPU Cycle ($\eta_{\text{mem/cpu}}$)** across variable-load and `malloc`/`free` churn tests than always-on static `zstd`, while matching static `zstd` capacity limits under heavy memory pressure.
- [ ] **Active** ([[research/05-rust-for-linux-block-layer|RES-05]]): `[A-RES-05-1]` A language-agnostic C operations table (`struct zmem_transient_ops`) allows `zmem.ko` to register as an in-RAM transient page compressor and page-fault decompressor without adding `CONFIG_RUST` conditionals to core `mm/` headers ([[architecture/c-ops-table-boundary]], [[adr/002-language-agnostic-c-ops-table|ADR-002]]).
- [ ] **Active** ([[research/05-rust-for-linux-block-layer|RES-05]]): `[A-RES-05-2]` Pre-allocating per-CPU and per-worker compression workspaces at module initialization eliminates dynamic scratch allocations on hot compression/decompression paths and passes `CONFIG_LOCKDEP` and `CONFIG_DEBUG_ATOMIC_SLEEP` verification ([[architecture/allocator-and-reclaim-safety]]).
- [ ] **Active** ([[research/05-rust-for-linux-block-layer|RES-05]]): `[A-RES-05-3]` Passing caller-owned Rust workspace slices (`&mut [u8]`) across thin C FFI wrappers into kernel `lib/lz4` and `lib/zstd` passes `CONFIG_KASAN` verification with negligible FFI boundary overhead ([[architecture/c-ops-table-boundary]]).
- [ ] **Active** ([[research/06-benchmarking-and-methodology|RES-06]]): `[A-RES-06-1]` `virtme-ng` with host-pinned vCPUs (`--cpus` / `--cpu-host`) and fixed guest memory ceilings (`--memory`) yields low run-to-run variance (< 5% across repeated runs) for whole-memory pressure and page-fault latency benchmarks (`[@cerqueira2022virtme]`).
- [ ] **Active** ([[research/06-benchmarking-and-methodology|RES-06]]): `[A-RES-06-2]` The in-place Entropy-Spike Stress Test (allocating compressible pages exceeding physical RAM and overwriting them with pseudo-random/quantized bytes) deterministically reproduces Expansion OOM pressure and validates `zmem`'s Decompression Headroom Reserve ([[architecture/allocator-and-reclaim-safety]]).
- [ ] **Active** ([[research/06-benchmarking-and-methodology|RES-06]]): `[A-RES-06-3]` Separating debug runs (`CONFIG_KASAN=y`, `CONFIG_LOCKDEP=y`) from performance runs (`build-perf`) is required to prevent sanitizer instrumentation overhead from skewing compression and page-fault latency measurements.
