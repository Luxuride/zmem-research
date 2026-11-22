---
id: "{{id}}"
title: "{{title}}"
type: adr
status: proposed
date: "{{date}}"
tags:
  - zmem
  - adr
  - architecture
aliases:
  - "{{id}}"
---

# {{id}}: {{title}}

## Status

Proposed ({{date}})

## Context

Describe the kernel subsystem constraints, upstream maintainability rules, and performance trade-offs motivating this decision. Link to relevant research chapters such as [[research/01-linux-mm-and-zram-internals]] or [[research/05-rust-for-linux-block-layer]].

## Decision

State the architectural decision clearly, including the C/Rust boundary or trait contract affected in [[architecture/overview-and-dataflow]].

## Consequences

### Positive

* List benefits for upstreamability, reclaim safety, or experimental flexibility.

### Negative / Trade-offs

* List constraints, engineering complexity, or runtime trade-offs introduced by this decision.

### Verification Links

* Link to experiment logs in [[experiments/README|experiments/]] or citations in [[citations/sources]].
