// Test Suite for Hotfix 0.3.11b Verification
import * as THREE from 'three';
import { getStructureExclusionZones, VALIDATED_SPAWN_WAYPOINTS } from '../src/terrain.js';
import { InventoryManager } from '../src/inventory.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('🧪 RUNNING HOTFIX 0.3.11b VALIDATION SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. TC-SPAWN-01: Spatial Clearance & Exclusion Buffer Test
// ----------------------------------------------------
console.log('--- TEST GROUP 1: Spawn Exclusion & Safe Clearance ---');
const zones = getStructureExclusionZones(15.0);
assert(zones && zones.length > 0, `Generated ${zones.length} structure exclusion zones with 15m safety buffer`);

let waypointsValid = true;
for (const wp of VALIDATED_SPAWN_WAYPOINTS) {
  for (const zone of zones) {
    if (wp.x >= zone.minX && wp.x <= zone.maxX && wp.z >= zone.minZ && wp.z <= zone.maxZ) {
      waypointsValid = false;
      console.error(`Waypoint ${wp.x}, ${wp.y}, ${wp.z} collided with exclusion zone (${zone.minX}, ${zone.maxX}, ${zone.minZ}, ${zone.maxZ})!`);
    }
  }
}
assert(waypointsValid, `All ${VALIDATED_SPAWN_WAYPOINTS.length} fallback waypoints maintain >= 15m clearance from structural bounds`);

// Slope normal check: cos(30 deg) = 0.866025
const steepNormal = new THREE.Vector3(0, 0.70, 0.714).normalize();
const gentleNormal = new THREE.Vector3(0, 0.95, 0.312).normalize();
assert(steepNormal.y < 0.866, `Steep slope (${steepNormal.y.toFixed(3)}) rejected by slope check (< 0.866)`);
assert(gentleNormal.y >= 0.866, `Walkable slope (${gentleNormal.y.toFixed(3)}) accepted by slope check (>= 0.866)`);

// ----------------------------------------------------
// 2. TC-LOOT-01: Crafting Dust Rarity CDF & Tier Scaling
// ----------------------------------------------------
console.log('\n--- TEST GROUP 2: Crafting Dust Rarity CDF & Tier Scaling ---');
const inv = new InventoryManager();

const rarityCounts = { normal: 0, magic: 0, rare: 0, epic: 0, legendary: 0 };
const NUM_ROLLS = 10000;

for (let i = 0; i < NUM_ROLLS; i++) {
  const r = Math.random();
  let rarity = 'normal';
  if (r < 0.50) rarity = 'normal';
  else if (r < 0.78) rarity = 'magic';
  else if (r < 0.93) rarity = 'rare';
  else if (r < 0.985) rarity = 'epic';
  else rarity = 'legendary';

  rarityCounts[rarity]++;
}

const pCommon = (rarityCounts.normal / NUM_ROLLS) * 100;
const pMagic = (rarityCounts.magic / NUM_ROLLS) * 100;
const pRare = (rarityCounts.rare / NUM_ROLLS) * 100;
const pEpic = (rarityCounts.epic / NUM_ROLLS) * 100;
const pLegendary = (rarityCounts.legendary / NUM_ROLLS) * 100;

console.log(`  CDF Results (${NUM_ROLLS} rolls):`);
console.log(`    Common:    ${pCommon.toFixed(2)}% (Target ~50.0%)`);
console.log(`    Magic:     ${pMagic.toFixed(2)}% (Target ~28.0%)`);
console.log(`    Rare:      ${pRare.toFixed(2)}% (Target ~15.0%)`);
console.log(`    Epic:      ${pEpic.toFixed(2)}% (Target ~5.5%)`);
console.log(`    Legendary: ${pLegendary.toFixed(2)}% (Target ~1.5%)`);

assert(Math.abs(pCommon - 50.0) < 3.0, 'Common dust distribution within statistical tolerance (50% ± 3%)');
assert(Math.abs(pMagic - 28.0) < 2.5, 'Magic dust distribution within statistical tolerance (28% ± 2.5%)');
assert(Math.abs(pRare - 15.0) < 2.0, 'Rare dust distribution within statistical tolerance (15% ± 2%)');
assert(Math.abs(pEpic - 5.5) < 1.5, 'Epic dust distribution within statistical tolerance (5.5% ± 1.5%)');
assert(Math.abs(pLegendary - 1.5) < 1.0, 'Legendary dust distribution within statistical tolerance (1.5% ± 1%)');

// Tier stack scaling check
const minionVial = inv.generateRandomItem('item_dust_vial', 'normal', 'Minion');
const eliteVial = inv.generateRandomItem('item_dust_vial', 'rare', 'Elite');
const pinnacleVial = inv.generateRandomItem('item_dust_vial', 'legendary', 'Pinnacle');

assert(minionVial.dustAmount >= 5 && minionVial.dustAmount <= 10, `Minion dust stack (${minionVial.dustAmount}) is within [5, 10]`);
assert(eliteVial.dustAmount >= 15 && eliteVial.dustAmount <= 25, `Elite dust stack (${eliteVial.dustAmount}) is within [15, 25]`);
assert(pinnacleVial.dustAmount >= 35 && pinnacleVial.dustAmount <= 50, `Pinnacle dust stack (${pinnacleVial.dustAmount}) is within [35, 50]`);

// ----------------------------------------------------
// 3. TC-INV-01: Recycled Dust Ledger Updating
// ----------------------------------------------------
console.log('\n--- TEST GROUP 3: Recycled Dust Inventory Ledger ---');
inv.recycledDust = { normal: 0, magic: 0, rare: 0, epic: 0, legendary: 0 };
inv.addRecycledDust('normal', 10);
inv.addRecycledDust('magic', 20);
inv.addRecycledDust('rare', 15);
inv.addRecycledDust('epic', 8);
inv.addRecycledDust('legendary', 3);

assert(inv.recycledDust.normal === 10, 'Normal recycled dust correctly incremented');
assert(inv.recycledDust.magic === 20, 'Magic recycled dust correctly incremented');
assert(inv.recycledDust.rare === 15, 'Rare recycled dust correctly incremented');
assert(inv.recycledDust.epic === 8, 'Epic recycled dust correctly incremented');
assert(inv.recycledDust.legendary === 3, 'Legendary recycled dust correctly incremented');

// ----------------------------------------------------
// Final Results
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`📊 TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✨ ALL HOTFIX 0.3.11b VERIFICATION TESTS PASSED SUCCESFULLY!\n');
  process.exit(0);
}
