---
id: "{{id}}"
title: "{{title}}"
type: experiment
status: active
date: "{{date}}"
tags:
  - zmem
  - experiment
  - benchmark
aliases:
  - "{{id}}"
---

# Experiment: {{title}} ({{date}})

## Objective & Hypothesis

State the research hypothesis under test and link to the corresponding research chapter ([[research/06-benchmarking-and-methodology]]) and ADRs.

## Testbed & Configuration

* **Guest Kernel / Environment:** `virtme-ng`, kernel version, `CONFIG_KASAN`, `CONFIG_LOCKDEP`
* **Workload:** `fio` / `mmtests` profile
* **Baselines Compared:** Uncompressed RAM, stock `zram` (`lz4`, `zstd`), `zmem` policy configuration

## Assumptions

- [ ] **Active:** `[A-{{id}}-1]` State experimental assumptions (e.g., guest vCPU pinning, memory pressure thresholds, dataset entropy distribution). #assumption

## What Was Tried

* Detail exact commands, matrix runs, configurations tested, dead ends, and any failed runs or anomalies observed.

## Conclusions

* Summarize verified quantitative outcomes across the core benchmark dimensions:
  * **Survival / Break-Point Reached:** Which configurations completed the stress regime vs. which broke (and at what exact load/overcommit/entropy threshold they failed).
  * **Total Memory Provided ($M_{\text{provided}}$) & Nominal vs. Peak Memory Used ($M_{\text{nominal\_used}}$ vs. $M_{\text{peak\_used}}$):** Steady-state $\text{CR}_{\text{eff}} = \text{orig\_data\_size} / M_{\text{nominal\_used}}$, peak-bounded $\text{CR}_{\text{peak}} = \text{orig\_data\_size} / M_{\text{peak\_used}}$, and transient fluctuation overshoot ($(M_{\text{peak\_used}} - M_{\text{nominal\_used}}) / M_{\text{nominal\_used}}$).
  * **CPU Compute Usage & Saved Memory per CPU Cycle ($\eta_{\text{mem/cpu}}$):** Cycles per 4 KiB page, foreground vs. background `kthread` CPU %, CPU PSI, and net **Bytes Saved per CPU Cycle** ($\eta_{\text{mem/cpu}} = (M_{\text{orig\_logical}} - M_{\text{nominal\_used}}) / C_{\text{total\_cycles}}$).
  * **Read Time & Write Time:** P50/P99/P99.9 read (decompression/fault) and write (compression/store) latency ($\mu\text{s}$) and throughput (MiB/s).
  * **Survivor Drawbacks Observed:** Trade-offs exhibited by the surviving configurations (e.g., CPU tax, tail latency, or reduced capacity ceiling).
* Promote verified takeaways to `docs/research/` or `docs/adr/`.
