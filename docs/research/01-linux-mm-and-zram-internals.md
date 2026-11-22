---
id: RES-01
title: "Linux Memory Management, Block Swap (zram) Limitations, and Whole-Memory Transient Compression"
type: research-chapter
status: active
date: "2026-11-21"
tags:
  - zmem
  - research
  - linux-mm
  - transient-memory
  - zram
  - zsmalloc
aliases:
  - "01-linux-mm-and-zram-internals"
  - "RES-01"
---

# Linux Memory Management, Block Swap (`zram`) Limitations, and Whole-Memory Transient Compression

## Overview

In Linux, in-memory compression has historically been retrofitted onto the **disk swap subsystem** (`zram` and `zswap`) [@minchan2014zram]. Under `zram`, the operating system treats a slice of RAM as a virtual block device (`/dev/zram<id>`), requiring users or distributions to configure a fake swap disk (`mkswap`, `swapon`) and forcing every compressed page through block-layer I/O structures (`struct bio`, sector translation, and block request queues).

By contrast, **`zmem` is designed as a transparent, transient compression layer over whole memory**: users simply see their system RAM, while cold physical pages are transparently compressed in the background and expanded directly back into 4 KiB page frames on page fault without block-layer indirection ([[architecture/overview-and-dataflow]], [[architecture/c-ops-table-boundary]]). This chapter examines how Linux `mm/` manages page reclamation, how mainline `zram` and `zsmalloc` work internally [@minchan2014zram; @lee2023zramtier], and why a direct transient memory layer differs fundamentally from a virtual swap disk.

## Literature Survey & Paper Notes

### Mainline `zram` and `zsmalloc` Internals (Verified from Primary Sources)

* **Primary References:** `[@minchan2014zram]`, `[@lee2023zramtier]` (verified against `citations/pdfs/minchan2014zram.pdf` and `citations/pdfs/lee2023zramtier.pdf`; see [[citations/sources]])
* **Block-Device Indirection (`drivers/block/zram/zram_drv.c`):**
  * `zram` exposes virtual RAM-based block devices named `/dev/zram<id>` [@minchan2014zram]. To use `zram` for memory compression, the kernel must go through the swap-out block I/O path (`swap_writepage` $\rightarrow$ `struct bio` $\rightarrow$ `zram_submit_bio`).
  * Each 4 KiB sector index maps to an entry in `zram->table` (`struct zram_table_entry`) storing a `zsmalloc` handle (`handle` / `value`), a bit-spinlock (`ZRAM_LOCK`), and status flags including `ZRAM_SAME` (constant-word page consuming zero `zsmalloc` allocation), `ZRAM_HUGE` (incompressible page whose compressed size exceeds `huge_class_size`, stored uncompressed in a 0-order physical page), `ZRAM_WB`, `ZRAM_IDLE`, and `ZRAM_INCOMPRESSIBLE` [@minchan2014zram; @lee2023zramtier].
  * Kernel documentation notes that `zram` defaults to a disksize configuration assuming roughly a 2:1 compression ratio and consumes ~0.1% of the disksize for metadata when empty [@minchan2014zram].
* **`zsmalloc` Allocator (`Documentation/mm/zsmalloc.rst`):**
  * `zsmalloc` packs variable-sized compressed objects into composite slab allocations called *zspages* formed by chaining 1 to 4 non-contiguous 0-order physical pages (`CONFIG_ZSMALLOC_CHAIN_SIZE`, default 4) [@minchan2014zram].
  * It defines **255 size classes** (`#0` through `#254`, up to 4096 bytes) and merges adjacent size classes that share identical `pages_per_zspage` and `objs_per_zspage` characteristics (for example, size classes `#95–#99` merge into `#100` for objects up to 1632 bytes across 2 physical pages, while `#254` stores a 4096-byte huge object in a dedicated physical page) [@minchan2014zram].
* **Multi-Algorithm Recompression (`CONFIG_ZRAM_MULTI_COMP`):**
  * Mainline `zram` allows registering secondary compression algorithms (`ZRAM_PRIMARY_COMP` plus alternative algorithms ranked by `priority`) via `/sys/block/zramX/recomp_algorithm` and triggering recompression manually via `/sys/block/zramX/recompress` (`type=idle`, `type=huge`, `type=huge_idle`, `threshold=<bytes>`) [@minchan2014zram; @lee2023zramtier].

