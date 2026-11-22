---
id: RES-02
title: "Whole-Memory Background Compression in Client OSes and Warehouse-Scale Systems"
type: research-chapter
status: active
date: "2026-11-21"
tags:
  - zmem
  - research
  - transient-memory
  - far-memory
  - tmo
  - wkdm
aliases:
  - "02-production-memory-compression"
  - "RES-02"
---

# Whole-Memory Background Compression in Client OSes and Warehouse-Scale Systems

## Overview

The vision of `zmem`—where the user simply sees their system RAM while cold memory pages are transparently compressed in the background—draws directly from two lineages of systems research:
1. **Virtual Memory Compressed Caching in Client Operating Systems:** Pioneered by Wilson et al. (`WKdm`) [@wilson1999wkdm] and adopted in macOS/iOS "Compressed Memory", where cold virtual memory pages are unmapped and compressed into a dynamically sized in-RAM compressor pool without requiring a swap partition.
2. **Warehouse-Scale Software-Defined Far Memory:** Deployed at Google (`kstaled` + `kreclaimd`) [@lagar2019software] and Meta (`TMO` + `PSI`) [@weiner2022tmo], where background kernel daemons continuously age and compress cold pages in DRAM while pacing CPU/memory overhead via pressure feedback.

This chapter surveys the verified mechanisms from these primary papers and extracts the architectural requirements for `zmem`'s whole-memory transient compression layer.

## Literature Survey & Paper Notes

### Software-Defined Far Memory at Google (ASPLOS '19 — Verified from Primary Source)

* **Citation Key:** `[@lagar2019software]` (verified against `citations/pdfs/lagar2019software.pdf`; see [[citations/sources]])
* **Problem & Workload Model:** Warehouse-scale computers (WSCs) contain large amounts of cold memory that stays untouched for minutes or hours, but applications still expect transparent, microsecond-scale access when cold pages are referenced again.
* **Verified Mechanism & Results:**
  * Operates entirely in the background without application changes using two cooperating Linux kernel daemons:
    1. **`kstaled`:** Periodically walks process page tables to inspect and clear hardware PTE accessed bits and maintains per-page age histograms (consuming < 0.3% average CPU) [@lagar2019software].
    2. **`kreclaimd`:** Proactively reclaims cold pages older than a dynamically tuned age threshold into **`zswap`** (in-DRAM compressed memory), freeing their 4 KiB physical page frames [@lagar2019software].
  * Achieves a **3x median compression ratio** (67% memory savings on compressed pages, ranging from 2x to 6x across applications) and a **4–5% fleet-wide reduction in DRAM TCO** while adding < 0.5% median CPU overhead for compression and decompression [@lagar2019software].

### Transparent Memory Offloading (TMO) at Meta (ASPLOS '22 — Verified from Primary Source)

* **Citation Key:** `[@weiner2022tmo]` (verified against `citations/pdfs/weiner2022tmo.pdf`; see [[citations/sources]])
* **Problem & Workload Model:** Background memory compression and offloading must know how aggressively it can compress cold RAM without starving latency-sensitive applications of CPU or causing refault thrashing.
* **Verified Mechanism & Results:**
  * Introduces **Pressure Stall Information (PSI)** in the Linux kernel (`some` and `full` stall percentages across CPU, memory, and I/O) and **Senpai**, a proactive controller that reads PSI metrics to modulate memory reclamation [@weiner2022tmo].
  * Offloads cold anonymous and file-cache pages to compressed DRAM (`zswap`, where the authors evaluated `lzo`, `lz4`, and `zstd` and selected **`zstd`** for its ~3x representative production compression ratio) or NVMe SSDs, saving 13–32% total memory across representative workloads [@weiner2022tmo].
  * Explicitly documents that **machine learning models used for Ads prediction commonly use quantized byte-encoded values that exhibit low compressibility** [@weiner2022tmo].

### VM Compressed Caching and Cache-Line Compression (`WKdm` & `BDI` — Verified from Primary Sources)

* **Citation Keys:** `[@wilson1999wkdm]`, `[@pekhimenko2012bdi]` (verified against `citations/pdfs/wilson1999wkdm.pdf` and `citations/pdfs/pekhimenko2012bdi.pdf`; see [[citations/sources]])
* **Verified Mechanisms:**
  * **WKdm Compressed Caching [@wilson1999wkdm]:** Dynamically partitions physical RAM between uncompressed page frames and a compressed virtual-memory cache. Uses a 16-word direct-mapped dictionary of recently seen 32-bit words with 2-bit tags (zero word, exact 32-bit match, upper 22-bit match + 10-bit low offset, or 32-bit literal), achieving ~2:1 compression on program memory.
  * **Base-Delta-Immediate ($\text{B}\Delta\text{I}$) [@pekhimenko2012bdi]:** Compresses 64-byte cache lines relative to an implicit zero base and an explicit 2/4/8-byte base plus 1/2/4-byte immediate deltas, achieving a 1.53x average effective compression ratio.

## Same-Level Peer Alternatives to Test Against

To evaluate how background whole-memory compression should be triggered and paced, `zmem` compares five **same-level pacing controllers** implementing the `ExecutionPolicy` trait ([[architecture/swappable-policy-traits]]):

