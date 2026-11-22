---
id: ADR-002
title: "Language-Agnostic C Ops-Table Boundary (struct zmem_transient_ops) with Zero CONFIG_RUST Pollution in mm/"
type: adr
status: accepted
date: "2026-11-21"
tags:
  - zmem
  - adr
  - architecture
  - ffi
  - c-boundary
  - transient-memory
aliases:
  - "ADR-002"
  - "002-language-agnostic-c-ops-table"
---

# ADR-002: Language-Agnostic C Ops-Table Boundary (`struct zmem_transient_ops`) with Zero `CONFIG_RUST` Pollution in `mm/`

## Status

Accepted (2026-11-21)

## Context

To operate as a whole-memory transient compression layer ([[adr/001-rust-blk-mq-entry-point|ADR-001]]), `zmem` must intercept cold 4 KiB pages during background scanning/reclaim (`store_page`), decompress faulted pages directly on page fault (`load_page`), free invalidated slots on `munmap`/`exit` (`evict_slot`), and compact headroom during sudden entropy-expansion spikes (`shrink_headroom`).

However, scattering `#ifdef CONFIG_RUST` blocks or calling Rust symbols directly from C `mm/` files violates kernel subsystem encapsulation and is a non-starter for upstream Linux `mm/` maintainers [@ojeda2021rust]. Furthermore, `zmem` needs to invoke existing in-kernel C codecs (`lib/lz4`, `lib/zstd`) and PSI metrics (`kernel/sched/psi.c`) without risking hidden `kmalloc` allocations under reclaim pressure [@collet2013lz4; @collet2016zstd; @weiner2022tmo].

## Decision

We mandate a **strict, language-agnostic C operations-table (`struct zmem_transient_ops`) and thin C helper shim boundary** (specified in [[architecture/c-ops-table-boundary]]):

1. **Zero `CONFIG_RUST` in Core C Paths (`[A-RES-05-1]`):** The C interface header (`include/linux/zmem_transient.h`) is pure, standard C using an opaque context pointer (`struct zmem_ctx *`) and function pointers (`store_page`, `load_page`, `evict_slot`, `shrink_headroom`, `get_stats`).
2. **Rust VTable Lowering:** Following `rust/kernel/` idioms (`Adapter<T>`), `zmem.ko` implements the `TransientCompressionBackend` Rust trait and registers a `static zmem_transient_ops` vtable at module initialization [@ojeda2021rust; @hindborg2024rnull].
3. **Caller-Owned Workspaces Across Codec FFI (`[A-RES-05-2]`, `[A-RES-05-3]`):** Every outward call from Rust into C `lib/lz4` or `lib/zstd` passes an explicit pre-allocated workspace buffer (`wksp: &mut [u8]`) owned by Rust, ensuring C codecs never perform internal dynamic allocations during page-fault decompression or background reclaim ([[architecture/allocator-and-reclaim-safety]]).

## Consequences

### Positive

* **Upstream Maintainability:** C memory-management code interacts only with a conventional Linux ops-table struct; Rust owns all internal lifetime, concurrency, SWAR filtering, tiering, and headroom state machines behind the vtable.
* **`KASAN` & `LOCKDEP` Auditable:** Narrow, fixed-signature C/Rust boundary functions (`&[u8; 4096]`) are straightforward to verify under `CONFIG_KASAN` and `CONFIG_LOCKDEP` ([[research/06-benchmarking-and-methodology]]).

### Negative / Trade-offs

* Crossing the ops-table boundary incurs an indirect function pointer call across the C/Rust vtable boundary rather than cross-language LTO inlining.
