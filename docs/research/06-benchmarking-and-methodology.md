---
id: RES-06
title: "Benchmarking Methodology: Whole-Memory Pressure, Entropy-Spike OOM Workloads, and Verification Harness"
type: research-chapter
status: active
date: "2026-11-21"
tags:
  - zmem
  - research
  - benchmarking
  - virtme-ng
  - fio
  - mmtests
  - oom
  - kasan
  - lockdep
aliases:
  - "06-benchmarking-and-methodology"
  - "RES-06"
---

# Benchmarking Methodology: Whole-Memory Pressure, Entropy-Spike OOM Workloads, and Verification Harness

## Overview

Evaluating `zmem` as a **whole-memory transient compression layer** follows an **adversarial, limit-finding ("break-point") methodology**. Rather than running only comfortable steady-state workloads where every configuration succeeds with minor percentage differences, our benchmark suite systematically pushes every competing approach—and every multi-option combination—to its **breaking point in every direction** (capacity exhaustion, sudden entropy expansion, sub-page invalidation churn, multi-core write floods, and CPU starvation).

In each extreme test regime, most approaches are expected to **degrade sharply or fail (OOM, thrash, or hit tail-latency cliffs)**, leaving only a small subset of survivors—while those surviving approaches expose their own inherent drawbacks (such as higher CPU compute usage, peak-memory fluctuation overshoot, or lower maximum capacity) when stressed along orthogonal axes. This chapter defines the five directional limit-testing regimes, the same-level ablation protocol, and the quantitative metrics recorded for all logs in [[experiments/README|docs/experiments/]].

## Literature Survey & Paper Notes

### Fast Ephemeral Kernel Virtualization (`virtme-ng` — Verified from Primary Source)

* **Citation Key:** `[@cerqueira2022virtme]` (verified against `citations/pdfs/cerqueira2022virtme.pdf`; see [[citations/sources]])
* **Verified Mechanism:** `virtme-ng` (`vng`) builds and boots a selected Linux kernel inside QEMU using the live host filesystem as a copy-on-write snapshot, allowing kernel modules and memory-pressure harnesses to execute in an isolated guest with configurable RAM ceilings (`--memory`) and CPU counts (`--cpus`) in seconds [@cerqueira2022virtme].

### Micro- and Macro-Benchmarking (`fio` and `mmtests` — Verified from Primary Sources)

* **Citation Keys:** `[@axboe2024fio]`, `[@gorman2023mmtests]` (verified against `citations/pdfs/axboe2024fio.pdf` and `citations/pdfs/gorman2023mmtests.pdf`; see [[citations/sources]])
* **`fio` Compressibility Microbenchmarks [@axboe2024fio]:** Supports deterministic synthetic compressibility targets (`buffer_compress_percentage`, `buffer_compress_chunk`) and exports nanosecond latency percentiles (`clat_ns`).
* **`mmtests` Memory-Management Suite [@gorman2023mmtests]:** Driven by `run-mmtests.sh` to execute reproducible memory-pressure workloads with integrated `ftrace`, `perf`, and `/proc/vmstat` telemetry hooks.

## Controlled A/B Experimental Matrix (Primary & Sub-Primary Comparison Modes)

Experiments logged in [[experiments/README|docs/experiments/]] evaluate both **internal policy traits** (`zmem-core` in [[architecture/swappable-policy-traits]]) and **kernel entry modes** (Sub-Primary `blk-mq` `/dev/zmem0` vs. Primary Whole-Memory Transient `struct zmem_transient_ops`) against mainline baselines:

