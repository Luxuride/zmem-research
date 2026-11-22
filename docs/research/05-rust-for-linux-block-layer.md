---
id: RES-05
title: "Rust for Linux Kernel Boundaries: C Ops-Table Transient Memory Interface and Two-Layer Design"
type: research-chapter
status: active
date: "2026-11-21"
tags:
  - zmem
  - research
  - rust-for-linux
  - ffi
  - c-boundary
  - blk-mq
aliases:
  - "05-rust-for-linux-block-layer"
  - "RES-05"
---

# Rust for Linux Kernel Boundaries: C Ops-Table Transient Memory Interface and Two-Layer Design

## Overview

The `rust-for-linux` project integrates memory-safe systems programming (`rust/kernel/`) into the Linux kernel [@ojeda2021rust]. To build `zmem` as a **whole-memory transient compression layer** without getting bogged down in intrusive C `mm/` rewrites or `CONFIG_RUST` header pollution, `zmem` uses a **Two-Layer Architecture** ([[adr/001-rust-blk-mq-entry-point|ADR-001]], [[adr/002-language-agnostic-c-ops-table|ADR-002]]):

1. **Layer 1 (`zmem-core` — Standalone `no_std` Rust Engine):** The entire transient compression engine—atomic slot table, 64-bit integer SWAR pre-filter, sharded size-class arenas, Tier 0/1/2 demotion state machine, 16 KiB super-block packer, and Entropy-Expansion Headroom Controller—operates on logical slot tokens and fixed `[u8; 4096]` page slices. It can be compiled, unit-tested, and stress-tested in userspace before loading into a kernel.
2. **Layer 2 (`zmem.ko` — Primary and Sub-Primary Kernel Entry Modes):** Exposes `zmem-core` to the Linux kernel through two complementary interfaces:
   * **Primary Goal (`struct zmem_transient_ops` — Whole-Memory Transient Layer):** A minimal, language-agnostic C function-pointer table ([[architecture/c-ops-table-boundary]]) for direct in-RAM page compression (`store_page`), page-fault decompression (`load_page`), slot invalidation (`evict_slot`), and headroom shrinking (`shrink_headroom`).
   * **Sub-Primary Goal (`kernel::block::mq` — Clean-Room Rust `blk-mq` Swap Device `/dev/zmem0`):** A multi-queue virtual block driver modeled on mainline `rnull` and `rbrd` [@hindborg2024rnull; @axboe2013blkmq]. Serving as both the de-risked Phase 1 kernel milestone and a controlled comparative baseline, `/dev/zmem0` allows every `zmem-core` policy trait (SWAR pre-filtering, Tier 0/1/2 demotion, 16 KiB super-blocks) to be benchmarked against stock `/dev/zram0` on identical block/swap workloads while quantifying the overhead of `blk-mq` swap vs. `struct zmem_transient_ops`.

## Literature Survey & Paper Notes

### `rust-for-linux` Fallible Allocation & VTable Idioms (Verified from Primary Sources)

* **Citation Key:** `[@ojeda2021rust]` (verified against `citations/pdfs/ojeda2021rust.pdf`; see [[citations/sources]])
* **Verified Abstractions:**
  * **Fallible Allocations Only:** Kernel Rust eliminates panicking heap allocations in favor of `KBox` and `KVec` parameterized by explicit kernel allocation flags (`GFP_KERNEL`, `GFP_NOIO`, `GFP_NOWAIT`) returning `Result<_, AllocError>` [@ojeda2021rust].
  * **Ops-Table VTable Lowering:** Across `rust/kernel/`, C subsystems that expect function-pointer structs (`struct file_operations`, `struct blk_mq_ops`, `struct zpool_driver`) are bridged by a generic Rust `Adapter<T>` that maps safe Rust trait methods onto `extern "C"` callbacks without exposing Rust types to C headers [@ojeda2021rust; @hindborg2024rnull].

### Multi-Queue Block Layer (`blk-mq`) and `block::mq::Request` (Verified from Primary Sources)

