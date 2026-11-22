---
id: ARCH-C-BOUNDARY
title: "Language-Agnostic C Ops-Table Boundary for Whole-Memory Transient Compression"
type: architecture-spec
status: active
date: "2026-11-21"
tags:
  - zmem
  - architecture
  - ffi
  - c-boundary
  - rust-for-linux
  - transient-memory
aliases:
  - "c-ops-table-boundary"
  - "ARCH-C-BOUNDARY"
---

# Language-Agnostic C Ops-Table Boundary for Whole-Memory Transient Compression

## 1. Boundary Design Rule

Per Core Architectural Rule #1 and [[adr/002-language-agnostic-c-ops-table|ADR-002]], `zmem` **never** injects `#ifdef CONFIG_RUST` or Rust-specific types into core C `mm/` headers (`include/linux/mm.h`, `include/linux/swap.h`). All interaction between the Linux kernel's C memory manager and `zmem`'s Rust implementation follows two clean boundary patterns established by `rust-for-linux` [@ojeda2021rust; @hindborg2024rnull]:

1. **Inward C-to-Rust Registration (`struct zmem_transient_ops`):** The C side defines a standard, language-agnostic struct of function pointers for transient page compression, page-fault decompression, slot invalidation, and headroom shrinking. Rust implements a safe trait (`TransientCompressionBackend`) and populates a `static` vtable via a generic adapter `Adapter<T>`.
2. **Outward Rust-to-C Primitives (Thin Helper Wrappers):** When Rust policies invoke existing in-kernel C codecs (`lib/lz4`, `lib/zstd`) or PSI stall metrics (`kernel/sched/psi.c`), calls pass through a narrow C shim header (`zmem_c_helpers.h`) using caller-owned Rust workspace buffers (`&mut [u8]`) with zero hidden allocations (`[A-RES-05-3]`).

## 2. Language-Agnostic C Transient Memory Operations Table

To operate as a transparent whole-memory compression layer without block-device (`struct bio`) indirection (`[A-RES-01-1]`, `[A-RES-05-1]`), `zmem` defines the following pure-C operations contract:

```c
/* include/linux/zmem_transient.h (Language-agnostic C contract) */
#ifndef _LINUX_ZMEM_TRANSIENT_H
#define _LINUX_ZMEM_TRANSIENT_H

#include <linux/types.h>
#include <linux/gfp.h>
#include <linux/mm_types.h>

struct zmem_ctx;

/**
 * struct zmem_headroom_stats - Live compression & entropy-expansion telemetry
 * @logical_stored_pages:      Number of 4 KiB pages currently held in zmem.
 * @physical_used_pages:       Current/nominal 0-order physical pages consumed by zmem.
 * @peak_physical_used_pages:  High-water mark of physical pages consumed (detects transient spikes).
 * @headroom_free_pages:       Protected 4 KiB frames reserved for fault expansion.
 * @incompressible_pages:      Pages flagged incompressible by SWAR pre-filter.
 * @total_cpu_cycles:          Cumulative CPU cycles spent in zmem (for Saved Memory per CPU Cycle).
 */
struct zmem_headroom_stats {
    u64 logical_stored_pages;
    u64 physical_used_pages;
    u64 peak_physical_used_pages;
    u64 headroom_free_pages;
    u64 incompressible_pages;
    u64 total_cpu_cycles;
};

/**
 * struct zmem_transient_ops - Language-agnostic whole-memory compression ops
 * @create:          Initialize transient compression pool and headroom reserve.
 * @destroy:         Tear down pool and release all backing pages.
 * @store_page:      Compress or stage a cold 4 KiB page under strict gfp_t rules.
 * @load_page:       Decompress a faulted 4 KiB page directly into dst_kaddr.
 * @evict_slot:      Invalidate and free a logical slot token on munmap/exit.
 * @shrink_headroom: Trigger emergency Tier 1->Tier 2 compaction under expansion pressure.
 * @get_stats:       Query live compression ratio and entropy-expansion headroom.
 */
struct zmem_transient_ops {
    const char *name;
    struct module *owner;

    struct zmem_ctx *(*create)(u64 max_logical_pages, gfp_t gfp);
    void (*destroy)(struct zmem_ctx *ctx);

    int (*store_page)(struct zmem_ctx *ctx, u64 slot_token,
                      const void *src_kaddr, gfp_t gfp);
    int (*load_page)(struct zmem_ctx *ctx, u64 slot_token,
                     void *dst_kaddr);
    void (*evict_slot)(struct zmem_ctx *ctx, u64 slot_token);
    unsigned long (*shrink_headroom)(struct zmem_ctx *ctx,
                                     unsigned long target_pages);
    void (*get_stats)(struct zmem_ctx *ctx,
                      struct zmem_headroom_stats *out);
};

int zmem_register_transient_ops(const struct zmem_transient_ops *ops);
void zmem_unregister_transient_ops(const struct zmem_transient_ops *ops);

#endif /* _LINUX_ZMEM_TRANSIENT_H */
```

## 3. Rust Trait Adapter (`VTable` Lowering to `zmem-core`)

On the Rust side, `ZmemTransientAdapter<P: PolicyBundle>` translates C function pointers into safe fixed-size Rust slice references (`&[u8; 4096]` and `&mut [u8; 4096]`), delegating directly to the `no_std` `zmem-core` crate ([[adr/001-rust-blk-mq-entry-point|ADR-001]]):

```rust
// Conceptual rust-for-linux vtable adapter (no kernel code lives in this repo)
pub trait TransientCompressionBackend: Send + Sync + 'static {
    fn store_page(&self, slot_token: u64, src: &[u8; 4096], gfp: Flags) -> Result;
    fn load_page(&self, slot_token: u64, dst: &mut [u8; 4096]) -> Result;
    fn evict_slot(&self, slot_token: u64);
    fn shrink_headroom(&self, target_pages: usize) -> usize;
    fn get_stats(&self) -> HeadroomStats;
}
```

### FFI Safety Invariants

1. **No Unwinding Across FFI:** All `extern "C"` callbacks are `no_std` and panic-free; every allocation and bounds check uses fallible `?` propagation converted to negative Linux `errno` integers (`-ENOMEM`, `-EIO`, `-EINVAL`) at the C boundary.
2. **Scoped Page-Mapping Lifetimes:** `src_kaddr` and `dst_kaddr` pointers obtained from `kmap_local_page()` are wrapped in temporary fixed-size references `&[u8; 4096]` that cannot escape the synchronous scope of `store_page` / `load_page`.
3. **Caller-Provided Scratch Workspaces for C Codecs (`[A-RES-05-2]`, `[A-RES-05-3]`):** When Rust calls into kernel C `LZ4_compress_default` or `zstd_compress_wksp` [@collet2013lz4; @collet2016zstd], the Rust caller passes a pre-allocated workspace slice owned by the per-CPU / worker context, guaranteeing the C codec never performs an internal `kmalloc`.