| Configuration ID | Entry Mode / Driver | Codec / Tiering | Pre-Filter | Execution & Headroom | Granularity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `BASE-RAM` | Uncompressed RAM (`rbrd` / direct) | None | None | Direct | 4 KiB |
| `BASE-ZRAM-LZ4` | Mainline C `zram` (`submit_bio` swap) | `lz4` (single) | None | DirectSync on BIO | 4 KiB |
| `BASE-ZRAM-ZSTD` | Mainline C `zram` (`submit_bio` swap) | `zstd` (single) | None | DirectSync on BIO | 4 KiB |
| `BASE-ZRAM-RECOMP` | Mainline C `zram` (`submit_bio` swap) | `lz4` -> sysfs `zstd` | None | Direct + manual sysfs | 4 KiB |
| `ZMEM-BLKMQ-LZ4` | **Sub-Primary:** `zmem` Rust `blk-mq` (`/dev/zmem0`) | Tier 1 `lz4` | `NoopFilter` | DirectSync | 4 KiB |
| `ZMEM-BLKMQ-SWAR` | **Sub-Primary:** `zmem` Rust `blk-mq` (`/dev/zmem0`) | Tier 1 `lz4` | `SwarCachelineProbe` | DirectSync | 4 KiB |
| `ZMEM-BLKMQ-TIER` | **Sub-Primary:** `zmem` Rust `blk-mq` (`/dev/zmem0`) | Tier 0 -> `lz4` -> `zstd` | `SwarCachelineProbe` | Async PSI + Headroom | 4 KiB / 16 KiB |
| `ZMEM-TRANS-LZ4` | **Primary:** `zmem` Whole-Memory Transient (`zmem_transient_ops`) | Tier 1 `lz4` | `NoopFilter` | DirectSync + Headroom Reserve | 4 KiB |
| `ZMEM-TRANS-SWAR` | **Primary:** `zmem` Whole-Memory Transient (`zmem_transient_ops`) | Tier 1 `lz4` | `SwarCachelineProbe` | DirectSync + Entropy Headroom | 4 KiB |
| `ZMEM-TRANS-TIER` | **Primary:** `zmem` Whole-Memory Transient (`zmem_transient_ops`) | Age-based Tier 0 -> `lz4` -> `zstd` | `SwarCachelineProbe` | Background PSI + Entropy Headroom | 4 KiB / 16 KiB |
| `ZMEM-TRANS-PRESSURE` | **Primary:** `zmem` Whole-Memory Transient (`zmem_transient_ops`) | **Pressure-based:** `None` -> `lz4` -> `zstd` | `SwarCachelineProbe` | Watermark Hysteresis + PSI Headroom | 4 KiB / 16 KiB |

### Same-Level Ablation Protocol Across Research Chapters

To ensure every research claim is tested against peer alternatives at the **same abstraction level**, experiments follow a strict 1-dimension-at-a-time sweep protocol:

| Ablation Suite | Chapter | Independent Variable Swept (Same-Level Alternatives) | Held Constant |
| :--- | :--- | :--- | :--- |
| **Suite 1: Entry & Arena** | [[research/01-linux-mm-and-zram-internals\|RES-01]] | **1A:** `Entry::DirectTransientOps` vs. `Entry::ZpoolBackend` vs. `Entry::BlkMqSwap` vs. `Baseline::StockZramBio`<br>**1B:** `Arena::BitSpinlockShared` vs. `Arena::RwLockPartitioned` vs. `Arena::AtomicSlotPerCoreShards` | `Codec::Lz4Fast`, `Filter::BlindNoop`, `Granularity::Fixed4KiB` |
| **Suite 2: Pacing Controllers** | [[research/02-production-memory-compression\|RES-02]] | `Pacing::OnDemandReclaimSync` vs. `Pacing::StaticWatermarkKthread` vs. `Pacing::AgeHistogramKstaled` vs. `Pacing::InKernelPsiFeedback` vs. `Pacing::UserspaceSysfsController` | `Entry::DirectTransientOps`, `Tier::PerPageAgeCascaded`, `Granularity::Fixed4KiB` |
| **Suite 3: Pre-Filters & Fast Codecs** | [[research/03-algorithms-and-entropy-filtering\|RES-03]] | **3A:** `Filter::BlindNoop` vs. `Filter::ByteHistogramOrder0` vs. `Filter::SwarWordDeltaAndHash` vs. `Filter::CodecEarlyAbort`<br>**3B:** `Codec::Lz4Fast` vs. `Codec::LzoRle` vs. `Codec::WkdmWordAligned` vs. `Codec::BdiCacheline` | `Entry::DirectTransientOps`, `Pacing::OnDemandReclaimSync`, `Granularity::Fixed4KiB` |
| **Suite 4: Tiering, Packing & Headroom** | [[research/04-tiering-coalescing-and-async-reclaim\|RES-04]] | **4A:** `Tier::SingleStaticFast` vs. `Tier::SingleStaticDense` vs. `Tier::PerPageAgeCascaded` vs. `Tier::PressureProgressive` (`None->lz4->zstd`) vs. `Tier::SizeThresholdRecompress`<br>**4B:** `Granularity::Fixed4KiB` vs. `Granularity::SharedDict4KiB` vs. `Granularity::CoalescedSuperBlock16KiB` vs. `32KiB`<br>**4C:** `Headroom::UnboundedOptimistic` vs. `Headroom::StaticFixedReserve` vs. `Headroom::EntropyVelocityAdaptive` | `Entry::DirectTransientOps`, `Filter::SwarWordDeltaAndHash` |
| **Suite 5: Rust FFI & Dispatch** | [[research/05-rust-for-linux-block-layer\|RES-05]] | **5A:** `Scratch::PerCpuPreemptDisabled` vs. `Scratch::PerTagBlkMq` vs. `Scratch::ShardedWorkerPool`<br>**5B:** `Dispatch::CompileTimeMonomorphized` vs. `Dispatch::BootTimeClosedEnum` vs. `Dispatch::RuntimeDynVtable` | `Codec::Lz4Fast`, `Filter::SwarWordDeltaAndHash` |

