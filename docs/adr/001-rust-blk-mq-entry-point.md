---
id: ADR-001
title: "Two-Layer Whole-Memory Transient Compression Engine with C Ops Hook and Optional blk-mq Benchmark Adapter"
type: adr
status: accepted
date: "2026-11-21"
tags:
  - zmem
  - adr
  - architecture
  - transient-memory
  - rust-for-linux
  - blk-mq
aliases:
  - "ADR-001"
  - "001-rust-blk-mq-entry-point"
---

# ADR-001: Two-Layer Whole-Memory Transient Compression Engine with C Ops Hook and Optional `blk-mq` Benchmark Adapter

## Status

Accepted (2026-11-21)

## Context

Mainline `zram` [@minchan2014zram] implements in-memory compression by emulating a virtual block device (`/dev/zram0`), requiring explicit swap-disk provisioning (`mkswap`, `swapon`) and routing every 4 KiB page through the block I/O layer (`struct bio`).

Our core design goal for `zmem` is a **transparent, transient compression layer over whole memory** (analyzed in [[research/01-linux-mm-and-zram-internals]] and [[research/02-production-memory-compression]]):
* Users simply see their system RAM while cold 4 KiB pages are unmapped and compressed in the background (`kstaled`/`kreclaimd` and `WKdm` model [@lagar2019software; @wilson1999wkdm]).
* Page faults decompress cold pages directly back into 4 KiB frames in RAM without block-device indirection, while guarding against **Sudden Entropy-Increase / Expansion OOM** ([[research/03-algorithms-and-entropy-filtering]], [[architecture/allocator-and-reclaim-safety]]).
* At the same time, we must keep engineering scope tractable for a Master's thesis and retain the ability to run apples-to-apples `fio` microbenchmarks against stock `/dev/zram0` ([[research/06-benchmarking-and-methodology]]).

## Decision

We structure `zmem` as a **Two-Layer Architecture** ([[architecture/overview-and-dataflow]], [[research/05-rust-for-linux-block-layer]]):

1. **Layer 1 (`zmem-core` — Standalone `no_std` Rust Transient Compression Engine):**
   * Operates purely on logical 64-bit slot tokens and `[u8; 4096]` page slices (`store_page`, `load_page`, `evict_slot`, `shrink_headroom`).
   * Houses the atomic `SlotIndex`, 64-bit integer SWAR pre-filter (`CompressibilityFilter`), Tier 0/1/2 demotion pipeline (`ExecutionPolicy`, `TierPolicy`), 16 KiB super-block packer (`StorageGranularity`), and **Decompression Headroom Reserve**.
   * Can be compiled, unit-tested, and stress-tested in userspace (`cargo test`) against memory-trace and entropy-spike simulators before loading into a kernel.
2. **Layer 2 (`zmem.ko` — Dual Kernel Entry Adapters for Primary and Sub-Primary Goals):**
   * **Primary Goal — Whole-Memory Transient Hook (`struct zmem_transient_ops`):** Registers `zmem-core` via a minimal, language-agnostic C operations table ([[architecture/c-ops-table-boundary]], [[adr/002-language-agnostic-c-ops-table|ADR-002]]) for direct background cold-page compression and page-fault decompression over whole system RAM.
   * **Sub-Primary Goal — Clean-Room Rust `blk-mq` Swap Driver (`kernel::block::mq`):** Exposes the exact same `zmem-core` engine as a loadable Rust `blk-mq` virtual block device (`/dev/zmem0`, modeled on mainline `rnull` and `rbrd` [@hindborg2024rnull; @axboe2013blkmq]). This sub-primary target serves two essential roles:
     1. It provides a self-contained, upstream-proven `rust-for-linux` block driver entry point for evaluating all four swappable policy traits ([[adr/003-swappable-policy-traits|ADR-003]]) head-to-head against stock `/dev/zram0` using identical `fio` and `mmtests` swap workloads.
     2. Comparing `/dev/zmem0` (sub-primary `blk-mq` swap path) against `struct zmem_transient_ops` (primary whole-memory transient path) while holding `zmem-core` policies constant quantifies the exact latency and CPU overhead of the Linux block-swap layer (`[A-RES-01-1]`, `[A-RES-01-2]`).

## Consequences

### Positive

* **True Whole-Memory Transient Semantics:** Eliminates block-layer (`struct bio`) overhead on the primary transient memory path while preserving user transparency.
* **De-Risked Development & Testing:** 90% of `zmem` (`zmem-core`) can be developed and verified in userspace against deterministic entropy-expansion workloads before kernel testing in `virtme-ng` [@cerqueira2022virtme].
* **Apples-to-Apples `zram` Baselines:** The thin `blk-mq` adapter allows `fio` to benchmark `zmem-core`'s SWAR filter and tiering policies directly against `/dev/zram0` (`[A-RES-01-2]`).

### Negative / Trade-offs

* Maintaining two thin kernel adapters (`struct zmem_transient_ops` and `kernel::block::mq::Operations`) over `zmem-core` requires keeping `zmem-core` strictly agnostic of `struct bio` vs. `struct folio` types (operating exclusively on `(slot_token: u64, page: &[u8; 4096])`).
