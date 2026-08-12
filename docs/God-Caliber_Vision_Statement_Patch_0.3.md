# God-Caliber — Game Vision Statement
**Target Patch:** 0.3 & Beyond  
**Document Purpose:** Architectural and Design Guidance for AI/Antigravity Development Context  

---

## 1. Executive Summary & Core Genre Fusion

**God-Caliber** aims to create a hybrid First-Person Shooter experience by synthesizing the finest design elements from three distinct genres:

* **Looter-Shooters (*Destiny 2*):** Satisfying gunplay, crisp combat feel, distinct abilities, and rich item progression.
* **Extraction Shooters (*Escape from Tarkov*):** Tactical tension, high-stakes encounters, spatial/environmental awareness, and risk-reward itemization.
* **Action RPGs (*Path of Exile*):** Unprecedented mechanical depth, complex itemization, multi-layered crafting systems, and deep build customization unheard of in traditional FPS games.

> **Core Thesis:** *FPS aim skill and movement mechanics provide fast-paced, action-packed combat execution, while deep loot and crafting systems provide unmatched strategic depth and long-term replayability.*

---

## 2. The Three Layers of Gameplay (Target Split)

God-Caliber balances gameplay across three foundational layers: **Micro**, **Macro**, and **Meso**. The long-term target distribution for gameplay depth and player advantage is **40% Micro / 40% Macro / 20% Meso**.

```
+-----------------------------------------------------------------------+
|                       GOD-CALIBER GAMEPLAY TRIFECTA                   |
+-----------------------------------+-----------------------------------+
|             MICRO (40%)           |            MACRO (40%)            |
|          Execution Layer          |           Systems Layer           |
|  - Aim skill & precision          |  - Deep item crafting             |
|  - Movement & reflexes            |  - Complex builds & theorycraft   |
|  - Real-time combat execution     |  - Resource & route optimization  |
+-----------------------------------+-----------------------------------+
|                            MESO (20%)                                 |
|                         Probability Layer                             |
|  - Managing drop RNG & random events                                  |
|  - Reading AI & opponent behavior                                     |
|  - On-the-fly decision-making & risk assessment                       |
+-----------------------------------------------------------------------+
```

### 2.1 Micro Gameplay — Execution Layer (40%)
* **Definition:** Physical skill execution, reaction speed, mechanical muscle memory, mouse/controller input precision.
* **Key Components:**
  * Fast-paced movement dynamics.
  * Recoil control, track aiming, and snap accuracy.
  * Moment-to-moment combat positioning and evasive maneuvers.
* **Design Balance:** A mechanical prodigy with strong aim and movement must have a competitive edge in combat, but that edge should be **equivalent** (not superior) to a player who has mastered macro systems.

### 2.2 Macro Gameplay — Systems Layer (40%)
* **Definition:** Knowledge, theorycrafting, out-of-raid planning, gear progression, and structural game understanding.
* **Key Components:**
  * Deep item crafting, modding, and stat synergies (PoE-inspired tree/crafting depth).
  * Route planning, inventory management, and economy optimization.
  * Meta-strategy development and system-knowledge utilization.
* **Design Balance:** Dedicated study, theorycrafting, and optimized crafting/builds must grant an advantage equal in magnitude to mechanical aim skill. Smart preparation can overcome superior twitch reflexes.

### 2.3 Meso Gameplay — Probability & Adaptability Layer (20%)
* **Definition:** Real-time adaptability, reading environment/behavior, and managing randomness.
* **Key Components:**
  * Calculating and feeling loot probabilities.
  * Reading enemy AI behaviors and anticipating player movement patterns.
  * Tactical mid-fight pivoting based on dynamic world events or random occurrences.
* **Design Balance:** Meso gameplay supports the core loop by providing dynamic variability and risk management, preventing raids/matches from feeling static or purely deterministic.

---

## 3. Patch 0.3 Milestone Objectives

Patch **0.3** represents the **basic completion of this core vision**. All systems introduced or refined in this patch must align with the 40/40/20 balance paradigm:

1. **Combat Foundation (Micro):** Gunplay, movement feel, and mechanical responsiveness must meet modern high-standard FPS expectations.
2. **Crafting & Itemization Depth (Macro):** The loot and crafting systems must demonstrate clear ARPG depth (multi-tiered crafting, customizable attributes, complex itemization) rather than simple linear upgrades.
3. **Extraction & Dynamic Encounters (Meso):** Loot tables, dynamic spawns, and AI reading mechanics must effectively challenge player adaptability without overshadowing core gunplay or build strategy.

---

## 4. Antigravity Directives & Design Rules

When implementing features, balancing mechanics, or generating code/content for God-Caliber, keep these principles intact:

* **Equivalence Directive:** Never allow aim skill to completely invalidate build preparation, nor allow passive gear stats to completely remove the need for aiming/movement.
* **Depth over Complexity for Complexity's Sake:** Crafting and itemization (Macro) should offer high cognitive depth and player agency, mimicking PoE's rich item crafting ecosystem.
* **Clear Feedback:** Ensure players can immediately tell whether a defeat was caused by a Micro failure (missed shots/bad movement), a Macro failure (unoptimized build/gear match-up), or a Meso failure (poor risk evaluation/bad positioning into RNG).