### Primary Quantitative Metrics & Telemetry Sources

Every benchmark run in [[experiments/README|docs/experiments/]] records five core quantitative dimensions:

| Metric Dimension | Definition & Formula | Kernel / Tooling Telemetry Source |
| :--- | :--- | :--- |
| **1. Nominal vs. Peak Memory Usage ($M_{\text{nominal\_used}}$ vs. $M_{\text{peak\_used}}$)** | Tracks steady-state/nominal physical RAM consumed ($M_{\text{nominal\_used}}$) against **Peak Physical Memory Used ($M_{\text{peak\_used}}$)** and the **Transient Fluctuation / Overshoot Ratio** ($\frac{M_{\text{peak\_used}} - M_{\text{nominal\_used}}}{M_{\text{nominal\_used}}}$). Detects unstable memory spikes during asynchronous Tier 0 staging, watermark regime switches (`None -> lz4 -> zstd`), or super-block compaction bursts that could trigger premature OOM. | `zmem` `physical_used_pages` vs. `peak_physical_used_pages` (matching `mem_used_total` vs. `mem_used_max` in `/sys/block/zram<id>/mm_stat` `[@minchan2014zram]`), plus cgroup `memory.current` / `memory.peak` time-series |
| **2. Total Memory Provided ($M_{\text{provided}}$)** | Total usable logical memory capacity delivered to applications before OOM: $M_{\text{provided}} = M_{\text{hot\_uncompressed}} + M_{\text{zmem\_logical\_stored}}$. Evaluates both steady-state pool compression ratio ($\text{CR}_{\text{eff}} = \frac{\text{orig\_data\_size}}{M_{\text{nominal\_used}}}$) and worst-case **Peak-Bounded Compression Ratio** ($\text{CR}_{\text{peak}} = \frac{\text{orig\_data\_size}}{M_{\text{peak\_used}}}$). | Application working-set capacity reached + `zmem` `logical_stored_pages` (`orig_data_size` in `/sys/block/zram<id>/mm_stat` `[@minchan2014zram]`) |
| **3. Saved Memory per CPU Cycle ($\eta_{\text{mem/cpu}}$) — Universal Efficiency Metric** | Evaluated across **all** test regimes and ablation suites: $$\eta_{\text{mem/cpu}} = \frac{M_{\text{orig\_logical}} - M_{\text{nominal\_used}}}{C_{\text{total\_cycles}}} \quad \text{(Bytes Saved per CPU Cycle)}$$ Alongside **Peak-Bounded Saved Memory per CPU Cycle** ($\eta_{\text{peak/cpu}} = \frac{M_{\text{orig\_logical}} - M_{\text{peak\_used}}}{C_{\text{total\_cycles}}}$). Quantifies the exact memory savings return on every CPU cycle invested across compression, decompression, pre-filtering, background scanning, and compaction. | `zmem_headroom_stats` (`logical_stored_pages`, `physical_used_pages`, `peak_physical_used_pages`) divided by `perf stat -e cycles:k,cycles:u` and in-kernel TSC / cycle counters `[@gorman2023mmtests]` |
| **4. CPU Compute Usage** | Total and per-page CPU compute cost (`cycles:k` per 4 KiB page), foreground application vs. background `kthread` CPU utilization (%), and CPU pressure stalls. | `perf stat -e cycles:k,instructions:k,task-clock`, per-`kthread` `/proc/<pid>/stat`, and `/proc/pressure/cpu` `[@weiner2022tmo; @gorman2023mmtests]` |
| **5. Read Time (Decompression / Fault Latency)** | Time required to restore/read a compressed 4 KiB page back into uncompressed RAM (`load_page` / page fault / `REQ_OP_READ`), tracked at median (P50), tail (P99, P99.9), and aggregate read throughput (MiB/s). | `fio` completion latency percentiles (`clat_ns` for `randread`), page-fault handler cycle counters / `ftrace`, and `/proc/pressure/memory` `[@axboe2024fio; @gorman2023mmtests]` |
| **6. Write Time (Compression / Store Latency)** | Time required to unmap and store/compress a 4 KiB page into `zmem` (`store_page` / `REQ_OP_WRITE`), tracked at median (P50), tail (P99, P99.9), and aggregate write throughput (MiB/s). | `fio` completion latency percentiles (`clat_ns` for `randwrite`) and `zmem` per-tier store latency histograms `[@axboe2024fio]` |
| **7. Entropy-Expansion Survival** | Minimum headroom watermark reached, time-to-compaction response, and absence of kernel deadlocks during in-place $3:1 \rightarrow 1:1$ entropy spikes. | `zmem_headroom_stats` (`headroom_free_pages`, `incompressible_pages`) |