### Why Block-Device Swap (`zram`) Is Not True Whole-Memory Transient Compression

1. **Block-Layer & Swap-Subsystem Tax:** Routing in-RAM page compression through `struct bio` construction and block-device sector lookups adds unnecessary indirection when both the source and destination reside in DRAM.
2. **Manual Swap Partition Semantics:** Users must explicitly size and enable `/dev/zram0` as a swap partition rather than having the OS transparently compress cold pages across system memory in the background ([[research/02-production-memory-compression]]).
3. **Lack of Entropy-Expansion Headroom Coupling:** When memory is transparently compressed in the background, processes see expanded effective RAM capacity while their pages are low-entropy. If a process suddenly overwrites existing compressed pages with high-entropy data, pages re-expand to full 4 KiB frames—a hazard that requires direct coordination between the transient compression pool, entropy pre-filtering, and an emergency decompression headroom reserve ([[research/03-algorithms-and-entropy-filtering]], [[architecture/allocator-and-reclaim-safety]]).

## Same-Level Peer Alternatives to Test Against

To evaluate `zmem`'s kernel integration and arena concurrency fairly, all competing alternatives below are defined at the **same abstraction level** (wrapping the identical `zmem-core` compression policies or running identical 4 KiB page streams):

### 1. Kernel Memory Entry Boundary Alternatives

| Alternative ID | Entry Mechanism | Abstraction Level | Expected Strength | Expected Cost / Failure Mode |
| :--- | :--- | :--- | :--- | :--- |
| **`Entry::DirectTransientOps` (Primary)** | Direct C ops-table (`struct zmem_transient_ops`) called on background page unmap & page fault | Direct RAM folio / virtual address (`&[u8; 4096]`) | Zero block-layer (`struct bio`) or request-queue overhead; no swap disk setup | Requires thin C registration hook in reclaim/fault path |
| **`Entry::ZpoolBackend` (Sub-Primary)** | Registers `zmem-core` as a mainline `struct zpool_driver` (`mm/zpool.c` under `zswap`) | In-RAM `zpool` driver ops table | Uses existing mainline `mm/zpool.h` C vtable with zero kernel patches | Coupled to `zswap`'s frontswap lifecycle and swap-entry expectations |
| **`Entry::BlkMqSwap` (Sub-Primary)** | Clean-room Rust `kernel::block::mq` virtual swap device (`/dev/zmem0`, modeled on `rbrd`) | Multi-queue block device (`ARef<Request>`) | Loads as an unmodified out-of-tree/in-tree block module; direct `fio` parity with `zram` | Pays full `swap_writepage` $\rightarrow$ `struct bio` $\rightarrow$ `blk-mq` tag dispatch cost |
| **`Baseline::StockZramBio` (Reference)** | Mainline C `zram` (`drivers/block/zram/`) via `zram_submit_bio` | Direct `submit_bio` block driver | Production Linux baseline (`lz4`, `zstd`, `CONFIG_ZRAM_MULTI_COMP`) | Synchronous write compression; post-compression `ZRAM_HUGE` fallback |

### 2. Slot Index & Arena Concurrency Alternatives

| Alternative ID | Synchronization & Arena Model | Expected Strength | Expected Cost / Failure Mode |
| :--- | :--- | :--- | :--- |
| **`Arena::BitSpinlockShared` (Stock `zram` model)** | Per-slot bit-spinlock (`ZRAM_LOCK` equivalent) + shared size-class pools | Minimal metadata memory footprint | Cross-core cache-line bouncing and lock contention at high thread counts |
| **`Arena::RwLockPartitioned`** | Fixed $P$-way reader-writer lock (`RwLock`) partitioning the slot table and arena | Simple lockdep verification; fast concurrent reads | Writer contention under parallel background compression or multi-core faults |
| **`Arena::AtomicSlotPerCoreShards` (`zmem` target)** | Lock-free atomic 64-bit `SlotDescriptor` (`cmpxchg`) + per-CPU / per-`hctx` sharded arenas | Eliminates cross-core spinlock contention on local shard allocations | Can suffer shard capacity imbalance if pages are compressed on one core and freed on another |

## Architectural Implications for `zmem` (Hypotheses Under Design)

