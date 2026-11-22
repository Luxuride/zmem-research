---
id: CITATIONS-SOURCES
title: "Master Citation Sources, Local PDFs, and Reference HTML Index"
type: citation-index
status: active
date: "2026-11-21"
tags:
  - zmem
  - citations
  - literature
  - bibtex
aliases:
  - "Citation Sources"
  - "sources"
  - "CITATIONS-SOURCES"
---

# Master Citation Sources, Local PDFs, and Reference HTML Index

> [!IMPORTANT]
> Every `[@citekey]` used across `docs/research/`, `docs/architecture/`, `docs/adr/`, and `docs/experiments/` MUST have a corresponding entry in both `citations/references.bib` and the table below, backed by downloaded local copies in `citations/pdfs/<citekey>.pdf` and `citations/html/<citekey>.html`. Run `make check` (`npx tsx scripts/check_consistency.ts`) to validate citation and file integrity.

## Citation Registry Table

| Citation Key | Title | Venue / Year | DOI / URL | Local PDF (`citations/pdfs/`) | Local HTML (`citations/html/`) | License / Access Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `[@minchan2014zram]` | zram: Compressed RAM-based Block Devices and zsmalloc Slab Allocator | Linux Kernel Docs (2014) | https://docs.kernel.org/admin-guide/blockdev/zram.html | `minchan2014zram.pdf` | `minchan2014zram.html` | GPL-2.0 / Public Docs |
| `[@lagar2019software]` | Software-Defined Far Memory in Warehouse-Scale Computers | ASPLOS '19 (2019) | `10.1145/3297858.3304053` | `lagar2019software.pdf` | `lagar2019software.html` | Author Open Copy |
| `[@weiner2022tmo]` | TMO: Transparent Memory Offloading in Datacenters | ASPLOS '22 (2022) | `10.1145/3503222.3507731` | `weiner2022tmo.pdf` | `weiner2022tmo.html` | ACM Open Access (CC-BY) |
| `[@collet2013lz4]` | LZ4 Frame and Block Format Specification | GitHub Spec (2013) | https://github.com/lz4/lz4 | `collet2013lz4.pdf` | `collet2013lz4.html` | BSD-2-Clause / Public Spec |
| `[@collet2016zstd]` | Zstandard Compression and the 'application/zstd' Media Type | IETF RFC 8878 (2021) | `10.17487/RFC8878` | `collet2016zstd.pdf` | `collet2016zstd.html` | IETF Public RFC |
| `[@wilson1999wkdm]` | The Case for Compressed Caching in Virtual Memory Systems | USENIX ATC '99 (1999) | https://www.usenix.org/conference/1999-usenix-annual-technical-conference/case-compressed-caching-virtual-memory | `wilson1999wkdm.pdf` | `wilson1999wkdm.html` | USENIX Open Access |
| `[@pekhimenko2012bdi]` | Base-Delta-Immediate Compression: Practical Data Compression for On-Chip Caches | PACT '12 (2012) | `10.1145/2370816.2370870` | `pekhimenko2012bdi.pdf` | `pekhimenko2012bdi.html` | CMU SAFARI Author Archive |
| `[@lee2023zramtier]` | zram: Multi-Algorithm Recompression (`CONFIG_ZRAM_MULTI_COMP`) | Linux Kernel Docs / `zram_drv.c` (2022) | https://docs.kernel.org/admin-guide/blockdev/zram.html | `lee2023zramtier.pdf` | `lee2023zramtier.html` | GPL-2.0 / Kernel Source & Docs |
| `[@ojeda2021rust]` | Rust for Linux: In-Kernel Rust Support and Safe Abstractions | LPC / Kernel Docs (2021) | https://docs.kernel.org/rust/index.html | `ojeda2021rust.pdf` | `ojeda2021rust.html` | GPL-2.0 / Public Docs |
| `[@hindborg2024rnull]` | Rust Block Device Drivers: `block::mq::Request`, `rnull`, and `rbrd` | LPC (2024) | https://lpc.events/event/20/contributions/2494/ | `hindborg2024rnull.pdf` | `hindborg2024rnull.html` | GPL-2.0 / LPC Slides |
| `[@axboe2013blkmq]` | Linux Block IO: Introducing Multi-Queue SSD Access on Multi-Core Systems | SYSTOR '13 (2013) | `10.1145/2485732.2485740` | `axboe2013blkmq.pdf` | `axboe2013blkmq.html` | Author Archive (`kernel.dk`) |
| `[@axboe2024fio]` | Flexible I/O Tester (fio) | GitHub Docs (2024) | https://github.com/axboe/fio | `axboe2024fio.pdf` | `axboe2024fio.html` | GPL-2.0 / Public Docs |
| `[@gorman2023mmtests]` | MMTests: Linux Memory Management Benchmark Suite | GitHub Docs (2023) | https://github.com/gormanm/mmtests | `gorman2023mmtests.pdf` | `gorman2023mmtests.html` | GPL-2.0 / Public Docs |
| `[@cerqueira2022virtme]` | virtme-ng: Fast Kernel Testing via Lightweight QEMU Virtualization | GitHub Docs (2023) | https://github.com/arighi/virtme-ng | `cerqueira2022virtme.pdf` | `cerqueira2022virtme.html` | GPL-2.0 / Public Docs |

## Chapter-to-Citation Cross-Reference

* [[research/01-linux-mm-and-zram-internals]]: `[@minchan2014zram]`, `[@lee2023zramtier]`, `[@axboe2013blkmq]`, `[@hindborg2024rnull]`
* [[research/02-production-memory-compression]]: `[@lagar2019software]`, `[@weiner2022tmo]`, `[@wilson1999wkdm]`, `[@pekhimenko2012bdi]`
* [[research/03-algorithms-and-entropy-filtering]]: `[@collet2013lz4]`, `[@collet2016zstd]`, `[@wilson1999wkdm]`, `[@pekhimenko2012bdi]`, `[@weiner2022tmo]`, `[@ojeda2021rust]`
* [[research/04-tiering-coalescing-and-async-reclaim]]: `[@lee2023zramtier]`, `[@collet2013lz4]`, `[@collet2016zstd]`, `[@lagar2019software]`
* [[research/05-rust-for-linux-block-layer]]: `[@ojeda2021rust]`, `[@hindborg2024rnull]`, `[@axboe2013blkmq]`
* [[research/06-benchmarking-and-methodology]]: `[@cerqueira2022virtme]`, `[@axboe2024fio]`, `[@gorman2023mmtests]`, `[@weiner2022tmo]`

## Private PDF Submodule (`citations/pdfs/`)

Full-text PDFs in `citations/pdfs/` are tracked in the private Git submodule `git@github.com:Luxuride/zmem-research-pdfs.git` configured with `update = none` in `.gitmodules` so public clones and CI checks succeed without private credentials:

```bash
# Public / anonymous clone (submodule skipped automatically via update = none):
git clone https://github.com/Luxuride/zmem-research.git

# Authorized researcher opt-in PDF checkout:
git submodule update --init --checkout citations/pdfs
```