* **Citation Keys:** `[@axboe2013blkmq]`, `[@hindborg2024rnull]` (verified against `citations/pdfs/axboe2013blkmq.pdf` and `citations/pdfs/hindborg2024rnull.pdf`; see [[citations/sources]])
* **Verified Architecture:**
  * `blk-mq` eliminates the single global `request_queue` lock via per-core software staging queues and hardware dispatch queues (`hctx`), pre-allocating `struct request` descriptors during device setup up to the maximum queue depth [@axboe2013blkmq; @hindborg2024rnull].
  * In `rust/kernel/block/mq.rs`, `struct request` is wrapped in a reference-counted `ARef<Request<Self>>` passed to `Operations::queue_rq` [@hindborg2024rnull].

## Same-Level Peer Alternatives to Test Against

To evaluate the systems cost of Rust kernel abstractions, workspace management, and trait dispatch in `zmem.ko`, we compare peer alternatives at three implementation levels:

### 1. Scratch Workspace Allocation Alternatives

| Alternative ID | Workspace Ownership Model | Concurrency & Preemption Behavior | Memory Footprint |
| :--- | :--- | :--- | :--- |
| **`Scratch::PerCpuPreemptDisabled` (Stock `zram` `zcomp_strm` model)** | One workspace per logical CPU core, acquired with preemption/migration disabled (`get_cpu_ptr` / local lock) | Disables preemption across the entire `lz4`/`zstd` compression call; hurts real-time / scheduling latency | $O(\text{num\_cpus}) \times \text{sizeof(wksp)}$ |
| **`Scratch::PerTagBlkMq` (`blk-mq` `RequestData` model)** | Embedded directly inside each pre-allocated `blk-mq` `struct request` tag slot `[@axboe2013blkmq; @hindborg2024rnull]` | Preemptible task context; zero lock contention on workspace acquisition | $O(\text{queue\_depth}) \times \text{sizeof(wksp)}$ |
| **`Scratch::ShardedWorkerPool` (`zmem` transient model)** | Pre-allocated pool of `KVec<u8>` workspaces leased per active worker / per-CPU shard with `GFP_NOWAIT` fallback | Preemptible; bounded memory footprint without disabling preemption during slow `zstd` passes | $O(\text{max\_concurrent\_workers}) \times \text{sizeof(wksp)}$ |

### 2. Policy Trait Dispatch Alternatives

| Alternative ID | Rust Dispatch Mechanism | Reconfiguration Flexibility | Expected Runtime Cost |
| :--- | :--- | :--- | :--- |
| **`Dispatch::CompileTimeMonomorphized`** | Static generic parameters `ZmemEngine<E, T, F, G>` selected at compile time (`Kconfig`) | Requires module/kernel rebuild to switch policies | Zero dispatch overhead; full cross-trait LLVM inlining |
| **`Dispatch::BootTimeClosedEnum`** | Closed Rust `enum` wrappers (`match` over policy variants) selected via `insmod` `module_param` | Switch policies at module load time (`virtme-ng` test sweeps) without rebuilding | Predictable direct branch (1–2 cycles); no indirect vtable call |
| **`Dispatch::RuntimeDynVtable`** | Dynamic `Arc<dyn Trait>` / C function-pointer vtable swappable live via sysfs | Hot-swap policies while the system is running | Indirect function call per 4 KiB page (`retpoline`/`CFI` overhead; blocks cross-trait inlining) |

### 3. Codec Implementation Boundary Alternatives

| Alternative ID | Codec Execution Path | Safety & Code Duplication Trade-off |
| :--- | :--- | :--- |
| **`CodecFFI::KernelCLibShim`** | Calls existing in-kernel C `lib/lz4` and `lib/zstd` via thin FFI wrapper with caller-owned Rust `&mut [u8]` workspace | Zero codec code duplication in kernel tree; relies on `CONFIG_KASAN` + bounds-checked slice wrappers at FFI boundary |
| **`CodecFFI::PureRustNoStd`** | Pure `no_std` safe Rust `lz4` / `WKdm` / $\text{B}\Delta\text{I}$ implementation compiled directly inside `zmem-core` | 100% compile-time memory safety with zero FFI crossing; feasible for compact codecs (`lz4`, `WKdm`, $\text{B}\Delta\text{I}$) |