1. **Direct Transient Page-Level Layer via Language-Agnostic C Ops-Table (`[A-RES-01-1]`):** Instead of requiring users to manage a block swap disk, `zmem` exposes a language-agnostic C operations table (`struct zmem_transient_ops` in [[architecture/c-ops-table-boundary]], [[adr/002-language-agnostic-c-ops-table|ADR-002]]) that accepts cold 4 KiB pages directly from memory reclaim / background cold-page scanning (`store_page`), leaves a compact 64-bit token in the unmapped page-table entry (PTE), and decompresses directly back into a 4 KiB page frame on page fault (`load_page`).
2. **Two-Layer Implementation (`no_std` Rust Core + Thin Kernel Wrapper) (`[A-RES-01-2]`):** As formalized in [[adr/001-rust-blk-mq-entry-point|ADR-001]], `zmem`'s entire slot table, SWAR entropy pre-filter, tiered arenas, and headroom controller live in a pure `no_std` Rust core engine operating on `(slot_id, &[u8; 4096])`. This engine connects primarily to the direct transient memory C ops-table, while also supporting a thin `blk-mq` / `zpool` adapter so standard block benchmarks (`fio`) can compare `zmem` head-to-head against stock `zram`.
3. **Lock-Free Atomic Slot Descriptors & Sharded Arenas (`[A-RES-01-3]`):** `zmem` replaces `zram_table_entry` bit-spinlocks (`ZRAM_LOCK`) with atomic 64-bit `SlotDescriptor` entries and per-CPU/per-shard small-object arenas ([[architecture/overview-and-dataflow]], [[architecture/allocator-and-reclaim-safety]]).

## Assumptions

> [!IMPORTANT]
> Per repository consistency rules (`scripts/check_consistency.ts`), all `zmem` claims remain `- [ ] **Active:**` assumptions until empirically tested and linked to an executed experiment log in `docs/experiments/`.

- [ ] **Active:** `[A-RES-01-1]` Compressing and decompressing cold 4 KiB RAM pages directly through a transient page-level C ops-table (`struct zmem_transient_ops`) reduces page-fault decompression latency compared to routing pages through `struct bio` and the block layer (`/dev/zram0`). #assumption
- [ ] **Active:** `[A-RES-01-2]` Decoupling `zmem` into a standalone `no_std` Rust core engine (`&[u8; 4096]` interface) plus thin kernel adapters allows identical policy code to run both as a transparent whole-memory compression layer and in a `blk-mq` benchmark harness against stock `zram` ([[adr/001-rust-blk-mq-entry-point|ADR-001]]). #assumption
- [ ] **Active:** `[A-RES-01-3]` Partitioning `zmem`'s small-object arena into per-core shards with atomic 64-bit `SlotDescriptor` transitions reduces multi-core lock contention compared to `zram_table_entry` bit-spinlocks and `zsmalloc` under concurrent page faults and background compression. #assumption

## What Was Tried

* **Static Documentation & Kernel Source Audit:** Audited `Documentation/admin-guide/blockdev/zram.rst`, `Documentation/mm/zsmalloc.rst` [@minchan2014zram], and `drivers/block/zram/zram_drv.c` [@lee2023zramtier] to contrast block-device swap (`zram`) against a direct whole-memory transient compression layer and formulate `[A-RES-01-1]` through `[A-RES-01-3]`.

## Conclusions

* **From Literature (`[@minchan2014zram; @lee2023zramtier]`):** Mainline `zram` implements in-memory compression by emulating a block swap device (`/dev/zram<id>`) backed by `zsmalloc`'s 255 size classes, performing synchronous primary compression on `zram_submit_bio`, classifying incompressible pages as `ZRAM_HUGE` only after running the primary compressor, and requiring explicit userspace sysfs writes for multi-algorithm recompression (`CONFIG_ZRAM_MULTI_COMP`).
* **For `zmem`:** The latency, contention, and architectural advantages of bypassing block-device swap in favor of a direct whole-memory transient compression layer are tracked as active assumptions `[A-RES-01-1]`–`[A-RES-01-3]` pending evaluation in [[experiments/README|docs/experiments/]].

## Revision Log

| Date | Change | Trigger |
| :--- | :--- | :--- |
| 2026-11-21 | Centered research on whole-memory transient compression vs. block-device swap (`zram`); verified kernel docs | Core concept pivot & [[adr/001-rust-blk-mq-entry-point\|ADR-001]] |