### Combinatorial Policy Exploration (Multi-Option Interaction Matrix)

Beyond 1-factor-at-a-time ablations, `zmem`'s orthogonal trait engine (`ZmemEngine<E, T, F, G>`) enables **combinatorial sweeps** via boot-time `module_param` permutations to map the 3D Pareto frontier across **Total Memory Provided ($M_{\text{provided}} / M_{\text{nominal}}$)**, **CPU Compute Usage**, and **Read / Write Time**:

| Combination Profile | Pacing (`ExecutionPolicy`) | Tiering (`TierPolicy`) | Pre-Filter (`CompressibilityFilter`) | Granularity (`StorageGranularity`) | Headroom (`HeadroomPolicy`) | Target Trade-off Explored |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`COMBO-FAST-REACTIVE`** | `OnDemandReclaimSync` | `SingleStaticFast` (`lz4` / `WKdm`) | `CodecEarlyAbort` | `Fixed4KiB` | `StaticFixedReserve` | Minimum CPU compute usage and minimum read/write time at moderate memory expansion |
| **`COMBO-PROGRESSIVE-BALANCED`** | `InKernelPsiFeedback` | `PressureProgressive` (`None -> lz4 -> zstd`) | `SwarWordDeltaAndHash` | `Fixed4KiB` (Tier 1) + `SharedDict4KiB` (Tier 2) | `EntropyVelocityAdaptive` | Zero CPU compute when within nominal memory; smooth transition to `lz4` and `zstd` as memory fills |
| **`COMBO-MAX-CAPACITY`** | `AgeHistogramKstaled` + `InKernelPsiFeedback` | `PerPageAgeCascaded` (`Tier 0 -> lz4 -> zstd`) | `SwarWordDeltaAndHash` | `CoalescedSuperBlock16KiB` ($N=4$) | `EntropyVelocityAdaptive` | Maximizes Total Memory Provided ($M_{\text{provided}}$) per GiB of Nominal Memory ($M_{\text{nominal}}$) while hiding `zstd` write time behind Tier 0 |
| **`COMBO-ADVERSARIAL-ML`** | `InKernelPsiFeedback` | `PressureProgressive` (`None -> lz4 -> zstd`) | `SwarWordDeltaAndHash` | `Fixed4KiB` | `EntropyVelocityAdaptive` | High-entropy / quantized ML weight resilience: minimizes wasted CPU compute on incompressible pages and prevents Expansion OOM |

