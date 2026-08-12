# 🎮 God-Caliber

> **A High-Tempo Browser FPS & Battle Royale Engine built with Three.js, WebGL & PeerJS WebRTC**

[![Version](https://img.shields.io/badge/version-v0.3.6-00f0ff.svg?style=for-the-badge)](package.json)
[![Engine](https://img.shields.io/badge/Engine-Three.js_v0.170.0-black.svg?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![Build](https://img.shields.io/badge/Vite-v5.4.0-646cff.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Multiplayer](https://img.shields.io/badge/Multiplayer-PeerJS_WebRTC-ff2a6d.svg?style=for-the-badge)](https://peerjs.com/)

---

## 🌟 Executive Summary & Vision

**God-Caliber** is a zero-installation, browser-native First-Person Shooter (FPS) and Battle Royale engine designed to combine fast-paced twitch gunplay with deep ARPG itemization and tactical extraction mechanics. 

By synthesizing the finest design elements from three distinct gaming genres, God-Caliber creates an unprecedented fusion of twitch skill and strategic depth:

* 🔫 **Looter-Shooters (*Destiny 2*):** Ultra-responsive gunplay, crisp recoil recovery, instant hit confirmation, and rich item progression.
* 🎒 **Extraction & Battle Royale (*Escape from Tarkov* / *Apex Legends*):** Tactical spatial awareness, shrinking force fields, high-stakes encounters, and risk-reward loot management.
* 🔮 **Action RPGs (*Path of Exile*):** Deep mechanical customization, multi-tiered crafting systems, and multi-layered build theorycrafting.

> **Core Thesis:** *FPS aim skill and movement mechanics provide fast-paced combat execution, while deep loot and crafting systems provide unmatched strategic depth and long-term replayability.*

---

## 📐 The 40 / 40 / 20 Gameplay Balance Framework

God-Caliber structures its core competitive loop around the **Micro / Meso / Macro** competitive gaming taxonomy originally formulated by game analyst and YouTube creator **Surnex** in his video essay, [*'Once you see this, You'll see Competitive Games Differently'*](https://youtu.be/NgHvdCcmQ4o).

To ensure non-degenerate gameplay where no single skill pillar unilaterally trivializes matches, God-Caliber intentionally balances gameplay depth across a **40% Micro / 40% Macro / 20% Meso** distribution using Surnex’s **"Cheat Test"** evaluation model:

```
                     ┌────────────────────────────────────────┐
                     │          GOD-CALIBER BALANCE           │
                     └───────────────────┬────────────────────┘
                                         │
       ┌─────────────────────────────────┼─────────────────────────────────┐
       ▼                                 ▼                                 ▼
┌──────────────┐                  ┌──────────────┐                  ┌──────────────┐
│  40% MICRO   │                  │  40% MACRO   │                  │  20% MESO    │
│ Execution    │                  │ Systems      │                  │ Reading      │
└──────┬───────┘                  └──────┬───────┘                  └──────┬───────┘
       │                                 │                                 │
       ▼                                 ▼                                 ▼
 [Aimbot Test]                    [Solver Test]                    [Radar/ESP Test]
```

### 1. 🎯 Micro Gameplay — Execution Layer (40%)
* **Definition:** Physical execution skill, reaction speed, recoil control, snap aim, and movement precision.
* **Inspirations:** *Destiny 2* gunplay, *Apex Legends* kinetic mobility.
* **Key Mechanics:** Instant raycast hitscan feedback, headshot audio pings, dynamic crosshair hitmarkers, high-velocity slides, ziplines, and wall-bounces.
* **Surnex Cheat Test (Aimbot Test):** An aimbot guarantees 100% mechanical aim (40% of the game), but an aimbot user targeting an opponent with an 80% physical damage reduction build (Macro) in a fortified high-ground zone (Meso) will lose the effective damage race.

### 2. 🛡️ Macro Gameplay — Systems Layer (40%)
* **Definition:** Knowledge, out-of-raid preparation, stat optimization, crafting, and build theorycrafting.
* **Inspirations:** *Path of Exile* skill trees & item crafting ecosystems.
* **Key Mechanics:** Deep item modding, elemental/physical armor mitigation formulas, stat synergies, loadout customization, and resource crafting.
* **Surnex Cheat Test (Math Solver Test):** A mathematical solver engine can optimize theoretical DPS and Effective Health Pool (EHP) to 100% (40% of the game), but theoretical stats cannot save zero-accuracy gunplay (Micro) or a blind ambush (Meso).

### 3. 📡 Meso Gameplay — Probability & Reading Layer (20%)
* **Definition:** Real-time adaptability, reading opponent habits, dynamic risk assessment, and managing randomness under stress.
* **Inspirations:** *Escape from Tarkov* zone awareness, Battle Royale positioning.
* **Key Mechanics:** Shrinking death-circle rotations, spatial audio cues, loot-drop baiting, and tactical mid-fight pivots.
* **Surnex Cheat Test (Stream Sniping / ESP Test):** Full map vision (ESP) unlocks the 20% Meso layer, but knowing an enemy is around a corner does not grant the recoil control (Micro) or stat pool (Macro) required to win the duel.

---

## ⚡ Technical Architecture

God-Caliber is built as a lightweight, zero-dependency 3D browser game architecture:

* **3D Graphics & Rendering:** Three.js (WebGL 2.0) with custom ShaderMaterial effects, glassmorphic HUD overlays, and dynamic lighting.
* **Physics & Collisions:** Zero-allocation custom 60Hz Octree capsule physics solver supporting stair-stepping, crouching, sliding, ziplines, and ladders.
* **Multiplayer Engine:** PeerJS WebRTC P2P DataChannels operating at 20Hz snapshot ticks with STUN/TURN fallback relaying.
* **Audio Engine:** Zero-latency procedural audio synthesizer powered by Web Audio API (`AudioContext`) generating dynamic gunshot hums, hit pings, headshot chimes, and spatial ambience.

---

## 🚀 Quick Start & Development

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+ recommended)
* NPM

### Local Installation & Running

```bash
# 1. Clone the repository
git clone https://github.com/benasdell/god-caliber.git
cd god-caliber

# 2. Install dependencies
npm install

# 3. Start local Vite development server
npm run dev
```

Open `http://localhost:5173` in Google Chrome or your WebGL-enabled browser.

### Development Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts local Vite dev server on `http://localhost:5173` |
| `npm run dev:tunnel` | Launches Vite dev server + automated Cloudflare Tunnel WAN URL |
| `npm run build` | Compiles TypeScript and creates minified production build in `dist/` |
| `npm run preview` | Previews production build locally |

---

## 📜 Creator Acknowledgement & Attribution

> ### 📺 Surnex Framework Attribution
> 
> The **Micro / Meso / Macro** competitive taxonomy and **Cheat Test evaluation framework** utilized throughout God-Caliber's design documentation were created and popularized by game analyst **Surnex** in his YouTube video essay:
> 
> 📺 **Watch Video**: [*Once you see this, You'll see Competitive Games Differently*](https://youtu.be/NgHvdCcmQ4o)  
> 👤 **Creator Channel**: [Surnex on YouTube](https://www.youtube.com/@Surnex)
> 
> *God-Caliber incorporates Surnex's theoretical models as core pillars for gameplay balancing and competitive design.*

---

## 📄 License & Credits

Built with ❤️ by **benasdell** using [Three.js](https://threejs.org/) and [PeerJS](https://peerjs.com/).  
Licensed under the [MIT License](LICENSE).
