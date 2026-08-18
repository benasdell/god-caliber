# 🛠️ God-Caliber Technical Specification: Hotfix v0.3.11c

**Target Version:** `v0.3.11c-hotfix`  
**Engine Environment:** Three.js / WebGL / PeerJS WebRTC  
**Document Type:** Hotfix Implementation Spec  
**Status:** Approved for Implementation  
**Primary Subagents:** `high-level-designer`, `system-data-engineer`, `ui-engineer`, `network-engineer`, `security-engineer`, `version-controller`

---

## 📑 Executive Summary & Architectural Overview

Hotfix `v0.3.11c` resolves two final gameplay issues in the current Three.js build:
1. Adds a global passive health regeneration loop ($+2\text{ HP / sec}$) to provide sustain during extended combat while remaining strictly out-damaged by zone collapse damage.
2. Implements the missing **Boots** item class within the current Three.js item registry, wires it to the existing inventory UI slot, connects its movement/jump multipliers directly to the custom capsule physics solver, adds one Legendary variant into the drop pool, and replicates state over PeerJS.

---

## 🛠️ Subagent Allocation & Ownership Matrix

| Subagent | Domain / Module | Hotfix Deliverables |
| :--- | :--- | :--- |
| `high-level-designer` | Combat Balance & Item Tuning | Set passive health regen rate ($+2\text{ HP/s}$) and tune baseline boots stats (move speed, jump impulse) and Legendary boots perks. |
| `system-data-engineer` | Data Registry & Loot Tables | Register the `boots` item type, define common/rare/legendary data objects, and insert them into the existing monster/chest drop arrays. |
| `ui-engineer` | Inventory UI & Equipment Slot | Wire the existing Boots equipment slot to equip/unequip events, display item tooltips, and render 2D slot icons. |
| `network-engineer` | Physics & PeerJS Replication | Hook boots multipliers into the capsule physics controller (`moveSpeed`, `jumpVelocity`) and sync equipped boot IDs across PeerJS data packets. |
| `security-engineer` | State Validation & Anti-Tamper | Validate player movement speeds and jump heights against max allowed gear multipliers to prevent spoofed movement packets. |
| `version-controller` | Verification & Release Tagging | Run local QA test passes and apply the `v0.3.11c-hotfix` SemVer tag. |

---

## 📐 System Specifications

### 1. Passive Health Regeneration Loop
* **Problem:** Players lack combat sustain during skirmishes, relying entirely on pickup consumables.
* **Functional Requirements:**
  * In the main player tick loop (`update(delta)`), apply passive regeneration:
    $$\text{Health}_{\text{next}} = \min(\text{Health}_{\text{current}} + 2.0 \times \Delta t, \; \text{MaxHealth})$$
  * **Zone Collapse Interaction:**
    * Regeneration continues ticking during zone damage, but does not interrupt or delay circle collapse DPS.
    * Base circle DPS ($> 5.0\text{ DPS}$) strictly exceeds passive regen, preventing players from surviving outside the safe zone indefinitely.
  * **UI Update:** Real-time HUD health bar smoothly reflects ticking health without visual stepping.

---

### 2. Boots Item Class & Physics Hook
* **Problem:** The Inventory UI displays an equipment slot for Boots, but the item definition does not exist in the engine or drop tables.
* **Item Properties & Integration:**
  * **Item Type:** `ITEM_TYPE_BOOTS`
  * **Slot Target:** `SLOT_BOOTS` (Inventory UI)
  * **Item Footprint:** Standard $1 \times 1$ inventory cell.
  * **Stat Modifiers:**
    * `moveSpeedMultiplier`: Float scalar applied to base player movement speed (e.g., $1.05 = +5\%$).
    * `jumpHeightMultiplier`: Float scalar applied to vertical jump impulse (e.g., $1.15 = +15\%$).
  * **Physics Engine Integration:**
    * The custom 60Hz capsule physics solver reads active modifiers from the equipped boots slot:
      $$\text{Effective Speed} = \text{Base Speed} \times \text{moveSpeedMultiplier}$$
      $$\text{Effective Jump} = \text{Base Jump Impulse} \times \text{jumpHeightMultiplier}$$
    * Unequipping boots immediately resets multipliers back to $1.0\times$.

---

### 3. Boots Item Registry & Drop Pool Additions

Three tiers of Boots are added directly to the existing item table:

1. **Scout Striders (Common / Tier 1):**
   * `moveSpeedMultiplier`: $+6\%$ ($1.06\times$)
   * `jumpHeightMultiplier`: $+0\%$ ($1.00\times$)
2. **Vanguard Jump Boots (Rare / Tier 2):**
   * `moveSpeedMultiplier`: $+10\%$ ($1.10\times$)
   * `jumpHeightMultiplier`: $+20\%$ ($1.20\times$)
3. **Aethel-Step Void Treads (Legendary / Tier 3):**
   * `moveSpeedMultiplier`: $+15\%$ ($1.15\times$)
   * `jumpHeightMultiplier`: $+35\%$ ($1.35\times$)
   * `allowAirJump`: `true` (enables a single mid-air double-jump impulse before touching ground).

* **Drop Distribution:**
  * Inserted into the standard world crate and monster loot drop tables using the CDF weights established in hotfix `v0.3.11b`.

---

### 4. Multiplayer Sync (PeerJS WebRTC)
* **Equipment State Sync:**
  * Include equipped `bootsItemId` in the 20Hz PeerJS snapshot payload.
* **Remote Player Interpolation:**
  * Remote player animation loops use the replicated movement speed multiplier to scale stride animation playback speeds, avoiding foot-sliding.

---

## 🧪 QA Acceptance & Verification Protocol

1. **TC-REGEN-01 (Passive Regen Rate):**
   * Set player health to $20 / 100\text{ HP}$.
   * *Pass Criteria:* Health reaches $100\text{ HP}$ in exactly $40.0\text{ seconds}$ ($\pm 0.5\text{s}$) without consumables.
2. **TC-REGEN-02 (Circle Collapse Out-Damage):**
   * Step into the final circle collapse zone with full health.
   * *Pass Criteria:* Player health steadily drains to $0$; passive regen does not prevent elimination.
3. **TC-BOOTS-01 (Equip & Physics Modulation):**
   * Equip "Vanguard Jump Boots" from the inventory.
   * *Pass Criteria:* Player horizontal sprint speed increases by $10\%$, jump peak increases by $20\%$, and unequipping immediately restores default values.
4. **TC-BOOTS-02 (Legendary Air-Jump):**
   * Equip "Aethel-Step Void Treads".
   * *Pass Criteria:* Pressing jump while airborne triggers a secondary jump impulse; resets upon landing on ground geometry.
5. **TC-NET-01 (Multiplayer Replication):**
   * Equip boots on Host player and observe from Client player.
   * *Pass Criteria:* Locomotion velocity and jump arcs match without jitter, desync, or packet rejection.