## Adversarial Limit-Finding ("Break-Point") Stress Regimes

To map the true survival envelope and drawbacks of each approach, every candidate configuration is pushed to failure across five orthogonal stress directions:

| Stress Direction | How We Push to the Breaking Point | Approaches Expected to Break / Fail Early | Expected Survivors & Their Inherent Drawbacks Elsewhere |
| :--- | :--- | :--- | :--- |
| **1. Capacity-Cliff Overcommit Ramp ($M_{\text{provided}}$ Limit)** | Step-ramp logical working set ($1.0\times \rightarrow 1.5\times \rightarrow 2.0\times \rightarrow 3.0\times \rightarrow 4.0\times$ physical RAM) until the system hits OOM or reclaim livelock. | `SingleStaticFast` (`lz4`, `WKdm`, `BDI`) and `Fixed4KiB` hit the OOM ceiling earliest due to lower compression density. | `CoalescedSuperBlock16KiB/32KiB` + `zstd` survive to the highest $M_{\text{provided}}$, **but** suffer severe read-amplification latency and compaction CPU cost in Direction 3. |
| **2. In-Place Entropy-Explosion Cliff ($3:1 \rightarrow 1:1$ Shock)** | Fill memory to 90–95% of compressed capacity with 3:1 compressible data, then rapidly overwrite $10\% \rightarrow 75\%$ of those **already-allocated** pages in-place with uncompressible bytes. | `BlindNoop` (stock `zram`), `UnboundedOptimistic`, and `StaticFixedReserve` burn CPU trying to compress random bytes and hit mid-fault OOM / $M_{\text{peak\_used}}$ overshoot. | `SwarWordDeltaAndHash` + `EntropyVelocityAdaptive` survive larger expansion shocks via fast bypass and emergency compaction, **but** reserving dynamic headroom reduces max steady-state capacity in Direction 1. |
| **3. Adversarial Sub-Page Churn & Fault Storm (Super-Block Breaker)** | Concurrent threads (`numjobs = N_cpus`) repeatedly fault in and dirty exactly 1 out of every 4 pages (stride-4 invalidation) inside coalesced super-blocks. | `CoalescedSuperBlock16KiB/32KiB` and `SingleStaticDense` (`zstd`) break with 4x–8x read-fault tail latency cliffs, severe hole fragmentation ($M_{\text{peak\_used}} \gg M_{\text{nominal\_used}}$), and compaction thrashing. | `Fixed4KiB` and `SharedDict4KiB` with `lz4`/`WKdm` complete with flat P99.9 read/write times and zero hole fragmentation, **but** provide lower peak capacity in Direction 1. |
| **4. Multi-Core Write Flood & Watermark Oscillation (Async Breaker)** | Zero-think-time parallel write storm across all vCPUs designed to overflow Tier 0 staging rings and oscillate around $W_{\text{low}} / W_{\text{high}}$ faster than background `kthread`s can drain. | Unbounded/slow async staging and `UserspaceSysfsController` suffer massive $M_{\text{peak\_used}}$ transient spikes and premature OOM before background compression catches up. | `DirectSync` and deterministic sync-spill `PressureProgressive` keep $M_{\text{peak\_used}} - M_{\text{nominal\_used}}$ tightly bounded, **but** expose synchronous compression write time on foreground threads once Tier 0 saturates. |
| **5. CPU Starvation & Compute Contention (Heavy-Codec Breaker)** | Pin foreground compute threads saturating 95–100% of vCPUs while simultaneously driving memory pressure above physical RAM capacity. | `SingleStaticDense` (`zstd`), `StaticWatermarkKthread`, and aggressive `AgeHistogramKstaled` steal foreground CPU cycles or stall background demotion, collapsing application throughput. | `InKernelPsiFeedback` + `SwarWordDeltaAndHash` + `Lz4Fast` throttle background CPU usage automatically, **but** temporarily accept lower compression density while CPU PSI is saturated. |
| **6. High-Frequency Small `malloc`/`free` Churn Flood (Allocator & Latency Breaker)** | Flood the system with millions of rapid small allocations, page touches, and out-of-order frees (`MADV_DONTNEED` / `munmap` / `evict_slot` / `REQ_OP_DISCARD`) across all cores while measuring P50/P99/P99.9 request latency. | Synchronous heavy codecs (`SingleStaticDense` `zstd`), shared lock arenas (`Arena::BitSpinlockShared` / `zsmalloc`), and `CoalescedSuperBlock16KiB/32KiB` suffer severe lock contention, "Swiss-cheese" slab/super-block hole fragmentation ($M_{\text{peak\_used}} \gg M_{\text{nominal\_used}}$), and wasted compression work on short-lived pages right before they are freed. | `Arena::AtomicSlotPerCoreShards` + Tier 0 staging / `PressureProgressive` (`None -> lz4 -> zstd`) absorb and free short-lived churn with low request tail latency, **but** Tier 0 staging holds an uncompressed buffer reserve until drained. |

