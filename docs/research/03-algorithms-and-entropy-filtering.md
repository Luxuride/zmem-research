---
id: RES-03
title: "Compression Codecs, Integer SWAR Entropy Pre-Filtering, and the Entropy-Expansion OOM Problem"
type: research-chapter
status: active
date: "2026-11-21"
tags:
  - zmem
  - research
  - algorithms
  - entropy
  - swar
  - oom
  - lz4
  - zstd
aliases:
  - "03-algorithms-and-entropy-filtering"
  - "RES-03"
---

# Compression Codecs, Integer SWAR Entropy Pre-Filtering, and the Entropy-Expansion OOM Problem

## Overview

When `zmem` operates as a **transparent transient compression layer over whole memory**, it introduces a critical systems hazard that does not exist in uncompressed RAM: **Sudden Entropy Increase & Expansion OOM**.

In uncompressed RAM (without overcommit), once a process has backed its virtual memory pages with physical 4 KiB frames, overwriting zeroes or text in those pages with high-entropy bytes cannot consume additional physical RAM. In a whole-memory compression layer, however:
1. Processes can allocate a virtual working set larger than physical DRAM while cold pages are compressible (e.g., 3:1 compression ratio [@lagar2019software; @weiner2022tmo]).
2. If an application suddenly overwrites its **already-allocated** compressed memory with high-entropy data—such as TLS/encrypted streams, compressed media, or quantized byte-encoded ML weights [@weiner2022tmo]—those pages fault in, expand to 4 KiB, and can no longer be compressed back down (`1:1`).
3. Furthermore, if the compressor blindly attempts to run `lz4` or `zstd` on every newly dirtied high-entropy page (as stock `zram` does before falling back to `ZRAM_HUGE` [@minchan2014zram; @lee2023zramtier]), the kernel wastes massive CPU cycles right as physical memory headroom is collapsing.

This chapter analyzes the verified mechanics of `lz4` [@collet2013lz4], `zstd` [@collet2016zstd], `WKdm` [@wilson1999wkdm], and $\text{B}\Delta\text{I}$ [@pekhimenko2012bdi], and designs `zmem`'s **64-Bit Integer SWAR Entropy Pre-Filter** as both a **CPU fast-bypass** and an **early-warning sensor for Entropy-Expansion OOM** ([[architecture/allocator-and-reclaim-safety]]).

## Literature Survey & Paper Notes

### Fast LZ77 and ANS Codecs (`lz4` and `zstd` — Verified from Primary Sources)

* **Citation Keys:** `[@collet2013lz4]`, `[@collet2016zstd]` (verified against `citations/pdfs/collet2013lz4.pdf` and `citations/pdfs/collet2016zstd.pdf`; see [[citations/sources]])
* **Verified Format & Algorithmic Mechanics:**
  * **`lz4` [@collet2013lz4]:** An LZ4 compressed block consists of sequences starting with a 1-byte `token` split into two 4-bit fields: the high 4 bits encode literal length (`0..15`) and the low 4 bits encode match length (`0..15`, where `0` represents the minimum 4-byte match length `minmatch = 4`), followed by literal bytes and a 16-bit little-endian match offset (64 KiB sliding window).
  * **`zstd` (IETF RFC 8878) [@collet2016zstd]:** Combines LZ77 sliding-window match search with Huffman coding for compressed literal streams and **Finite State Entropy (FSE, tabled Asymmetric Numeral Systems)** for sequence headers (`Literals_Length`, `Match_Length`, `Offset_Value`). Selected by Meta's TMO for production `zswap` with a representative 3x average compression ratio [@weiner2022tmo].

### Structured Word & Cache-Line Codecs (`WKdm` and `BDI` — Verified from Primary Sources)

* **Citation Keys:** `[@wilson1999wkdm]`, `[@pekhimenko2012bdi]` (verified against `citations/pdfs/wilson1999wkdm.pdf` and `citations/pdfs/pekhimenko2012bdi.pdf`; see [[citations/sources]])
* **Verified Algorithmic Mechanics:**
  * **WKdm [@wilson1999wkdm]:** Operates on 32-bit words using a 16-word direct-mapped dictionary. Each word is classified by a 2-bit tag into four cases: (1) all-zero word, (2) exact 32-bit dictionary match (4-bit index), (3) partial match of the upper 22 bits with a dictionary entry (4-bit index + 10 differing low bits), or (4) unmatched 32-bit literal.
  * **Base-Delta-Immediate ($\text{B}\Delta\text{I}$) [@pekhimenko2012bdi]:** Compresses 64-byte cache lines relative to two bases—an implicit zero base and one explicit non-zero 2/4/8-byte base value—plus fixed-width immediate deltas ($\Delta \in \{1, 2, 4\}$ bytes), achieving a 1.53x average effective cache compression ratio.

