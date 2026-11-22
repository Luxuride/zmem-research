---
id: ADR-003
title: "Pluggable Swappable Policy Engine via Orthogonal Rust Traits"
type: adr
status: accepted
date: "2026-11-21"
tags:
  - zmem
  - adr
  - architecture
  - policy-engine
  - rust-traits
aliases:
  - "ADR-003"
  - "003-swappable-policy-traits"
---

# ADR-003: Pluggable Swappable Policy Engine via Orthogonal Rust Traits

## Status

Accepted (2026-11-21)

## Context

The core research contribution of the `zmem` Master's thesis ([[INDEX|zmem Knowledge Base]]) is a systematic empirical evaluation of four open design dimensions in whole-memory transient compression:
1. **Entropy Pre-Filtering & Entropy-Spike Sensing (`CompressibilityFilter`):** Blind compression vs. fast 64-bit integer SWAR cache-line probes (`SwarCachelineProbe`) vs. `lz4` early-abort heuristics—both to avoid wasted CPU cycles on incompressible data (such as quantized ML weights [@weiner2022tmo]) and to detect sudden entropy increases early ([[research/03-algorithms-and-entropy-filtering]]).
2. **Execution & Headroom Pacing Model (`ExecutionPolicy`):** Synchronous on-unmap compression (`DirectSync`) vs. asynchronous PSI-paced background demotion (`AsyncPsiHeadroomPolicy`) with emergency compaction when the **Decompression Headroom Reserve** drops during sudden entropy-expansion spikes ([[research/02-production-memory-compression]], [[research/04-tiering-coalescing-and-async-reclaim]], [[architecture/allocator-and-reclaim-safety]]).
3. **Tiering Pipeline (`TierPolicy`):** Single-tier (`lz4` or `zstd`) vs. multi-tier (`Tier 0 raw -> Tier 1 lz4 -> Tier 2 zstd`) [@collet2013lz4; @collet2016zstd; @lee2023zramtier].
4. **Storage Granularity (`StorageGranularity`):** Fixed 4 KiB page slots vs. 16 KiB ($N=4$) coalesced cold super-blocks with sub-page invalidation bitmaps ([[research/04-tiering-coalescing-and-async-reclaim]]).

If these mechanisms are entangled in monolithic control flow (as in stock `zram_drv.c` [@minchan2014zram]), it becomes impossible to attribute tail-latency, compression-ratio, or expansion-OOM survival improvements to a single mechanism.

## Decision

We isolate all four research dimensions behind orthogonal Rust traits in `ZmemEngine<E, T, F, G>` (specified in [[architecture/swappable-policy-traits]]):
* `F: CompressibilityFilter`
* `E: ExecutionPolicy`
* `T: TierPolicy`
* `G: StorageGranularity`

Each trait supports both **compile-time generic monomorphization** and **boot-time `module_param` enum dispatch** so `virtme-ng` benchmark sweeps ([[research/06-benchmarking-and-methodology]]) can toggle individual axes (`filter_policy`, `exec_policy`, `tier_policy`, `granularity`) in a single test session without rebuilding the kernel.

## Consequences

### Positive

* **Rigorous Ablation Studies:** Enables clean 1-factor-at-a-time A/B experiments while keeping the slot table, C ops-table boundary, and sharded arena identical.
* **Compile-Time Invariant Enforcement:** Trait signatures enforce that every policy operates on pre-allocated `&mut Scratch` workspaces and respects `GFP_NOIO` and headroom constraints ([[architecture/allocator-and-reclaim-safety]]).

### Negative / Trade-offs

* Requires explicit value types (`FilterVerdict`, `HeadroomLevel`, `DemoteAction`) so the SWAR entropy pre-filter, headroom reserve, and background compaction worker communicate cleanly across trait boundaries.