## Correctness & Safety Verification Gate

Before any performance benchmark is recorded in [[experiments/README|docs/experiments/]], the configuration must pass a mandatory verification gate on a debug-instrumented kernel (`build-debug`):
* `CONFIG_LOCKDEP=y` & `CONFIG_PROVE_LOCKING=y`: Verify zero lock-ordering inversions or sleeping-in-atomic violations across background compression and page-fault decompression paths.
* `CONFIG_KASAN=y`: Verify zero out-of-bounds or use-after-free accesses across the C ops-table (`struct zmem_transient_ops`) and codec FFI boundaries ([[architecture/c-ops-table-boundary]]).
* Separate release kernel (`build-perf`) with sanitizers disabled is used for all latency and PSI measurements.

## Assumptions

- [ ] **Active:** `[A-RES-06-1]` `virtme-ng` with host-pinned vCPUs (`--cpus` / `--cpu-host`) and fixed guest memory ceilings (`--memory`) yields low run-to-run variance (< 5% across repeated runs) for whole-memory pressure and page-fault latency benchmarks (`[@cerqueira2022virtme]`). #assumption
- [ ] **Active:** `[A-RES-06-2]` The in-place Entropy-Spike Stress Test (allocating compressible pages exceeding physical RAM and overwriting them with pseudo-random/quantized bytes) deterministically reproduces Expansion OOM pressure and validates `zmem`'s Decompression Headroom Reserve ([[architecture/allocator-and-reclaim-safety]]). #assumption
- [ ] **Active:** `[A-RES-06-3]` Separating debug runs (`CONFIG_KASAN=y`, `CONFIG_LOCKDEP=y`) from performance runs (`build-perf`) is required to prevent sanitizer instrumentation overhead from skewing compression and page-fault latency measurements. #assumption

## What Was Tried

* **Telemetry & Adversarial Workload Design:** Verified `virtme-ng` guest memory-ceiling capabilities [@cerqueira2022virtme], `fio` compressibility parameters [@axboe2024fio], `mmtests` `run-mmtests.sh` structure [@gorman2023mmtests], and `zram`'s 9-column `/sys/block/zram<id>/mm_stat` accounting [@minchan2014zram], and designed the in-place Entropy-Spike Stress Test for Expansion OOM evaluation.

## Conclusions

* **From Literature (`[@minchan2014zram; @axboe2024fio; @gorman2023mmtests; @cerqueira2022virtme]`):** `/sys/block/zram<id>/mm_stat` distinguishes `compr_data_size` from total physical memory allocated (`mem_used_total`), `fio` supports deterministic compressibility sweeps (`buffer_compress_percentage`), and `virtme-ng` boots isolated QEMU test kernels with fixed RAM ceilings from the live host filesystem.
* **For `zmem`:** Testbed variance (`[A-RES-06-1]`), Entropy-Spike Expansion OOM survival (`[A-RES-06-2]`), and sanitizer overhead (`[A-RES-06-3]`) are tracked as active assumptions to be calibrated in [[experiments/README|docs/experiments/]].

## Revision Log

| Date | Change | Trigger |
| :--- | :--- | :--- |
| 2026-11-21 | Added Sudden Entropy-Spike / Expansion OOM benchmark regime alongside `mmtests`, `fio`, and `virtme-ng` | Core concept pivot |