## Fast Integer SWAR Pre-Filter & Entropy-Expansion OOM Sensing

To obey Core Architectural Rule #3 (no kernel FPU/SIMD context-switch overhead on hot paths; see [[architecture/allocator-and-reclaim-safety]]), `zmem` defines a `CompressibilityFilter` trait ([[architecture/swappable-policy-traits]]) operating purely on 64-bit general-purpose integer registers:

1. **Zero / Constant-Word Fast Path:** Bitwise XOR-accumulation across `u64` words (`word ^ first_word`) identifies constant-word pages (`FilterVerdict::SameValue(u64)`), storing them as a metadata tag in the slot table with zero arena allocation.
2. **Strided 64-Bit Integer SWAR Probe (`SwarCachelineProbe`):** Samples strided 64-byte cache lines using scalar 64-bit integer operations—testing for zero words, shared upper-bit prefixes [@wilson1999wkdm], small word deltas [@pekhimenko2012bdi], and 4-byte hash collisions (`minmatch = 4` [@collet2013lz4]).
3. **Dual Role of `FilterVerdict::BypassIncompressible`:**
   * **CPU Bypass:** Immediately skips `lz4`/`zstd` execution on high-entropy pages, avoiding wasted compression cycles.
   * **Entropy-Drift Sensor for the Headroom Controller:** Increments `zmem`'s sliding-window `incompressible_velocity` counter. When a process overwrites previously compressible pages with high-entropy payloads, the spike in `BypassIncompressible` verdicts triggers early Tier 1 $\rightarrow$ Tier 2 compaction of remaining cold pages and updates physical headroom watermarks before decompression page faults can exhaust free 4 KiB frames ([[architecture/allocator-and-reclaim-safety]]).

## Same-Level Peer Alternatives to Test Against

To isolate the impact of pre-filtering and primary codec selection on mixed-entropy and sudden entropy-spike workloads, `zmem` evaluates peer alternatives at two orthogonal levels:

### 1. Compressibility Pre-Filter Alternatives (`CompressibilityFilter` Trait)

All four pre-filters inspect an incoming 4 KiB page (`&[u8; 4096]`) in general-purpose integer registers (zero FPU/SIMD state) and return a `FilterVerdict`:

| Alternative ID | Pre-Filter Mechanism | Bytes Inspected | Expected Strength | Expected Cost / Failure Mode |
| :--- | :--- | :--- | :--- | :--- |
| **`Filter::BlindNoop` (Stock `zram` baseline)** | Checks only for constant-word (`SameValue` / `ZRAM_SAME`); passes all other pages to the primary compressor | Up to 4096 B (for `SameValue` check) | Zero false-negative risk (never skips a compressible page) | Wastes full `lz4`/`zstd` compression CPU cycles on every incompressible page prior to `RawHuge` fallback |
| **`Filter::ByteHistogramOrder0`** | Counts distinct byte values / order-0 byte frequency across 8 strided 64-byte cache lines | 512 B (12.5% of page) | Fast detection of uniform random / encrypted byte streams | Fails on structured 32/64-bit word or pointer patterns that have high single-byte diversity but strong 4-byte LZ77 matches |
| **`Filter::SwarWordDeltaAndHash` (`SwarCachelineProbe`)** | 64-bit integer SWAR probe over 8 strided cache lines testing zero words, shared upper 22/32-bit prefixes (`WKdm`), small word deltas ($\text{B}\Delta\text{I}$), and 4-byte hash collisions (`lz4` `minmatch = 4`) | 512 B (12.5% of page) | Directly tests the structural invariants exploited by `lz4`, `WKdm`, and $\text{B}\Delta\text{I}$ in scalar registers | Could misclassify pages whose compressible region is concentrated outside the 8 strided cache lines |
| **`Filter::CodecEarlyAbort` (`Lz4EarlyAbortProbe`)** | Executes `lz4`'s 4-byte hash-table match loop on the first 512 bytes and aborts if output exceeds 448 bytes | 512 B contiguous prefix | Exact measurement of `lz4` match density on the page prefix | Higher cycle cost than SWAR on compressible pages; sensitive to header-vs-tail page layout |

### 2. Primary Fast Codec Alternatives (Warm 4 KiB Tier)

