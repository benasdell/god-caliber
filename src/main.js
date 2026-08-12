import * as THREE from 'three';
import { GameScene } from './scene.js';
import { Player } from './player.js';
import { Controls } from './controls.js';
import { Weapon } from './weapon.js';
import { BulletManager } from './bullets.js';
import { TargetManager } from './targets.js';
import { UIManager } from './ui.js';
import { MeleeWeapon } from './melee.js';
import { InventoryManager } from './inventory.js';
import { InventoryUI } from './inventory-ui.js';
import { WorldItemManager } from './world-items.js';
import { NetworkManager } from './multiplayer/NetworkManager.js';
import { GameStateManager, MATCH_PHASES } from './game-state.js';
import { CircleManager } from './circle.js';
import { sound } from './audio.js';

// Preallocated scratch vectors for zero allocation firing logic
const _muzzlePos = new THREE.Vector3();
const _shootDir = new THREE.Vector3();

class Game {
  constructor() {
    window.gameInstance = this;
    this.canvas = document.getElementById('game-canvas');
    this.blocker = document.getElementById('blocker');

    // 1. Initialize Scene & Octree Environment
    this.sceneManager = new GameScene(this.canvas);
    
    // 2. Initialize Controls
    this.controls = new Controls(this.canvas, this.blocker);

    // 3. Initialize Player Capsule Physics
    this.player = new Player(this.sceneManager.camera, this.sceneManager.worldOctree);

    // 4. Initialize Weapon (Procedural AR-15 at 450 RPM)
    this.weapon = new Weapon(this.sceneManager.camera);

    // 5. Initialize Quick Melee Combat Knife
    this.melee = new MeleeWeapon(this.sceneManager.camera);

    // 6. Initialize Inventory Manager & UI
    this.inventory = new InventoryManager(5, 12);
    this.inventoryUI = new InventoryUI(this.inventory, this.controls, this.player, this.weapon, this.melee);

    // 7. Initialize World Ground Loot Manager
    this.worldItemManager = new WorldItemManager(this.sceneManager.scene, this.sceneManager.worldOctree);

    // 8. Initialize Multiplayer Network Manager
    this.network = new NetworkManager(this.sceneManager.scene, this.player);
    this.network.init(this.controls.playerName || 'Player_1');

    // Route WebRTC peer events
    this.network.onPeerEvent = (event) => {
      if (!event || !event.type) return;
      switch (event.type) {
        case 'start_match':
          this.startBRMatch();
          break;
        case 'phase':
          if (this.gameState) {
            if (event.phase !== undefined) {
              this.gameState.phase = event.phase;
            }
            if (event.circleStage !== undefined) {
              this.gameState.circleStage = event.circleStage;
            }
          }
          break;
        case 'hit':
          {
            const localId = this.network.peer?.id;
            if (event.target === localId && typeof event.damage === 'number' && this.player) {
              this.player.takeDamage(event.damage, null, event.attacker, event.attackerName);
            }
          }
          break;
        case 'bullet_fire':
          if (Array.isArray(event.startPos) && Array.isArray(event.hitPoint) && this.bullets) {
            const start = new THREE.Vector3(event.startPos[0], event.startPos[1], event.startPos[2]);
            const hit = new THREE.Vector3(event.hitPoint[0], event.hitPoint[1], event.hitPoint[2]);
            this.bullets.spawnTracer(start, hit, 0xff2a6d);
          }
          break;
        case 'kill':
          if (this.ui) {
            const headshotTag = event.isHeadshot ? '🎯 ' : '';
            const killer = event.attackerName || 'Player';
            const victim = event.victimName || 'Player';
            this.ui.addKillFeed(`${headshotTag}⚡ ${killer} ELIMINATED ${victim}`);
          }
          // Increment local kills if local player was the attacker
          if (event.attacker && event.attacker === this.network.peer?.id) {
            this.playerKills = (this.playerKills || 0) + 1;
          }
          // Update peer stats
          if (event.victim && this.network.peerPlayers.has(event.victim)) {
            const victimPeer = this.network.peerPlayers.get(event.victim);
            if (victimPeer) victimPeer.deaths = (victimPeer.deaths || 0) + 1;
          }
          if (event.attacker && this.network.peerPlayers.has(event.attacker)) {
            const attackerPeer = this.network.peerPlayers.get(event.attacker);
            if (attackerPeer) attackerPeer.kills = (attackerPeer.kills || 0) + 1;
          }
          break;
        case 'peer-joined':
          if (this.ui) {
            this.ui.addKillFeed(`👤 PLAYER JOINED: ${event.name || 'Peer'}`);
            this.ui.renderConnectedPlayers();
          }
          break;
        case 'peer-left':
          if (this.ui) {
            this.ui.addKillFeed(`👤 PLAYER LEFT LOBBY`);
            this.ui.renderConnectedPlayers();
          }
          break;
        case 'connected':
          if (this.ui) {
            this.ui.addKillFeed(`✅ CONNECTED TO LOBBY ${event.roomId}`);
            this.ui.renderConnectedPlayers();
          }
          break;
        case 'host-open':
          if (this.ui) {
            this.ui.addKillFeed(`👑 LOBBY OPEN: ${event.roomId}`);
            this.ui.renderConnectedPlayers();
          }
          break;
        case 'host-disconnected':
          if (this.ui) {
            this.ui.addKillFeed(`⚠️ HOST DISCONNECTED${event.reason ? ': ' + event.reason : ''}`);
            this.ui.updateConnectionState('disconnected', event.reason || 'Host left');
            this.ui.renderConnectedPlayers();
          }
          break;
        case 'connection-state':
          if (this.ui) {
            this.ui.updateConnectionState(event.state, event.detail);
          }
          break;
        case 'join-failed':
          if (this.ui) {
            this.ui.addKillFeed(`❌ JOIN FAILED: ${event.reason}`);
            this.ui.updateConnectionState('failed', event.reason);
          }
          break;
        case 'error':
          if (this.ui) {
            const errStr = typeof event.error === 'string' ? event.error : (event.error?.type || event.error?.message || 'Connection Error');
            this.ui.addKillFeed(`⚠️ NETWORK NOTICE: ${errStr}`);
          }
          break;
      }
    };

    // 9. Initialize UI Manager (God-Caliber Branding & Controls)
    this.ui = new UIManager(this.controls);

    // 9. Auto-join lobby if URL parameter ?lobby=ROOMCODE is present
    const urlParams = new URLSearchParams(window.location.search);
    const autoLobby = urlParams.get('lobby');
    if (autoLobby) {
      const cleanCode = autoLobby.trim().toUpperCase();
      console.log(`[Game] Auto-joining lobby from URL parameter: ${cleanCode}`);
      if (this.ui && this.ui.roomCodeInput) {
        this.ui.roomCodeInput.value = cleanCode;
      }
      // Wait for next animation frame to ensure all game systems are initialized
      requestAnimationFrame(() => {
        if (this.network) {
          this.network.joinLobby(cleanCode);
        }
      });
    }

    // 10. Initialize Bullet Pool & Enemy AI Manager
    this.bulletManager = new BulletManager(this.sceneManager.scene, this.sceneManager.worldOctree);
    this.targetManager = new TargetManager(this.sceneManager.scene, this.sceneManager.worldOctree, this.ui);

    // 11. Initialize Game State Manager & Circle Manager for BR mode
    this.gameState = new GameStateManager();
    this.circle = new CircleManager(this.sceneManager.scene);
    this._lastCircleStage = 0;
    this._lastPhase = this.gameState ? this.gameState.phase : null;
    this._lastCircleStageBroadcast = 0;

    // Wire managers together
    this.targetManager.worldItemManager = this.worldItemManager;

    // Cache interaction HUD elements
    this.interactPromptEl = document.getElementById('interaction-prompt');
    this.interactActionEl = document.getElementById('interact-action');

    // Input state latching
    this.inventoryKeyWasPressed = false;
    this.craftingKeyWasPressed = false;
    this.meleeKeyWasPressed = false;
    this.interactKeyWasPressed = false;
    this.dropKeyWasPressed = false;

    // Set global game instance reference
    window.gameInstance = this;
    this.activeWeaponSlot = 'primary';
    this.playerKills = 0;
    this.playerDeaths = 0;

    // Bind Start Match and Play Again buttons
    this.startBtn = document.getElementById('start-btn');
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        if (!this.gameState.isMatchActive) {
          this.startBRMatch();
        }
      });
    }
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        this.ui.hideResultOverlays();
        this.startBRMatch();
        this.requestPointerLockSafe();
      });
    }
    const playAgainDefeatBtn = document.getElementById('play-again-defeat-btn');
    if (playAgainDefeatBtn) {
      playAgainDefeatBtn.addEventListener('click', () => {
        this.ui.hideResultOverlays();
        this.startBRMatch();
        this.requestPointerLockSafe();
      });
    }

    // Spawn initial gear items and loot around the map
    this.spawnInitialGroundLoot();

    // Timing Clock
    this.clock = new THREE.Clock();

    // Start Main Loop
    this.animate();
  }

  startBRMatch() {
    if (this.network && this.network.isHost) {
      this.network.broadcast({ type: 'start_match' });
    }
    this.gameState.startMatch();
    this.circle.reset();
    this._lastCircleStage = 0;
    this._lastPhase = this.gameState.phase;
    this._lastCircleStageBroadcast = this.gameState.circleStage;
    this.player.reset();
    this.ui.hideResultOverlays();

    // Reset inventory items and spawn with P-57 Pistol + Combat Knife
    this.inventory.items = [];
    this.inventory.grid = Array.from({ length: 5 }, () => Array(12).fill(null));
    this.inventory.initDefaultItems();
    this.inventoryUI.applyEquipmentStats();
    this.inventoryUI.renderItems();
    this.activeWeaponSlot = 'primary';
    this.weapon.setWeaponType('weapon_pistol');

    // Clear existing ground items & spawn initial ground loot scatter
    if (this.worldItemManager) {
      this.worldItemManager.groundItems.forEach(item => this.sceneManager.scene.remove(item.meshGroup));
      this.worldItemManager.groundItems = [];
      this.spawnInitialGroundLoot();
    }

    // Clear existing enemies
    if (this.targetManager) {
      this.targetManager.targets.forEach(b => this.sceneManager.scene.remove(b.group));
      this.targetManager.targets = [];
    }
  }

  isSpawnPositionValid(pos, existingPositions, minDistance = 2.5) {
    for (let i = 0; i < existingPositions.length; i++) {
      if (pos.distanceTo(existingPositions[i]) < minDistance) {
        return false;
      }
    }
    return true;
  }

  spawnInitialGroundLoot() {
    this.spawnWaveChests();

    // Collect chest landmark positions to ensure ground loot doesn't overlap chests (< 2.5m spacing)
    const occupiedPositions = [];
    if (this.worldItemManager && this.worldItemManager.groundItems) {
      this.worldItemManager.groundItems.forEach(item => {
        if (item.meshGroup) {
          occupiedPositions.push(item.meshGroup.position.clone());
        }
      });
    }

    // 6 Scattered Weapons (2 rifles, 2 shotguns, 1 pistol, 1 sniper) spread far apart around cover structures
    const weaponTypes = [
      'weapon_ar15', 'weapon_ar15',
      'weapon_shotgun', 'weapon_shotgun',
      'weapon_pistol',
      'weapon_sniper'
    ];
    const weaponPositions = [
      new THREE.Vector3(-33, 1, -2),
      new THREE.Vector3(33, 1, -2),
      new THREE.Vector3(0, 1, -38),
      new THREE.Vector3(0, 1, 38),
      new THREE.Vector3(-55, 1, -55),
      new THREE.Vector3(55, 1, -55)
    ];
    const weaponRarities = ['normal', 'magic', 'normal', 'rare', 'normal', 'rare'];

    weaponTypes.forEach((wType, idx) => {
      const pos = weaponPositions[idx];
      if (pos && this.isSpawnPositionValid(pos, occupiedPositions, 2.5)) {
        const item = this.inventory.generateRandomItem(wType, weaponRarities[idx]);
        if (item) {
          this.worldItemManager.spawnItem(item, pos);
          occupiedPositions.push(pos.clone());
        }
      }
    });

    // 5 Scattered Gear Items (2 helmets, 2 vests, 1 gloves) spread far apart around cover structures
    const gearBaseIds = ['item_helmet', 'item_helmet', 'item_vest', 'item_vest', 'item_gloves'];
    const gearPositions = [
      new THREE.Vector3(-18, 1, -15),
      new THREE.Vector3(18, 1, 15),
      new THREE.Vector3(-55, 1, 55),
      new THREE.Vector3(55, 1, 55),
      new THREE.Vector3(-35, 1, 55)
    ];
    const gearRarities = ['normal', 'magic', 'normal', 'rare', 'magic'];

    gearBaseIds.forEach((baseId, idx) => {
      const pos = gearPositions[idx];
      if (pos && this.isSpawnPositionValid(pos, occupiedPositions, 2.5)) {
        const item = this.inventory.generateRandomItem(baseId, gearRarities[idx]);
        if (item) {
          this.worldItemManager.spawnItem(item, pos);
          occupiedPositions.push(pos.clone());
        }
      }
    });
  }

  spawnGroundItemNearPlayer(itemData) {
    const pos = this.player.camera.position.clone();
    this.sceneManager.camera.getWorldDirection(_shootDir);
    _shootDir.y = 0; // Flat direction
    _shootDir.normalize();

    // Spawn slightly in front of player
    pos.addScaledVector(_shootDir, 1.2);
    pos.y = Math.max(0.5, pos.y - 1.0);

    const kick = new THREE.Vector3().copy(_shootDir).multiplyScalar(2.0);
    kick.y = 3.0;

    this.worldItemManager.spawnItem(itemData, pos, kick);
  }

  handleFiring() {
    if (this.melee.isActive) return; // Cannot shoot while swinging knife

    const bp = this.weapon.currentBlueprint;
    if (!bp) return;

    if (this.controls.shootRequested || (this.controls.mouseDown && !this.weapon.isReloading)) {
      this.controls.shootRequested = false;

      const didFire = this.weapon.shoot();
      if (didFire) {
        if (this.network) this.network.isFiring = true;
        // Stop sprinting when firing
        this.player.cancelSprint(this.controls);

        // Sync current ammo to active item
        const activeItem = this.inventory.equipment[this.activeWeaponSlot];
        if (activeItem) {
          activeItem.currentAmmo = this.weapon.currentAmmo;
        }

        // Recoil screen shake
        let shake = 0.02;
        if (bp.isSniper) shake = 0.18;
        else if (bp.isShotgun) shake = 0.10;
        else if (this.weapon.currentWeaponType === 'weapon_pistol') shake = 0.015;
        this.player.triggerScreenShake(shake);

        this.weapon.getMuzzleWorldPosition(_muzzlePos);
        this.sceneManager.camera.getWorldDirection(_shootDir);

        const damage = bp.baseDamage * (this.weapon.damageMultiplier || 1.0);

        // Raycast from camera center to find the exact point the player is aiming at (convergence)
        const _aimTarget = new THREE.Vector3();
        const _cameraRay = new THREE.Ray(this.player.camera.position, _shootDir);
        const intersect = this.sceneManager.worldOctree.rayIntersect(_cameraRay);
        if (intersect) {
          _aimTarget.copy(intersect.position);
        } else {
          // Default to a target point 100 meters ahead in front of camera
          _aimTarget.copy(this.player.camera.position).addScaledVector(_shootDir, 100);
        }

        // Calculate accurate direction from gun muzzle to the aim target point
        const fireDir = new THREE.Vector3().subVectors(_aimTarget, _muzzlePos).normalize();

        // Determine bullet speed (m/s) based on weapon specs
        let speed = 150; // Default Combat Rifle speed: 150 m/s
        if (bp.isSniper) {
          speed = 9999; // Instant hitscan
        } else if (bp.isShotgun) {
          speed = 90; // Shotgun speed: 90 m/s
        } else if (this.weapon.currentWeaponType === 'weapon_pistol') {
          speed = 110; // Pistol speed: 110 m/s
        }

        if (bp.isShotgun) {
          const pellets = bp.pellets || 12;
          const spread = bp.spread || 0.08;
          for (let i = 0; i < pellets; i++) {
            const spreadDir = fireDir.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * spread,
              (Math.random() - 0.5) * spread,
              (Math.random() - 0.5) * spread
            )).normalize();
            this.bulletManager.spawnBullet(_muzzlePos, spreadDir, damage, speed);
          }
        } else {
          let spreadDir = fireDir.clone();
          if (bp.spread > 0 && !this.weapon.isScoped) {
            spreadDir.add(new THREE.Vector3(
              (Math.random() - 0.5) * bp.spread,
              (Math.random() - 0.5) * bp.spread,
              (Math.random() - 0.5) * bp.spread
            )).normalize();
          }
          this.bulletManager.spawnBullet(_muzzlePos, spreadDir, damage, speed);
        }
      }
    }
  }

  handleInputs() {
    // 1. Inventory & Crafting Toggle (Key I, Key C, or Escape)
    const isOpen = this.inventoryUI.isOpen;
    const wantsClose = isOpen && this.controls.keyState.escape;
    const wantsStorage = this.controls.keyState.inventory;
    const wantsCrafting = this.controls.keyState.crafting;

    if (wantsClose) {
      this.inventoryUI.close();
      this.controls.keyState.escape = false;
      this.controls.keyState.inventory = false;
      this.controls.keyState.crafting = false;
      this.controls.lastInventoryCloseTime = Date.now();
      if (this.controls.blocker) {
        this.controls.blocker.classList.add('hidden');
      }
      setTimeout(() => {
        if (!this.inventoryUI.isOpen && !document.pointerLockElement) {
          this.requestPointerLockSafe();
        }
      }, 80);
    } else if (wantsStorage) {
      if (!this.inventoryKeyWasPressed) {
        this.inventoryKeyWasPressed = true;
        if (isOpen && this.inventoryUI.activeTab === 'storage') {
          // Pressing I while already on Storage tab closes inventory
          this.inventoryUI.close();
          this.controls.blocker.classList.add('hidden');
          this.requestPointerLockSafe();
        } else {
          // Open or switch to Storage tab
          this.inventoryUI.toggle('storage');
        }
        this.controls.keyState.inventory = false;
      }
    } else if (wantsCrafting) {
      if (!this.craftingKeyWasPressed) {
        this.craftingKeyWasPressed = true;
        if (isOpen && this.inventoryUI.activeTab === 'crafting') {
          // Pressing C while already on Crafting tab closes inventory
          this.inventoryUI.close();
          this.controls.blocker.classList.add('hidden');
          this.requestPointerLockSafe();
        } else {
          // Open or switch to Crafting tab
          this.inventoryUI.toggle('crafting');
        }
        this.controls.keyState.crafting = false;
      }
    } else {
      this.inventoryKeyWasPressed = false;
      this.craftingKeyWasPressed = false;
    }

    // 2. Quick Melee (Key X)
    if (this.controls.keyState.melee && this.controls.isLocked) {
      if (!this.meleeKeyWasPressed) {
        this.meleeKeyWasPressed = true;
        this.melee.startMelee();
      }
    } else {
      this.meleeKeyWasPressed = false;
    }

    // 3. Drop Active Weapon (Key Q)
    if (this.controls.keyState.drop && this.controls.isLocked) {
      if (!this.dropKeyWasPressed) {
        this.dropKeyWasPressed = true;
        
        // Try to unequip active weapon slot
        const weaponItem = this.inventory.equipment[this.activeWeaponSlot];
        if (weaponItem) {
          this.inventory.unequipItem(this.activeWeaponSlot);
          this.spawnGroundItemNearPlayer(weaponItem);
          this.ui.addKillFeed(`DROPPED ${weaponItem.name}`);
          this.inventoryUI.applyEquipmentStats();
          this.inventoryUI.renderItems();
        }
      }
    } else {
      this.dropKeyWasPressed = false;
    }

    // 4. Weapon Slot Switching (Key 1 & Key 2)
    if (this.controls.isLocked) {
      if (this.controls.keyState.slot1) {
        this.switchWeaponSlot('primary');
      } else if (this.controls.keyState.slot2) {
        this.switchWeaponSlot('secondary');
      }
    }

    // 4. Interact / Pick Up Ground Items, Ziplines & Ladders (Key F)
    if (this.controls.keyState.interact && this.controls.isLocked) {
      if (!this.interactKeyWasPressed) {
        this.interactKeyWasPressed = true;

        const playerPos = this.player.camera.position;
        const cameraDir = new THREE.Vector3();
        this.player.camera.getWorldDirection(cameraDir);

        const terrainObj = this.sceneManager.terrainManager ? this.sceneManager.terrainManager.getClosestInteractable(playerPos, cameraDir) : null;
        const closestLoot = this.worldItemManager.getClosestInteractable(playerPos);

        const distToLoot = closestLoot ? playerPos.distanceTo(closestLoot.meshGroup.position) : Infinity;
        const distToTerrain = terrainObj && terrainObj.dist !== undefined ? terrainObj.dist : Infinity;

        const isLootPrioritized = closestLoot && (!terrainObj || distToLoot < distToTerrain);

        if (isLootPrioritized) {
          const item = closestLoot.itemData;
          if (item.isChest) {
            this.openChest(closestLoot);
          } else {
            const space = this.inventory.findEmptySpace(item);
            if (space) {
              this.inventory.addItem(item, space.row, space.col);
              this.worldItemManager.removeItem(closestLoot);
              this.ui.addKillFeed(`ACQUIRED ${item.name}`);
              sound.playReload();
              this.inventoryUI.applyEquipmentStats();
              this.inventoryUI.renderItems();
            } else {
              this.ui.addKillFeed("⚠️ INVENTORY GRID STORAGE FULL!");
              sound.playEmpty();
            }
          }
        } else if (terrainObj) {
          if (terrainObj.type === 'zipline') {
            if (this.player.isZiplining) {
              this.player.detachZipline(true);
            } else {
              this.player.attachZipline(terrainObj.data, terrainObj.startProgress, terrainObj.dirSign);
              this.ui.addKillFeed("⚡ ATTACHED TO ZIPLINE!");
            }
          } else if (terrainObj.type === 'ladder') {
            if (this.player.isClimbingLadder) {
              this.player.detachLadder();
            } else {
              this.player.attachLadder(terrainObj.data);
              this.ui.addKillFeed("🪜 CLIMBING LADDER");
            }
          }
        }
      }
    } else {
      this.interactKeyWasPressed = false;
    }
  }

  switchWeaponSlot(slotName) {
    if (this.activeWeaponSlot === slotName) return;

    // Preserve ammo on outgoing weapon
    const currentItem = this.inventory.equipment[this.activeWeaponSlot];
    if (currentItem) {
      currentItem.currentAmmo = this.weapon.currentAmmo;
    }

    this.activeWeaponSlot = slotName;
    sound.playReload();
    this.inventoryUI.applyEquipmentStats();
    
    const label = slotName === 'primary' ? 'SLOT 1' : 'SLOT 2';
    const activeItem = this.inventory.equipment[slotName];
    if (activeItem) {
      this.ui.addKillFeed(`EQUIPPED ${activeItem.name} [${label}]`);
    } else {
      this.ui.addKillFeed(`NO WEAPON EQUIPPED [${label}]`);
    }
  }

  openChest(chest) {
    sound.playReload(); // Chest click open sound
    this.ui.addKillFeed("📦 TACTICAL CRATE OPENED! SHATTERING LOOT.");

    const pos = chest.meshGroup.position.clone();
    this.worldItemManager.removeItem(chest);

    // Spawn 4 random items that burst into the air
    for (let i = 0; i < 4; i++) {
      const recipeRoll = Math.random();
      let baseId = '';
      let rarity = 'normal';

      if (recipeRoll <= 0.12) { // 12% chance to drop a legendary recipe from chest
        baseId = 'item_recipe';
        rarity = 'legendary';
      } else {
        const roll = Math.random();
        if (roll >= 0.94) rarity = 'epic'; // High-end items are epic max
        else if (roll >= 0.75) rarity = 'rare';
        else if (roll >= 0.40) rarity = 'magic';
        else rarity = 'normal';

        const baseTemplates = ['item_helmet', 'item_vest', 'item_gloves', 'weapon_ar15', 'weapon_pistol', 'weapon_sniper', 'weapon_shotgun', 'weapon_knife'];
        baseId = baseTemplates[Math.floor(Math.random() * baseTemplates.length)];
      }

      const itemData = this.inventory.generateRandomItem(baseId, rarity);

      if (itemData) {
        // Scatter physics velocity kick
        const kick = new THREE.Vector3(
          (Math.random() - 0.5) * 4.0,
          Math.random() * 4.0 + 4.0,
          (Math.random() - 0.5) * 4.0
        );
        this.worldItemManager.spawnItem(itemData, pos.clone().add(new THREE.Vector3(0, 0.3, 0)), kick);
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const rawDelta = this.clock.getDelta();
    const deltaTime = Math.min(0.05, rawDelta);

    this.handleInputs();

    // 0. Update Game State & BR Phase HUD
    if (this.gameState) {
      if (this.controls.isLocked) {
        this.gameState.update(deltaTime);
      }

      if (this.network && this.network.isHost && (this.gameState.phase !== this._lastPhase || this.gameState.circleStage !== this._lastCircleStageBroadcast)) {
        this._lastPhase = this.gameState.phase;
        this._lastCircleStageBroadcast = this.gameState.circleStage;
        this.network.broadcast({
          type: 'phase',
          phase: this.gameState.phase,
          circleStage: this.gameState.circleStage
        });
      }

      this.ui.updatePhaseHUD(this.gameState);

      if (this.startBtn) {
        this.startBtn.textContent = this.gameState.isMatchActive ? 'RESUME COMBAT' : 'ENTER COMBAT ZONE';
      }

      // Check player death & Respawn Token
      if (this.player.isDead) {
        if (this.inventory.hasRespawnToken()) {
          this.inventory.consumeRespawnToken();
          this.gameState.stats.respawnTokensUsed++;
          this.player.reset();
          this.player.hp = 50;
          this.ui.addKillFeed("📿 RESPAWN TOKEN CONSUMED! 50% HP RESTORED.");
        } else {
          this.gameState.triggerDefeat();
          this.ui.showDefeatOverlay(this.gameState.stats);
          if (this.controls.isLocked) {
            document.exitPointerLock();
          }
        }
      }

      // Check Victory Condition
      if (this.gameState.phase === MATCH_PHASES.VICTORY) {
        this.ui.showVictoryOverlay(this.gameState.stats);
        if (this.controls.isLocked) {
          document.exitPointerLock();
        }
      }

      // Circle Update & Stage Activation
      if (this.gameState.circleStage !== this._lastCircleStage) {
        this._lastCircleStage = this.gameState.circleStage;
        if (this.gameState.circleStage > 0) {
          this.circle.activateStage(this.gameState.circleStage);
        }
      }

      if (this.gameState.isMatchActive) {
        if (this.controls.isLocked) {
          const circleResult = this.circle.update(deltaTime, this.player.camera.position);
          if (circleResult.damage > 0) {
            this.player.takeDamage(circleResult.damage);
          }
          const warningEl = document.getElementById('circle-warning');
          if (warningEl) {
            warningEl.classList.toggle('hidden', !circleResult.isOutside);
          }
        }
      } else {
        const warningEl = document.getElementById('circle-warning');
        if (warningEl) warningEl.classList.add('hidden');
      }
    }

    if (this.controls.isLocked) {
      // Auto-start BR match when entering pointer lock if match is not active
      if (this.gameState && !this.gameState.isMatchActive && this.gameState.phase === MATCH_PHASES.LOBBY) {
        this.startBRMatch();
      }

      // 1. Firing Input
      this.handleFiring();

      // 2. Player Capsule Physics & Controls
      this.player.update(deltaTime, this.controls);

      // 3. Weapon Recoil, Sway & Reload Stowing
      this.weapon.update(deltaTime, this.controls);
      this.melee.update(deltaTime);

      // Sync active weapon ammo state to equipped item
      const currentActiveItem = this.inventory.equipment[this.activeWeaponSlot];
      if (currentActiveItem && this.weapon.isActive) {
        currentActiveItem.currentAmmo = this.weapon.currentAmmo;
      }

      // 4. Quick Melee Knife Logic & Raycast Hit Check
      const hitTarget = this.melee.checkHit(this.targetManager);
      if (hitTarget) {
        this.ui.triggerHitmarker();
      }
      this.weapon.isMeleeActive = this.melee.isActive;

      // 5. Update Network Manager (20Hz peer sync)
      if (this.network) {
        this.network.update(deltaTime);
      }

      // 6. Update World Items Physics
      this.worldItemManager.update(deltaTime);

      // 7. Proximity Check for HUD Interaction Prompt (Zipline, Ladder, or Loot)
      const playerPos = this.player.camera.position;
      const cameraDir = new THREE.Vector3();
      this.player.camera.getWorldDirection(cameraDir);

      const terrainObj = this.sceneManager.terrainManager ? this.sceneManager.terrainManager.getClosestInteractable(playerPos, cameraDir) : null;
      const closestLoot = this.worldItemManager.getClosestInteractable(playerPos);

      const distToLoot = closestLoot ? playerPos.distanceTo(closestLoot.meshGroup.position) : Infinity;
      const distToTerrain = terrainObj && terrainObj.dist !== undefined ? terrainObj.dist : Infinity;

      const isLootPrioritized = closestLoot && (!terrainObj || distToLoot < distToTerrain);

      if (isLootPrioritized && this.interactPromptEl && this.interactActionEl) {
        this.interactPromptEl.classList.remove('hidden');
        const item = closestLoot.itemData;
        this.interactActionEl.style.color = item.borderColor || '#64748b';
        if (item.isChest) {
          this.interactActionEl.textContent = `OPEN ${item.name}`;
        } else {
          const rarityTag = item.rarity ? `[${item.rarity.toUpperCase()}]` : '[NORMAL]';
          this.interactActionEl.textContent = `PICK UP ${item.name} ${rarityTag}`;
        }
      } else if (terrainObj && this.interactPromptEl && this.interactActionEl) {
        this.interactPromptEl.classList.remove('hidden');
        this.interactActionEl.style.color = '#00f0ff';
        if (terrainObj.type === 'zipline') {
          this.interactActionEl.textContent = `ATTACH TO ZIPLINE`;
        } else if (terrainObj.type === 'ladder') {
          this.interactActionEl.textContent = `CLIMB LADDER`;
        }
      } else if (this.interactPromptEl) {
        this.interactPromptEl.classList.add('hidden');
      }

      // 7. Pooled Projectiles & Octree Collision
      this.bulletManager.update(deltaTime, this.targetManager, this.ui);

      // 8. Enemy AI Navigation & Continuous MMO Spawning
      this.targetManager.update(deltaTime, this.player.camera.position);

      // 9. Continuous Tactical Crate Refresh Loop (Every 120s)
      this.chestRefreshTimer = (this.chestRefreshTimer || 120.0) - deltaTime;
      if (this.chestRefreshTimer <= 0) {
        this.chestRefreshTimer = 120.0;
        this.spawnWaveChests();
      }
    } else {
      if (this.interactPromptEl) {
        this.interactPromptEl.classList.add('hidden');
      }
    }

    // 10. HUD Displays (Runs every frame in render loop to handle crosshair, minimap & UI updates)
    this.ui.updateHUD(this.player, this.weapon, this.inventory, this.circle, this.targetManager ? this.targetManager.targets : []);

    // 10. Update Damage Numbers projection
    this.ui.updateDamageNumbers(this.sceneManager.camera);

    // 11. Update Leaderboard Overlay visibility
    const leaderboardEl = document.getElementById('leaderboard-overlay');
    if (leaderboardEl) {
      if (this.controls.keyState.tab) {
        leaderboardEl.classList.remove('hidden');
        this.ui.updateLeaderboardUI();
      } else {
        leaderboardEl.classList.add('hidden');
      }
    }

    // Reset accumulated mouse delta for frame
    this.controls.resetMouseDelta();

    // Render 3D Scene
    this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
  }

  spawnWaveChests() {
    if (!this.worldItemManager) return;

    // 1. Clear previous unopened chests
    const itemsList = this.worldItemManager.groundItems || [];
    const itemsToRemove = itemsList.filter(item => item && item.itemData && item.itemData.isChest);
    itemsToRemove.forEach(chest => this.worldItemManager.removeItem(chest));

    const spawnChest = (id, pos) => {
      const chestData = {
        id: id,
        name: 'TACTICAL CRATE',
        type: 'chest',
        isChest: true,
        rarity: 'legendary',
        color: 'linear-gradient(135deg, #1e293b 0%, #f9731625 100%)',
        borderColor: '#f97316',
        icon: '📦',
        desc: 'Military storage crate. Open to discover high-tier gear and rare recipes.'
      };
      this.worldItemManager.spawnItem(chestData, pos);
    };

    // 16 Tactical Crates spread across landmarks and 240x240m map
    const cratePositions = [
      new THREE.Vector3(0, 3.2, 0),        // Center platform
      new THREE.Vector3(0, 7.2, -50),      // North Overlook
      new THREE.Vector3(0, 7.2, 50),       // South Overlook
      new THREE.Vector3(-40, 10.2, -40),   // NW Pillar
      new THREE.Vector3(40, 10.2, -40),    // NE Pillar
      new THREE.Vector3(-40, 10.2, 40),    // SW Pillar
      new THREE.Vector3(40, 10.2, 40),     // SE Pillar
      new THREE.Vector3(0, 10.2, 0),       // Center walkway cross

      // 4 POI Landmark Crates
      new THREE.Vector3(60, 15.2, -60),    // POI 1: Sniper Outpost Tower Top
      new THREE.Vector3(-60, -2.8, -60),   // POI 2: Underground Bunker Chamber
      new THREE.Vector3(-74, 8.2, 60),     // POI 3: Warehouse West Roof
      new THREE.Vector3(60, 1.2, 60),      // POI 4: CQB Courtyard Monument Base

      // Outer Perimeter Crates
      new THREE.Vector3(-85, 1.2, -85),
      new THREE.Vector3(85, 1.2, -85),
      new THREE.Vector3(-85, 1.2, 85),
      new THREE.Vector3(85, 1.2, 85),
    ];

    cratePositions.forEach((pos, idx) => {
      spawnChest(`chest_${idx}`, pos);
    });
  }

  requestPointerLockSafe() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Gracefully swallow browser pointer lock rejection after ESC
        });
      }
    } catch (e) {
      // Ignored
    }
  }
}

// Instantiate Game on DOM Content Loaded
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