## Architectural Implications for `zmem` (Hypotheses Under Design)

1. **Zero `CONFIG_RUST` Pollution in Core `mm/` (`[A-RES-05-1]`):** By registering `zmem` through a pure C function-pointer table (`struct zmem_transient_ops` / `struct zpool_driver` in [[architecture/c-ops-table-boundary]]), core C memory-management code calls standard C function pointers (`ops->store_page`, `ops->load_page`) without `#ifdef CONFIG_RUST` conditionals ([[adr/002-language-agnostic-c-ops-table|ADR-002]]).
2. **Pre-Allocated Per-Core Scratch Workspaces (`[A-RES-05-2]`):** Compression and decompression scratch buffers (`lz4` hash tables, `zstd` workspaces) are pre-allocated per CPU core / worker thread at module initialization so neither synchronous page-fault decompression nor background compression performs dynamic scratch heap allocations on the hot path ([[architecture/allocator-and-reclaim-safety]]).
3. **Safe Caller-Owned FFI Shims to Kernel C Codecs (`[A-RES-05-3]`):** `zmem` invokes the kernel's battle-tested C `lib/lz4` and `lib/zstd` implementations by passing caller-owned mutable Rust slices (`&mut [u8]`) across narrow FFI wrappers ([[architecture/c-ops-table-boundary]]).

## Assumptions

- [ ] **Active:** `[A-RES-05-1]` A language-agnostic C operations table (`struct zmem_transient_ops`) allows `zmem.ko` to register as an in-RAM transient page compressor and page-fault decompressor without adding `CONFIG_RUST` conditionals to core `mm/` headers ([[architecture/c-ops-table-boundary]], [[adr/002-language-agnostic-c-ops-table|ADR-002]]). #assumption
- [ ] **Active:** `[A-RES-05-2]` Pre-allocating per-CPU and per-worker compression workspaces at module initialization eliminates dynamic scratch allocations on hot compression/decompression paths and passes `CONFIG_LOCKDEP` and `CONFIG_DEBUG_ATOMIC_SLEEP` verification ([[architecture/allocator-and-reclaim-safety]]). #assumption
- [ ] **Active:** `[A-RES-05-3]` Passing caller-owned Rust workspace slices (`&mut [u8]`) across thin C FFI wrappers into kernel `lib/lz4` and `lib/zstd` passes `CONFIG_KASAN` verification with negligible FFI boundary overhead ([[architecture/c-ops-table-boundary]]). #assumption

## What Was Tried

* **Boundary Architecture Review:** Audited `rust-for-linux` vtable adapter idioms [@ojeda2021rust] and `kernel::block::mq` request pre-allocation [@axboe2013blkmq; @hindborg2024rnull] to design the Two-Layer `zmem-core` + `struct zmem_transient_ops` boundary ([[adr/001-rust-blk-mq-entry-point|ADR-001]], [[adr/002-language-agnostic-c-ops-table|ADR-002]]).

## Conclusions

* **From Literature (`[@ojeda2021rust; @hindborg2024rnull; @axboe2013blkmq]`):** `rust-for-linux` enforces fallible `KBox`/`KVec` allocations with explicit `GFP_*` flags and bridges C subsystems via static function-pointer vtables (`Adapter<T>`), while `blk-mq` pre-allocates request descriptors across per-core queues.
* **For `zmem`:** The Two-Layer `no_std` core + C ops-table architecture de-risks kernel development by allowing full userspace testing of the transient compression engine before verifying `[A-RES-05-1]`–`[A-RES-05-3]` inside `virtme-ng`.

## Revision Log

| Date | Change | Trigger |
| :--- | :--- | :--- |
| 2026-11-21 | Reframed boundary around Two-Layer `no_std` core + `struct zmem_transient_ops` whole-memory interface | Core concept pivot & [[adr/001-rust-blk-mq-entry-point\|ADR-001]] |