| Alternative ID | Reclaim Trigger & Pacing Mechanism | Inspiration / Lineage | Expected Strength | Expected Cost / Failure Mode |
| :--- | :--- | :--- | :--- | :--- |
| **`Pacing::OnDemandReclaimSync`** | Reactive only: compresses synchronously on the allocating/reclaiming thread when free RAM hits hard watermarks | Mainline `zram` / synchronous `zswap` `[@minchan2014zram]` | Zero background CPU usage when memory fits in RAM | Severe P99/P99.9 latency spikes when direct reclaim hits `zstd` compression |
| **`Pacing::StaticWatermarkKthread`** | Background `kthread` wakes at fixed free-RAM watermarks ($W_{\text{low}}, W_{\text{high}}$) and compresses fixed-size page batches | Classic OS watermark daemon | Simple, deterministic state machine with zero PSI dependency | Blind to application CPU contention; can steal CPU cycles during compute bursts |
| **`Pacing::AgeHistogramKstaled`** | Background scanner tracks page-table accessed bits and compresses pages older than cold-age threshold $T_{\text{age}}$ | Google Far Memory (`kstaled` + `kreclaimd`) `[@lagar2019software]` | Avoids compressing warm pages that would immediately refault | Page-table scanning adds background CPU overhead; requires age-threshold tuning |
| **`Pacing::InKernelPsiFeedback`** | In-kernel background worker dynamically modulates compression batch size using live Memory PSI and CPU PSI stall ratios | Meta TMO (`PSI`) adapted in-kernel `[@weiner2022tmo]` | Automatically throttles compression during CPU spikes and accelerates under memory stalls | Sensitive to PSI window averaging lag during sub-millisecond memory spikes |
| **`Pacing::UserspaceSysfsController`** | External userspace daemon polls `/proc/pressure/*` and writes to `/sys/` to trigger recompression batches | Mainline `zram` `recompress` + Meta `Senpai` `[@lee2023zramtier; @weiner2022tmo]` | Easy to tune complex policies in userspace without recompiling kernel code | Userspace daemon can be starved or OOM-stalled under sudden kernel memory exhaustion |

## Architectural Implications for `zmem` (Hypotheses Under Design)

1. **Seamless Background Whole-Memory Compression (`[A-RES-02-1]`):** Like Google's `kstaled`/`kreclaimd` [@lagar2019software] and Wilson et al.'s dynamic compressed VM cache [@wilson1999wkdm], `zmem` is designed to grow and shrink its compressed arenas dynamically within physical RAM—requiring zero static swap-partition sizing by the user ([[architecture/overview-and-dataflow]]).
2. **In-Kernel PSI-Paced Background Scanner & Demotion (`[A-RES-02-2]`):** `zmem`'s `ExecutionPolicy` trait ([[architecture/swappable-policy-traits]]) uses in-kernel CPU and Memory PSI stall counters [@weiner2022tmo] to pace background cold-page scanning and Tier 1 (`lz4`) $\rightarrow$ Tier 2 (`zstd`) demotion so background compression pauses automatically during application CPU spikes.
3. **Adapting to Workload Compressibility Shifts (`[A-RES-02-3]`):** Because whole-memory workloads can shift dynamically from 2x–6x compressible heap structures [@lagar2019software] to incompressible quantized ML tensors [@weiner2022tmo], `zmem` must pair swappable policy traits ([[adr/003-swappable-policy-traits|ADR-003]]) with real-time entropy-expansion headroom monitoring ([[research/03-algorithms-and-entropy-filtering]]).

## Assumptions

- [ ] **Active:** `[A-RES-02-1]` A dynamically sized in-RAM transient compression pool that unmaps and compresses cold pages in the background allows workloads to exceed physical uncompressed RAM capacity without manual swap-disk provisioning ([[architecture/overview-and-dataflow]]). #assumption
- [ ] **Active:** `[A-RES-02-2]` Pacing `zmem`'s in-kernel background compression worker via Linux PSI stall counters (`memory` and `cpu` PSI `[@weiner2022tmo]`) bounds application tail-latency degradation during bursty compute phases without requiring an external userspace daemon. #assumption
- [ ] **Active:** `[A-RES-02-3]` Combining fast pre-filtering with background multi-tier compression (`lz4` $\rightarrow$ `zstd`) outperforms single-codec static compression across workloads mixing compressible heap allocations and incompressible quantized tensors (`[@lagar2019software; @weiner2022tmo]`). #assumption

## What Was Tried

* **Literature Synthesis & Comparative Taxonomy:** Audited primary papers for Google Far Memory [@lagar2019software], Meta TMO [@weiner2022tmo], WKdm [@wilson1999wkdm], $\text{B}\Delta\text{I}$ [@pekhimenko2012bdi], and Linux `zram` [@minchan2014zram; @lee2023zramtier] to define the design requirements for a transparent whole-memory transient compression layer in Linux.

## Conclusions

* **From Literature (`[@lagar2019software; @weiner2022tmo; @wilson1999wkdm]`):** Whole-memory compressed caching (`WKdm`) and datacenter far-memory systems (`kstaled`/`kreclaimd`, `TMO`) demonstrate that background cold-page compression in RAM achieves ~2x–3x median compression ratios while remaining transparent to applications, provided background compression is paced by page age and pressure feedback (`PSI`).
* **For `zmem`:** The effectiveness of `zmem`'s dynamic pool sizing, in-kernel PSI pacing, and multi-tier policies are tracked under active assumptions `[A-RES-02-1]`–`[A-RES-02-3]` to be evaluated in [[experiments/README|docs/experiments/]].

## Revision Log

| Date | Change | Trigger |
| :--- | :--- | :--- |
| 2026-11-21 | Focused chapter on whole-memory background compression (`kstaled`/`kreclaimd`, PSI, WKdm) and active `zmem` assumptions | Core concept pivot |
