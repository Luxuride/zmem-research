---
id: "{{id}}"
title: "{{title}}"
type: research-chapter
status: draft
date: "{{date}}"
tags:
  - zmem
  - research
aliases:
  - "{{id}}"
---

# {{title}}

## Overview

Summarize the core research questions addressed in this chapter and how they map to the [[INDEX|zmem Master Knowledge Base Index]].

## Literature Survey & Paper Notes

### Key References

* Summarize relevant background work and cite via `[@citekey]` mapped in [[citations/sources|Citation Sources]].

## Architectural Implications for `zmem`

Connect findings to concrete design specifications in [[architecture/overview-and-dataflow|Architecture Overview]] and decisions in `adr/`.

## Assumptions

> [!NOTE]
> Assumptions follow an explicit lifecycle (`Active`, `Verified`, `Refuted`) and are never deleted when falsified—mark their state and link the evidence that verified or refuted them.

- [ ] **Active:** `[A-{{id}}-1]` Describe an unverified premise or constraint currently taken as true so it can be empirically audited. #assumption
- [x] **Verified:** `[A-{{id}}-2]` Example verified premise linked to supporting evidence (see [[research/01-linux-mm-and-zram-internals]]). #assumption
- [-] **Refuted:** `[A-{{id}}-3]` ~~Example falsified premise preserved for research lineage~~ → Refuted by [[experiments/README]]. #assumption

## What Was Tried

> [!TIP]
> **Dead-End & Attempt Record:** Permanently records approaches, prototypes, rejected designs, and failed hypotheses along with *why* they were abandoned.

* Document analytical investigations, kernel code inspections, prototypes, and dead ends evaluated for this chapter.

## Conclusions

> [!IMPORTANT]
> Holds only currently verified takeaways backed by literature citations or [[experiments/README|Experiment Logs]].

* Summarize verified takeaways backed by citations or experimental data.

## Revision Log

| Date | Change | Trigger |
| :--- | :--- | :--- |
| {{date}} | Initial chapter scope and assumptions defined | Repo initialization |
