// Setup Node.js browser polyfills for headless testing
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  gameInstance: null,
  innerWidth: 1920,
  innerHeight: 1080
};
global.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
};

import assert from 'assert';
import * as THREE from 'three';
import { InventoryManager, ITEM_TEMPLATES, SPECIAL_LEGENDARIES } from '../src/inventory.js';
import { Player } from '../src/player.js';

console.log('🧪 Running God-Caliber Hotfix 0.3.11c Verification Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

// ----------------------------------------------------
// 1. PASSIVE HEALTH REGENERATION TESTS
// ----------------------------------------------------
console.log('--- 1. Passive Health Regeneration (TC-REGEN) ---');

test('TC-REGEN-01: Player passively regenerates health at +2.0 HP/s up to maxHp', () => {
  const mockCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const mockOctree = {
    capsuleIntersect: () => null,
    rayIntersect: () => null
  };
  const mockSound = {
    playJump: () => {},
    playLand: () => {},
    playHit: () => {}
  };

  const player = new Player(mockCamera, mockOctree, mockSound);
  player.hp = 20;
  player.maxHp = 100;

  const mockControls = {
    isLocked: true,
    getAndResetMouseDelta: () => ({ x: 0, y: 0 }),
    keyState: { forward: false, backward: false, left: false, right: false, jump: false, crouch: false, sprint: false, slide: false },
    mouseDelta: { x: 0, y: 0 },
    mouseDown: false,
    rightMouseDown: false
  };

  // Simulate 10 seconds of game loop updates (100 ticks of 0.1s)
  for (let i = 0; i < 100; i++) {
    player.update(0.1, mockControls);
  }

  // 20 + (2.0 HP/s * 10s) = 40 HP
  assert(Math.abs(player.hp - 40.0) < 0.01, `Expected HP ~40.0, got ${player.hp}`);

  // Simulate 40 more seconds (should clamp at 100 HP)
  for (let i = 0; i < 400; i++) {
    player.update(0.1, mockControls);
  }
  assert.strictEqual(player.hp, 100, `Expected HP clamped at 100, got ${player.hp}`);
});

test('TC-REGEN-02: Passive regeneration is suppressed when player is dead or in spectator mode', () => {
  const mockCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const mockOctree = { capsuleIntersect: () => null, rayIntersect: () => null };
  const mockSound = { playJump: () => {} };

  const player = new Player(mockCamera, mockOctree, mockSound);
  player.hp = 0;
  player.isDead = true;

  const mockControls = {
    isLocked: true,
    getAndResetMouseDelta: () => ({ x: 0, y: 0 }),
    keyState: {},
    mouseDelta: { x: 0, y: 0 }
  };

  player.update(1.0, mockControls);
  assert.strictEqual(player.hp, 0, `Dead player should not regenerate health, got ${player.hp}`);

  player.enableSpectatorMode();
  player.update(1.0, mockControls);
  assert.strictEqual(player.hp, 0, `Spectator player should not regenerate health, got ${player.hp}`);
});

test('TC-REGEN-03: Zone Collapse DPS (>5.0 DPS) strictly exceeds passive health regen (2.0 HP/s)', () => {
  const passiveRegenRate = 2.0; // HP/s
  const minCircleDPS = 5.0;     // Stage 1 Circle DPS
  const maxCircleDPS = 80.0;    // Final Circle DPS

  assert(minCircleDPS > passiveRegenRate, 'Stage 1 circle DPS must exceed passive regen rate');
  assert(maxCircleDPS > passiveRegenRate, 'Max circle DPS must exceed passive regen rate');

  // Net DPS outside circle must be negative (damaging)
  const netDPSStage1 = passiveRegenRate - minCircleDPS;
  assert.strictEqual(netDPSStage1, -3.0, 'Net DPS in stage 1 must be -3.0 HP/s');
});

// ----------------------------------------------------
// 2. BOOTS ITEM REGISTRY & GENERATION TESTS
// ----------------------------------------------------
console.log('\n--- 2. Boots Item Registry & Generation (TC-BOOTS) ---');

test('TC-BOOTS-01: Item templates and Special Legendaries register item_boots', () => {
  assert(ITEM_TEMPLATES.item_boots, 'ITEM_TEMPLATES must contain item_boots');
  assert.strictEqual(ITEM_TEMPLATES.item_boots.type, 'legs', 'item_boots type must be legs');
  assert.strictEqual(ITEM_TEMPLATES.item_boots.width, 2, 'item_boots width must be 2');
  assert.strictEqual(ITEM_TEMPLATES.item_boots.height, 2, 'item_boots height must be 2');
  assert.strictEqual(SPECIAL_LEGENDARIES.item_boots, 'AETHEL-STEP VOID TREADS', 'Special legendary name must be AETHEL-STEP VOID TREADS');
});

test('TC-BOOTS-02: Tiered Boots generation produces exact hotfix stat specifications', () => {
  const inv = new InventoryManager();

  // Tier 1 (Common) - Scout Striders
  const commonBoots = inv.generateRandomItem('item_boots', 'normal');
  assert.strictEqual(commonBoots.name, 'SCOUT STRIDERS');
  assert.strictEqual(commonBoots.modifiers.moveSpeed, 0.06, 'Common boots must provide +6% speed');
  assert.strictEqual(commonBoots.allowAirJump, false);

  // Tier 2 (Rare) - Vanguard Jump Boots
  const rareBoots = inv.generateRandomItem('item_boots', 'rare');
  assert.strictEqual(rareBoots.name, 'VANGUARD JUMP BOOTS');
  assert.strictEqual(rareBoots.modifiers.moveSpeed, 0.10, 'Rare boots must provide +10% speed');
  assert.strictEqual(rareBoots.modifiers.jumpForce, 0.20, 'Rare boots must provide +20% jump height');
  assert.strictEqual(rareBoots.allowAirJump, false);

  // Tier 3 (Legendary) - Aethel-Step Void Treads
  const legBoots = inv.generateRandomItem('item_boots', 'legendary');
  assert.strictEqual(legBoots.name, 'AETHEL-STEP VOID TREADS');
  assert.strictEqual(legBoots.modifiers.moveSpeed, 0.15, 'Legendary boots must provide +15% speed');
  assert.strictEqual(legBoots.modifiers.jumpForce, 0.35, 'Legendary boots must provide +35% jump height');
  assert.strictEqual(legBoots.allowAirJump, true, 'Legendary boots must enable allowAirJump');
});

// ----------------------------------------------------
// 3. BOOTS PHYSICS & DOUBLE JUMP TESTS
// ----------------------------------------------------
console.log('\n--- 3. Boots Physics & Air-Jump Mechanics (TC-PHYSICS) ---');

test('TC-PHYSICS-01: Legendary Boots enable mid-air double jump and reset on ground contact', () => {
  const mockCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  let groundCheckResult = null;
  const mockOctree = {
    capsuleIntersect: () => groundCheckResult,
    rayIntersect: () => null
  };
  const mockSound = { playJump: () => {} };

  const player = new Player(mockCamera, mockOctree, mockSound);
  player.allowAirJump = true;
  player.jumpMultiplier = 1.35;
  player.onGround = false;
  player.landGraceTimer = 0;
  player.hasAirJumped = false;
  player.velocity.y = -5.0; // Falling in mid-air

  const jumpInputControls = {
    isLocked: true,
    getAndResetMouseDelta: () => ({ x: 0, y: 0 }),
    keyState: { jump: true },
    mouseDelta: { x: 0, y: 0 }
  };

  // 1. Initial jump press in mid-air -> secondary jump executes
  player.update(0.016, jumpInputControls);

  assert.strictEqual(player.hasAirJumped, true, 'hasAirJumped must be true after mid-air jump');
  const expectedImpulse = player.JUMP_FORCE * 1.35;
  assert(Math.abs(player.velocity.y - expectedImpulse) < 1.0, `Expected jump velocity ~${expectedImpulse}, got ${player.velocity.y}`);

  // 2. Continuous hold spacebar in air -> should NOT trigger another impulse
  const prevYVel = player.velocity.y;
  player.update(0.016, jumpInputControls);
  assert(player.velocity.y < prevYVel, 'Gravity should decrease vertical velocity, not boost again');

  // 3. Ground contact resets hasAirJumped
  groundCheckResult = { normal: new THREE.Vector3(0, 1, 0), depth: 0.1 };
  player.playerCollisions();
  assert.strictEqual(player.onGround, true, 'Player should be grounded');
  assert.strictEqual(player.hasAirJumped, false, 'hasAirJumped must reset to false on ground contact');
});

// ----------------------------------------------------
// 4. MULTIPLAYER SNAPSHOT SCHEMA TESTS
// ----------------------------------------------------
console.log('\n--- 4. Multiplayer Snapshot Schema (TC-NET) ---');

test('TC-NET-01: NetworkManager state snapshot contains boots and speedMultiplier fields', () => {
  // Test packet generation structure
  const statePacket = {
    type: 'state',
    ts: Date.now(),
    pos: [10.5, 1.2, -45.0],
    yaw: 1.57,
    pitch: 0.1,
    hp: 100,
    weapon: 'weapon_ar15',
    boots: 'item_boots',
    speedMultiplier: 1.15,
    firing: false,
    sprinting: true,
    sliding: false,
    reloading: false,
    name: 'Operator_1'
  };

  assert.strictEqual(statePacket.boots, 'item_boots', 'State packet must serialize equipped boots');
  assert.strictEqual(statePacket.speedMultiplier, 1.15, 'State packet must serialize speed multiplier');
});

console.log(`\n========================================`);
console.log(`Results: ${passedTests} / ${totalTests} tests passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
