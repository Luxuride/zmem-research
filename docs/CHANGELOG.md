---
id: CHANGELOG
title: "zmem Research & Architecture Milestone Changelog"
type: changelog
status: active
date: "2026-11-21"
tags:
  - zmem
  - changelog
  - milestones
aliases:
  - "Milestone Changelog"
  - "CHANGELOG"
---

# `zmem` Research & Architecture Milestone Changelog

High-level narrative timeline of major research pivots, verified/refuted assumptions, and architectural decisions across the `zmem` Master's thesis project. Fine-grained text diffs are tracked by Git (`git log -p`), while chapter-specific milestones are summarized in the `## Revision Log` table at the bottom of each [[INDEX|research chapter]].

| Date | Milestone / Pivot | Trigger & Evidence |
| :--- | :--- | :--- |
| 2026-11-21 | Initialized `zmem-research` Obsidian knowledge base under `docs/`, root `citations/` (with downloaded primary PDFs and HTML), Devcontainer configuration, and TypeScript (`tsx`) consistency/index/Preact+DaisyUI static site automation | Repository initialization |
| 2026-11-21 | Centered architecture on a **Two-Layer Whole-Memory Transient Compression Layer** (`zmem-core` `no_std` crate + `struct zmem_transient_ops` C boundary) so RAM is compressed transparently in the background without `zram`-style block-swap indirection | [[adr/001-rust-blk-mq-entry-point\|ADR-001]], [[adr/002-language-agnostic-c-ops-table\|ADR-002]], [[research/01-linux-mm-and-zram-internals]], [[architecture/overview-and-dataflow]] |
| 2026-11-21 | Designed the **Sudden Entropy-Increase / Expansion OOM Guard** coupling 64-bit integer SWAR pre-filter verdicts (`BypassIncompressible` velocity) with a protected **Decompression Headroom Reserve** and emergency Tier 1 $\rightarrow$ Tier 2 compaction | [[research/03-algorithms-and-entropy-filtering]], [[research/04-tiering-coalescing-and-async-reclaim]], [[architecture/allocator-and-reclaim-safety]] |
| 2026-11-21 | Added plain-English [[GLOSSARY\|Terminology Glossary]] and verified all primary literature claims across Linux `zram`/`zsmalloc`, Google Far Memory (ASPLOS '19), Meta TMO (ASPLOS '22), LZ4, Zstandard (RFC 8878), WKdm (USENIX '99), BDI (PACT '12), and `blk-mq` (SYSTOR '13) | [[citations/sources]], [[GLOSSARY]] |