| Alternative ID | Algorithmic Family | Sliding Window / Dictionary | Expected Strength | Expected Cost / Failure Mode |
| :--- | :--- | :--- | :--- | :--- |
| **`Codec::Lz4Fast`** | Byte-oriented LZ77 (`minmatch = 4`) `[@collet2013lz4]` | 64 KiB (16-bit offset) | Very high decompression speed; strong general-purpose heap compression | Lower compression ratio (~2:1) than entropy-coded `zstd` |
| **`Codec::LzoRle`** | Byte-oriented LZO + run-length encoding `[@minchan2014zram]` | 48 KiB LZO history | Fast zero-run handling (`RLE`); mainline `zram` historical default | Slower decompression than `lz4` on non-zero structured data |
| **`Codec::WkdmWordAligned`** | 32-bit word dictionary + 22/10-bit prefix split `[@wilson1999wkdm]` | 16-word direct-mapped dictionary | Pure 32/64-bit word operations; zero byte-shifting overhead on pointer/heap data | Poor compression on unaligned text or byte-shifted streams |
| **`Codec::BdiCacheline`** | Dual-base (implicit 0 + explicit base) + 1/2/4-byte immediate deltas `[@pekhimenko2012bdi]` | Per-64B cache line | Extremely low latency; random access to individual 64B cache lines | Modest compression ratio (~1.5x average) compared to page-wide LZ77 |

## Architectural Implications for `zmem`

* Isolating pre-filtering behind `CompressibilityFilter` ([[architecture/swappable-policy-traits]], [[adr/003-swappable-policy-traits|ADR-003]]) allows controlled A/B benchmarking of `NoopFilter` (blind compression after `SameValue` detection), `SwarCachelineProbe`, and `Lz4EarlyAbortProbe` under both steady-state workloads and sudden entropy-spike workloads ([[research/06-benchmarking-and-methodology]]).

## Assumptions

- [ ] **Active:** `[A-RES-03-1]` Sampling strided 64-byte cache lines in a 4 KiB page via 64-bit integer SWAR (`SwarCachelineProbe`) accurately classifies page compressibility with low false-negative and false-positive rates across mixed heap and quantized tensor workloads. #assumption
- [ ] **Active:** `[A-RES-03-2]` Fast-bypassing incompressible pages via `SwarCachelineProbe` reduces P99/P99.9 compression CPU latency and significantly improves **Saved Memory per CPU Cycle ($\eta_{\text{mem/cpu}}$)** during high-entropy write bursts compared to blind compression (`NoopFilter` / stock `zram` `ZRAM_HUGE` fallback, where incompressible pages yield 0 saved bytes while burning thousands of cycles). #assumption
- [ ] **Active:** `[A-RES-03-3]` Feeding `CompressibilityFilter` verdict ratios into `zmem`'s headroom controller enables early emergency compaction and clean OOM signaling during sudden entropy-expansion spikes on already-allocated memory without kernel deadlocks ([[architecture/allocator-and-reclaim-safety]]). #assumption

## What Was Tried

* **Algorithmic Specification & Failure-Mode Audit:** Verified the exact match primitives of `lz4` [@collet2013lz4], `zstd` (RFC 8878) [@collet2016zstd], WKdm [@wilson1999wkdm], and $\text{B}\Delta\text{I}$ [@pekhimenko2012bdi], and modeled the **Entropy-Expansion OOM** failure mode where already-allocated compressed pages are overwritten with incompressible bytes.

## Conclusions

* **From Literature (`[@collet2013lz4; @collet2016zstd; @wilson1999wkdm; @pekhimenko2012bdi; @weiner2022tmo]`):** `lz4` requires $\ge 4$-byte matches in a 64 KiB window; `zstd` combines LZ77 with Huffman and FSE coding; WKdm and $\text{B}\Delta\text{I}$ exploit 32/64-bit word prefixes and small deltas; and quantized byte-encoded ML weights exhibit low compressibility in production fleets.
* **For `zmem`:** Using a 64-bit integer SWAR pre-filter both to bypass wasted compression CPU cycles and to drive entropy-expansion OOM headroom protection is tracked under active assumptions `[A-RES-03-1]`–`[A-RES-03-3]` for evaluation in [[experiments/README|docs/experiments/]].

## Revision Log

| Date | Change | Trigger |
| :--- | :--- | :--- |
| 2026-11-21 | Added Sudden Entropy-Increase / Expansion OOM analysis and coupled SWAR pre-filter verdicts to headroom protection | Core concept pivot & [[adr/003-swappable-policy-traits\|ADR-003]] |
