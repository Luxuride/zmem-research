---
id: GLOSSARY
title: "Plain-English Glossary of Kernel & Memory Compression Terms"
type: glossary
status: active
date: "2026-11-21"
tags:
  - zmem
  - glossary
  - terminology
  - linux-mm
aliases:
  - "Glossary"
  - "Terminology Cheat Sheet"
  - "GLOSSARY"
---

# Plain-English Glossary of Kernel & Memory Compression Terms

This glossary translates every Linux kernel, Rust-for-Linux, and memory-compression term used across the [[INDEX|zmem Knowledge Base]] into plain English.

---

## 1. Core `zmem` & Memory Compression Concepts

| Term | Plain-English Meaning |
| :--- | :--- |
| **Whole-Memory Transient Compression (`zmem`)** | Instead of making the user set up a fake swap disk, the OS quietly compresses cold 4 KiB pages of RAM in the background and frees their physical memory frames. When an application touches that memory address again, a page fault transparently decompresses the page back into a 4 KiB frame in microseconds. |
| **Entropy-Expansion OOM (Sudden Entropy Increase)** | The key pitfall in whole-memory compression: suppose 24 GiB of virtual memory fits inside 16 GiB of physical RAM because cold pages compressed 3:1. If the program suddenly overwrites those *already-allocated* pages with random/encrypted/incompressible bytes, the pages expand from ~1.3 KiB back to 4 KiB (`1:1`), consuming net new physical RAM without calling `malloc()` and potentially triggering an Out-Of-Memory (OOM) event. |
| **Decompression Headroom Reserve** | A protected emergency pool of free 4 KiB physical pages kept by `zmem` so that when a program faults on a compressed page, `zmem` *always* has a free 4 KiB frame to decompress into without deadlocking. |
| **Nominal vs. Peak Memory Used ($M_{\text{nominal\_used}}$ vs. $M_{\text{peak\_used}}$)** | **Nominal Memory Used** (`mem_used_total`) is the steady-state physical RAM consumed by compressed data and arenas. **Peak Memory Used** (`mem_used_max`) is the high-water mark reached during bursty writes, async Tier 0 staging, or background compaction. Comparing Peak vs. Nominal detects **unstable memory fluctuations** (transient overshoot spikes that could trigger an early OOM before background compression catches up). |
| **Total Memory Provided ($M_{\text{provided}}$)** | The total usable logical RAM capacity delivered to applications before hitting OOM (hot uncompressed pages + logical uncompressed bytes stored inside `zmem`). |
| **Effective Compression Ratio ($\text{CR}_{\text{eff}}$)** | The *honest* compression ratio of the compressed pool: $\frac{\text{Uncompressed Logical Bytes Stored}}{\text{Total Physical RAM Consumed (including allocator waste, Tier 0 buffers, and headroom reserve)}}$. |
| **Saved Memory per CPU Cycle ($\eta_{\text{mem/cpu}}$)** | Our core compute-efficiency metric: $\frac{\text{Logical Bytes Stored} - \text{Physical Bytes Used}}{\text{Total CPU Cycles Spent}}$. Directly penalizes approaches that burn CPU cycles compressing incompressible data or short-lived `malloc`/`free` buffers that get freed before the memory savings matter. |
| **`SWAR` (SIMD Within A Register)** | Doing fast parallel bit-tricks on 8 bytes at a time inside a normal 64-bit CPU integer register (`u64`) instead of using special FPU/SIMD vector registers (which are expensive to save and restore inside the OS kernel). `zmem` uses SWAR to check if a 4 KiB page is compressible before running `lz4` or `zstd`. |
| **Super-Block Coalescing (`CoalescedSuperBlock<4>`)** | Packing 4 cold 4 KiB pages (16 KiB total) together into one `zstd` block so the compressor can find repeating patterns *across* pages, rather than resetting its dictionary every 4 KiB. |

---

## 2. Linux Memory Management (`mm/`) Terms

| Term | Plain-English Meaning |
| :--- | :--- |
| **Page / Page Frame (4 KiB)** | The basic 4096-byte unit of memory managed by the CPU and OS. "Virtual pages" are what a program sees; "physical page frames" are the actual 4 KiB slots in hardware RAM chips. |
| **`PTE` (Page Table Entry)** | A 64-bit entry in a process's page table that maps a virtual memory address to a physical 4 KiB RAM address. When `Bit 0 (Present)` is `0`, the remaining 63 bits can store a lookup token (`slot_id`) pointing into `zmem`! |
| **Page Fault** | What happens when a program reads/writes a virtual memory address whose PTE has `Present = 0`. The CPU pauses the thread and jumps into the kernel's fault handler, which calls `zmem` to decompress the page back into RAM and sets `Present = 1`. |
| **`GFP_NOIO` / `GFP_NOWAIT`** | Flags passed when allocating memory inside the kernel. `GFP_NOIO` tells the kernel: *"If RAM is full right now, do NOT try to start new I/O or recursive page reclaim while I am already in the middle of compressing memory—just return an `Err` so I don't deadlock!"* |
| **`PSI` (Pressure Stall Information)** | Built-in Linux kernel counters (`/proc/pressure/memory` and `/proc/pressure/cpu`, introduced by Meta's TMO paper `[@weiner2022tmo]`) that measure what percentage of time threads are stalled waiting for RAM or CPU. |
| **`kstaled` / `kreclaimd`** | Two background kernel threads from Google's Far Memory paper `[@lagar2019software]`: `kstaled` checks which RAM pages haven't been touched recently (page age), and `kreclaimd` compresses cold pages in the background. |
| **`zram` vs. `zswap` vs. `zsmalloc`** | **`zram`** is Linux's compressed RAM *disk* (`/dev/zram0`, uses block I/O). **`zswap`** is an in-RAM cache that sits in front of a physical swap disk. **`zsmalloc`** is Linux's slab allocator that packs awkwardly sized compressed pages (like 1,300 bytes) into 255 size buckets (`[@minchan2014zram]`). |

---

## 3. Rust-for-Linux & Verification Terms

| Term | Plain-English Meaning |
| :--- | :--- |
| **`KBox` / `KVec`** | The Linux kernel's replacement for standard Rust `Box` and `Vec` (`[@ojeda2021rust]`). Standard `Vec::push` crashes (panics) if out of memory; `KVec::push(item, GFP_NOIO)` returns a `Result<_, AllocError>` so the kernel never crashes when RAM is full. |
| **C Ops-Table (`struct zmem_transient_ops`)** | A plain C struct of function pointers (`store_page`, `load_page`, `evict_slot`, `shrink`). It lets C kernel code call our Rust module without C files needing to know anything about Rust (`[@ojeda2021rust]`). |
| **`blk-mq` / `rnull` / `rbrd`** | `blk-mq` is Linux's multi-queue block device API (`[@axboe2013blkmq]`). `rnull` and `rbrd` are two clean-room Rust block drivers already in mainline Linux (`[@hindborg2024rnull]`) that `zmem` uses as an optional benchmark harness adapter to compare against `/dev/zram0`. |
| **`virtme-ng` (`vng`)** | A command-line tool (`[@cerqueira2022virtme]`) that boots your compiled Linux kernel inside a lightweight QEMU virtual machine in ~2 seconds using your current folder, so you can test kernel modules safely without rebooting your laptop. |
| **`KASAN` & `LOCKDEP`** | Two kernel debug modes: **`KASAN`** (Kernel Address Sanitizer) catches out-of-bounds or use-after-free memory bugs; **`LOCKDEP`** mathematically verifies that your locks can never deadlock. |
