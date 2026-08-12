// Inventory UI Manager with Grid, Slots, Dynamic Stats & RPG Modifiers Hover Tooltips
import { sound } from './audio.js';
import { WEAPON_BLUEPRINTS } from './weapon.js';

export class InventoryUI {
  constructor(inventoryManager, controls, player, weapon, melee) {
    this.inv = inventoryManager;
    this.controls = controls;
    this.player = player;
    this.weapon = weapon;
    this.melee = melee;

    this.isOpen = false;
    
    // Mode states for recycling / locking
    this.recycleModeActive = false;
    this.lockModeActive = false;

    // Drag and drop states
    this.draggedItem = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragGhostEl = null;
    this.isDraggingFromEquipped = false;
    this.draggedFromSlot = null;

    this.containerEl = document.getElementById('inventory-overlay');
    this.gridContainerEl = document.getElementById('inventory-grid');
    if (this.containerEl) {
      this.containerEl.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Create the global RPG tooltip element
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'inv-tooltip hidden';
    document.body.appendChild(this.tooltipEl);

    this.upgradeTargetItem = null;
    this.activeTab = 'storage';
    this.selectedCraftCategory = 'all';
    this.selectedCraftBaseId = 'weapon_ar15';

    this.initGridDOM();
    this.initDragListeners();
    this.initToolbarListeners();
    this.initCraftingListeners();
    this.initTabListeners();
    this.applyEquipmentStats(); // Set initial stats from default items
  }

  initToolbarListeners() {
    const btnRecycleAll = document.getElementById('inv-btn-recycle-all');
    const btnRecycleMode = document.getElementById('inv-btn-recycle-mode');
    const btnLockMode = document.getElementById('inv-btn-lock-mode');

    if (btnRecycleAll) {
      btnRecycleAll.addEventListener('click', (e) => {
        e.stopPropagation();
        this.recycleAll();
      });
    }

    if (btnRecycleMode) {
      btnRecycleMode.addEventListener('click', (e) => {
        e.stopPropagation();
        this.recycleModeActive = !this.recycleModeActive;
        if (this.recycleModeActive) this.lockModeActive = false; // Mutually exclusive
        this.updateToolbarButtons();
      });
    }

    if (btnLockMode) {
      btnLockMode.addEventListener('click', (e) => {
        e.stopPropagation();
        this.lockModeActive = !this.lockModeActive;
        if (this.lockModeActive) this.recycleModeActive = false; // Mutually exclusive
        this.updateToolbarButtons();
      });
    }
  }

  updateToolbarButtons() {
    const btnRecycleMode = document.getElementById('inv-btn-recycle-mode');
    const btnLockMode = document.getElementById('inv-btn-lock-mode');

    if (btnRecycleMode) {
      if (this.recycleModeActive) {
        btnRecycleMode.classList.add('active');
        this.gridContainerEl.classList.add('recycle-mode-active');
      } else {
        btnRecycleMode.classList.remove('active');
        this.gridContainerEl.classList.remove('recycle-mode-active');
      }
    }

    if (btnLockMode) {
      if (this.lockModeActive) {
        btnLockMode.classList.add('active');
        this.gridContainerEl.classList.add('lock-mode-active');
      } else {
        btnLockMode.classList.remove('active');
        this.gridContainerEl.classList.remove('lock-mode-active');
      }
    }
  }

  initGridDOM() {
    if (!this.gridContainerEl) return;
    this.gridContainerEl.innerHTML = '';

    // Create 5x12 = 60 grid cell elements
    for (let r = 0; r < this.inv.rows; r++) {
      for (let c = 0; c < this.inv.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'inv-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        this.gridContainerEl.appendChild(cell);
      }
    }

    this.renderItems();
  }

  renderItems() {
    if (!this.gridContainerEl) return;

    // Clear existing item DOM elements
    const existingItems = this.gridContainerEl.querySelectorAll('.inv-item');
    existingItems.forEach(el => el.remove());

    const CELL_SIZE = 50; // 50px grid spacing

    // Render items currently inside 5x12 grid
    this.inv.items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'inv-item';
      itemEl.dataset.itemId = item.id;
      itemEl.style.width = `${item.width * CELL_SIZE - 4}px`;
      itemEl.style.height = `${item.height * CELL_SIZE - 4}px`;
      itemEl.style.left = `${item.col * CELL_SIZE + 2}px`;
      itemEl.style.top = `${item.row * CELL_SIZE + 2}px`;
      itemEl.style.background = item.color;
      itemEl.style.borderColor = item.borderColor;

      const lockHtml = item.isLocked ? `<div class="inv-item-lock-icon">🔒</div>` : '';
      itemEl.innerHTML = `
        ${lockHtml}
        <div class="inv-item-icon">${item.icon}</div>
        <div class="inv-item-name">${item.name}</div>
        <div class="inv-item-dim">${item.width}x${item.height}</div>
      `;

      // Tooltip hover handlers
      itemEl.addEventListener('mouseenter', (e) => this.showTooltip(e, item));
      itemEl.addEventListener('mousemove', (e) => this.updateTooltipPosition(e));
      itemEl.addEventListener('mouseleave', () => this.hideTooltip());

      itemEl.addEventListener('mousedown', (e) => {
        this.hideTooltip();
        if (this.recycleModeActive) {
          if (e.button === 0) {
            e.preventDefault();
            this.recycleItem(item);
          }
          return;
        }
        if (this.lockModeActive) {
          if (e.button === 0) {
            e.preventDefault();
            this.toggleItemLock(item);
          }
          return;
        }

        if (e.button === 2) {
          e.preventDefault();
          if (item.type === 'recipe') {
            this.learnRecipe(item);
          } else {
            this.autoEquipItem(item);
          }
        } else {
          this.onItemMouseDown(e, item);
        }
      });
      
      this.gridContainerEl.appendChild(itemEl);
    });

    // Update dust display counters
    this.updateDustDisplays();

    this.updateEquipmentUI();
  }

  updateDustDisplays() {
    const rarities = ['normal', 'magic', 'rare', 'epic', 'legendary'];
    const icons = { normal: '⚪', magic: '🔵', rare: '🟡', epic: '🟣', legendary: '🟠' };
    rarities.forEach(rarity => {
      const count = (this.inv.recycledDust && this.inv.recycledDust[rarity]) || 0;
      const elStorage = document.getElementById(`dust-${rarity}`);
      const elCraft = document.getElementById(`craft-dust-${rarity}`);
      if (elStorage) elStorage.textContent = `${icons[rarity]} ${count}`;
      if (elCraft) elCraft.textContent = `${icons[rarity]} ${count}`;
    });
  }

  updateEquipmentUI() {
    const slots = ['head', 'torso', 'legs', 'gloves', 'primary', 'secondary', 'melee'];
    slots.forEach(slotName => {
      let slotEl = document.getElementById(`eq-slot-${slotName}`);
      if (!slotEl) return;

      const equipped = this.inv.equipment[slotName];

      // Clone slot to reset all event listeners cleanly
      const newSlot = slotEl.cloneNode(true);
      slotEl.parentNode.replaceChild(newSlot, slotEl);
      slotEl = newSlot;

      if (equipped) {
        slotEl.classList.add('equipped');
        slotEl.style.background = equipped.color;
        slotEl.style.borderColor = equipped.borderColor;
        slotEl.innerHTML = `
          <div class="eq-icon">${equipped.icon}</div>
          <div class="eq-name">${equipped.name}</div>
        `;
        slotEl.style.cursor = 'grab';

        // Tooltip hover handlers for slot
        slotEl.addEventListener('mouseenter', (e) => this.showTooltip(e, equipped));
        slotEl.addEventListener('mousemove', (e) => this.updateTooltipPosition(e));
        slotEl.addEventListener('mouseleave', () => this.hideTooltip());

        // Listen for dragging out of the slot
        slotEl.addEventListener('mousedown', (e) => {
          this.hideTooltip();
          this.onEquippedSlotMouseDown(e, slotName, equipped);
        });
      } else {
        slotEl.classList.remove('equipped');
        slotEl.style.background = '';
        slotEl.style.borderColor = '';
        slotEl.style.cursor = '';
        const slotTitles = {
          head: 'HELMET',
          torso: 'ARMOR',
          legs: 'BOOTS',
          gloves: 'GLOVES',
          primary: 'PRIMARY',
          secondary: 'SECONDARY',
          melee: 'MELEE',
        };
        slotEl.innerHTML = `<span class="eq-placeholder">${slotTitles[slotName]}</span>`;
      }
    });
  }

  // Show detailed hover tooltip for an item
  showTooltip(e, item) {
    if (!this.tooltipEl) return;

    let rpmHtml = '';
    const bp = WEAPON_BLUEPRINTS[item.baseId];
    if (bp && bp.fireRate) {
      const rpm = Math.round(60 / bp.fireRate);
      rpmHtml = `<div class="tooltip-mod-line" style="color: #00f0ff; font-weight: 700;">⚡ Fire Rate: ${rpm} RPM</div>`;
    }

    let modsHtml = '';
    if ((item.modifiersList && item.modifiersList.length > 0) || rpmHtml) {
      const modLines = (item.modifiersList || []).map(mod => `<div class="tooltip-mod-line">${mod}</div>`).join('');
      modsHtml = `
        <div class="tooltip-mods-header">Stats & Modifiers:</div>
        <div class="tooltip-mods-list">
          ${rpmHtml}
          ${modLines}
        </div>
      `;
    }

    const rarityTitle = item.rarity ? item.rarity.toUpperCase() : 'NORMAL';
    const rarityColor = item.borderColor || '#64748b';

    this.tooltipEl.innerHTML = `
      <div class="tooltip-title" style="color: ${rarityColor};">${item.name}</div>
      <div class="tooltip-rarity" style="color: ${rarityColor}; font-size: 10px; font-weight: 700; letter-spacing: 1.5px;">${rarityTitle} GEAR</div>
      <div class="tooltip-desc">"${item.desc}"</div>
      ${modsHtml}
      <div class="tooltip-size">Grid Size: ${item.width} x ${item.height}</div>
    `;

    this.tooltipEl.classList.remove('hidden');
    this.updateTooltipPosition(e);
  }

  updateTooltipPosition(e) {
    if (!this.tooltipEl) return;
    this.tooltipEl.style.left = `${e.clientX + 12}px`;
    this.tooltipEl.style.top = `${e.clientY + 12}px`;
  }

  hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.classList.add('hidden');
    }
  }

  initDragListeners() {
    document.addEventListener('mousemove', (e) => {
      if (this.draggedItem && this.dragGhostEl) {
        this.dragGhostEl.style.left = `${e.clientX - this.dragOffset.x}px`;
        this.dragGhostEl.style.top = `${e.clientY - this.dragOffset.y}px`;
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (this.draggedItem) {
        this.onItemMouseUp(e);
      }
    });
  }

  onItemMouseDown(e, item) {
    e.stopPropagation();
    if (e.button !== 0) return; // Left click only

    this.setUpgradeTarget(item);

    this.draggedItem = item;
    this.isDraggingFromEquipped = false;
    this.draggedFromSlot = null;

    this.createDragGhost(e, item);

    // Dim the original item element
    e.currentTarget.style.opacity = '0.3';
  }

  onEquippedSlotMouseDown(e, slotName, item) {
    e.stopPropagation();
    if (e.button !== 0) return; // Left click only

    this.setUpgradeTarget(item);

    this.draggedItem = item;
    this.isDraggingFromEquipped = true;
    this.draggedFromSlot = slotName;

    this.createDragGhost(e, item);

    // Dim the equipped slot element
    e.currentTarget.style.opacity = '0.3';
  }

  createDragGhost(e, item) {
    this.dragGhostEl = document.createElement('div');
    this.dragGhostEl.className = 'inv-item-ghost';
    this.dragGhostEl.style.width = `${item.width * 50 - 4}px`;
    this.dragGhostEl.style.height = `${item.height * 50 - 4}px`;
    this.dragGhostEl.style.background = item.color;
    this.dragGhostEl.style.borderColor = item.borderColor;
    this.dragGhostEl.innerHTML = `
      <div class="inv-item-icon">${item.icon}</div>
      <div class="inv-item-name">${item.name}</div>
    `;

    const rect = e.currentTarget.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;

    this.dragGhostEl.style.left = `${e.clientX - this.dragOffset.x}px`;
    this.dragGhostEl.style.top = `${e.clientY - this.dragOffset.y}px`;

    document.body.appendChild(this.dragGhostEl);
  }

  onItemMouseUp(e) {
    if (!this.draggedItem) return;

    let dropHandled = false;

    // 1. Check if released over an equipment slot
    const slots = ['head', 'torso', 'legs', 'gloves', 'primary', 'secondary', 'melee'];
    for (const slotName of slots) {
      const slotEl = document.getElementById(`eq-slot-${slotName}`);
      if (!slotEl) continue;

      const rect = slotEl.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        // Landed on slot! Let's check type compatibility
        if (this.checkSlotTypeMatch(this.draggedItem, slotName)) {
          // If we drag from another slot, unequip that slot first
          if (this.isDraggingFromEquipped) {
            this.inv.unequipItem(this.draggedFromSlot);
          } else {
            // Dragged from grid: remove it from grid
            this.inv.removeItem(this.draggedItem);
          }

          // If there is already an item in the target slot, unequip it and add to grid
          const alreadyEquipped = this.inv.equipment[slotName];
          if (alreadyEquipped) {
            this.inv.unequipItem(slotName);
            const space = this.inv.findEmptySpace(alreadyEquipped);
            if (space) {
              this.inv.addItem(alreadyEquipped, space.row, space.col);
            } else {
              // Inventory is full, drop it on the ground near player
              if (window.gameInstance) {
                window.gameInstance.spawnGroundItemNearPlayer(alreadyEquipped);
              }
            }
          }

          this.inv.equipItem(slotName, this.draggedItem);
          dropHandled = true;
          this.applyEquipmentStats();
          break;
        }
      }
    }

    // 2. Check if released over the inventory storage grid
    if (!dropHandled && this.gridContainerEl) {
      const gridRect = this.gridContainerEl.getBoundingClientRect();
      if (
        e.clientX >= gridRect.left &&
        e.clientX <= gridRect.right &&
        e.clientY >= gridRect.top &&
        e.clientY <= gridRect.bottom
      ) {
        const relativeX = e.clientX - gridRect.left - this.dragOffset.x + 25;
        const relativeY = e.clientY - gridRect.top - this.dragOffset.y + 25;

        const targetCol = Math.max(0, Math.min(this.inv.cols - this.draggedItem.width, Math.floor(relativeX / 50)));
        const targetRow = Math.max(0, Math.min(this.inv.rows - this.draggedItem.height, Math.floor(relativeY / 50)));

        if (this.isDraggingFromEquipped) {
          // Try to place from equipped slot into grid
          if (this.inv.canPlaceItem(this.draggedItem, targetRow, targetCol)) {
            this.inv.unequipItem(this.draggedFromSlot);
            this.inv.addItem(this.draggedItem, targetRow, targetCol);
            dropHandled = true;
            this.applyEquipmentStats();
          }
        }
      }
    }

    // 3. Check if released over the Crafting Bench Upgrade Slot (#craft-upgrade-slot)
    const upgradeSlotEl = document.getElementById('craft-upgrade-slot');
    if (!dropHandled && upgradeSlotEl) {
      const uRect = upgradeSlotEl.getBoundingClientRect();
      if (
        e.clientX >= uRect.left &&
        e.clientX <= uRect.right &&
        e.clientY >= uRect.top &&
        e.clientY <= uRect.bottom
      ) {
        dropHandled = true;
        this.setUpgradeTarget(this.draggedItem);
        sound.playReload();
      }
    }

    // Clean up drag ghost
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }

    this.draggedItem = null;
    this.isDraggingFromEquipped = false;
    this.draggedFromSlot = null;

    this.renderItems();
  }

  checkSlotTypeMatch(item, slotName) {
    if (slotName === 'head' && item.type === 'head') return true;
    if (slotName === 'torso' && item.type === 'torso') return true;
    if (slotName === 'legs' && item.type === 'legs') return true;
    if (slotName === 'gloves' && item.type === 'gloves') return true;
    if (slotName === 'primary' && item.type === 'primary') return true;
    if (slotName === 'secondary' && item.type === 'primary') return true; // Rifle can go in secondary slot
    if (slotName === 'melee' && item.type === 'melee') return true;
    return false;
  }

  applyEquipmentStats() {
    if (!this.player || !this.weapon || !this.melee) return;

    // Determine active weapon slot
    const activeSlot = (window.gameInstance ? window.gameInstance.activeWeaponSlot : null) || 'primary';
    const primaryItem = this.inv.equipment[activeSlot];
    const glovesItem = this.inv.equipment.gloves;
    const meleeItem = this.inv.equipment.melee;

    // 1. Armor & Max HP Modifiers
    let maxHpBonus = 0;
    let damageReduction = 0;
    let speedMultiplier = 1.0;
    let jumpMultiplier = 1.0;
    let meleeDmgBonus = 0.0;

    const slots = ['head', 'torso', 'legs', 'gloves', 'primary', 'secondary', 'melee'];
    slots.forEach(s => {
      const item = this.inv.equipment[s];
      if (item && item.modifiers) {
        if (item.modifiers.maxHp) maxHpBonus += item.modifiers.maxHp;
        if (item.modifiers.damageReduction) damageReduction += item.modifiers.damageReduction;
        if (item.modifiers.moveSpeed) speedMultiplier += item.modifiers.moveSpeed;
        if (item.modifiers.jumpForce) jumpMultiplier += item.modifiers.jumpForce;
        if (item.modifiers.meleeDamage) meleeDmgBonus += item.modifiers.meleeDamage;
      }
    });

    // Update Player physics factors
    const oldMaxHp = this.player.maxHp;
    this.player.maxHp = 100 + maxHpBonus;
    this.player.damageReduction = damageReduction;
    this.player.speedMultiplier = speedMultiplier;
    this.player.jumpMultiplier = jumpMultiplier;

    // Adjust current health relative to new Max HP
    if (this.player.maxHp > oldMaxHp) {
      this.player.hp += (this.player.maxHp - oldMaxHp);
    }
    this.player.hp = Math.min(this.player.maxHp, this.player.hp);

    // 2. Gloves & Active Weapon Firing Modifiers
    if (primaryItem) {
      this.weapon.setWeaponType(primaryItem.baseId);
      this.weapon.damageMultiplier = 1.0 + (primaryItem.modifiers.weaponDamage || 0.0);
      
      let gunFireRateMod = primaryItem.modifiers.fireRate || 0.0;
      if (glovesItem && glovesItem.modifiers && glovesItem.modifiers.fireRate) {
        gunFireRateMod += glovesItem.modifiers.fireRate;
      }
      this.weapon.fireRateMultiplier = 1.0 - gunFireRateMod;

      const baseCap = WEAPON_BLUEPRINTS[primaryItem.baseId]?.magazineCapacity || 30;
      this.weapon.magazineCapacity = baseCap + (primaryItem.modifiers.magazineCapacity || 0);

      // Restore ammo state from item or initialize
      if (primaryItem.currentAmmo === undefined) {
        primaryItem.currentAmmo = this.weapon.magazineCapacity;
      }
      this.weapon.currentAmmo = Math.min(primaryItem.currentAmmo, this.weapon.magazineCapacity);
    } else {
      this.weapon.setWeaponType(null); // Stow weapon
      this.weapon.damageMultiplier = 1.0;
      
      const glovesFireRate = glovesItem && glovesItem.modifiers ? (glovesItem.modifiers.fireRate || 0) : 0;
      this.weapon.fireRateMultiplier = 1.0 - glovesFireRate;
      this.weapon.magazineCapacity = 0;
      this.weapon.currentAmmo = 0;
    }

    // Gloves Reload Speed
    if (glovesItem && glovesItem.modifiers && glovesItem.modifiers.reloadSpeed) {
      this.weapon.reloadDuration = 1.2 * (1 - glovesItem.modifiers.reloadSpeed);
    } else {
      this.weapon.reloadDuration = 1.2;
    }

    // 3. Melee Damage Multiplier
    if (meleeItem && meleeItem.modifiers) {
      const itemMeleeMod = meleeItem.modifiers.meleeDamage || 0.0;
      this.melee.damageMultiplier = 1.0 + meleeDmgBonus + itemMeleeMod;
    } else {
      this.melee.damageMultiplier = 1.0 + meleeDmgBonus;
    }

    // 4. Weapon Slot Visibilities
    if (primaryItem) {
      this.weapon.setWeaponType(primaryItem.baseId);
    } else {
      this.weapon.setWeaponType(null);
    }
  }

  close() {
    if (this.containerEl) {
      this.containerEl.classList.add('hidden');
      this.isOpen = false;
      this.hideTooltip();
      if (this.controls) {
        this.controls.lastInventoryCloseTime = Date.now();
      }
    }
  }

  toggle(targetTab = null) {
    if (!this.containerEl) return;

    if (this.containerEl.classList.contains('hidden')) {
      // Open inventory
      this.containerEl.classList.remove('hidden');
      this.isOpen = true;
      this.switchTab(targetTab || 'storage');
      this.controls.isLocked = false;
      this.controls.mouseDelta.x = 0;
      this.controls.mouseDelta.y = 0;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.renderItems();
    } else {
      // Already open: switch tab if different target specified, otherwise close
      if (targetTab && this.activeTab !== targetTab) {
        this.switchTab(targetTab);
      } else {
        this.close();
      }
    }
  }

  initTabListeners() {
    const btnStorage = document.getElementById('inv-nav-btn-storage');
    const btnCrafting = document.getElementById('inv-nav-btn-crafting');

    if (btnStorage) {
      btnStorage.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchTab('storage');
      });
    }

    if (btnCrafting) {
      btnCrafting.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchTab('crafting');
      });
    }

    const catButtons = document.querySelectorAll('#craft-cat-filters .craft-cat-btn');
    catButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        catButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedCraftCategory = btn.dataset.cat || 'all';
        this.renderCraftableGrid();
      });
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    const btnStorage = document.getElementById('inv-nav-btn-storage');
    const btnCrafting = document.getElementById('inv-nav-btn-crafting');
    const viewStorage = document.getElementById('inv-view-storage');
    const viewCrafting = document.getElementById('inv-view-crafting');

    if (tabName === 'crafting') {
      if (btnStorage) btnStorage.classList.remove('active');
      if (btnCrafting) btnCrafting.classList.add('active');
      if (viewStorage) viewStorage.classList.add('hidden');
      if (viewCrafting) viewCrafting.classList.remove('hidden');
      this.renderCraftableGrid();
    } else {
      if (btnStorage) btnStorage.classList.add('active');
      if (btnCrafting) btnCrafting.classList.remove('active');
      if (viewStorage) viewStorage.classList.remove('hidden');
      if (viewCrafting) viewCrafting.classList.add('hidden');
    }
  }

  renderCraftableGrid() {
    const gridEl = document.getElementById('craftable-items-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    const blueprints = [
      { id: 'weapon_ar15', name: 'Combat Rifle', type: 'weapon', icon: '🔫', cost: '15+ Normal Dust' },
      { id: 'weapon_pistol', name: 'P-57 Pistol', type: 'weapon', icon: '🔫', cost: '15+ Normal Dust' },
      { id: 'weapon_sniper', name: 'A-20 Sniper', type: 'weapon', icon: '🔭', cost: '15+ Normal Dust' },
      { id: 'weapon_shotgun', name: 'S-12 Shotgun', type: 'weapon', icon: '💥', cost: '15+ Normal Dust' },
      { id: 'weapon_knife', name: 'Combat Knife', type: 'weapon', icon: '🗡️', cost: '15+ Normal Dust' },
      { id: 'item_helmet', name: 'Tactical Helmet', type: 'helmet', icon: '🪖', cost: '15+ Normal Dust' },
      { id: 'item_vest', name: 'Combat Vest', type: 'vest', icon: '🦺', cost: '15+ Normal Dust' },
      { id: 'item_gloves', name: 'Tactical Gloves', type: 'gloves', icon: '🧤', cost: '15+ Normal Dust' },
      { id: 'item_recipe', name: 'Legendary Recipe', type: 'recipe', icon: '📜', cost: 'Upgrade Slot Craft' },
    ];

    const category = this.selectedCraftCategory;
    const filtered = blueprints.filter(b => category === 'all' || b.type === category);

    filtered.forEach(bp => {
      const card = document.createElement('div');
      card.className = `craft-card ${bp.id === this.selectedCraftBaseId ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="craft-card-icon">${bp.icon}</div>
        <div class="craft-card-name">${bp.name}</div>
        <div class="craft-card-cost">${bp.cost}</div>
      `;

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCraftBaseId = bp.id;
        const titleEl = document.getElementById('craft-selected-title');
        if (titleEl) titleEl.textContent = `${bp.icon} ${bp.name.toUpperCase()}`;
        this.renderCraftableGrid();
      });

      gridEl.appendChild(card);
    });
  }

  autoEquipItem(item) {
    let slotName = item.type;
    if (slotName === 'primary') {
      const activeSlot = (window.gameInstance ? window.gameInstance.activeWeaponSlot : null) || 'primary';
      if (this.inv.equipment.primary !== null && this.inv.equipment.secondary === null) {
        slotName = 'secondary';
      } else {
        slotName = activeSlot;
      }
    }
    if (!this.inv.equipment.hasOwnProperty(slotName)) return;

    const alreadyEquipped = this.inv.equipment[slotName];

    // Remove the item from grid
    this.inv.removeItem(item);

    // Swap slots if something was already equipped
    if (alreadyEquipped) {
      this.inv.equipment[slotName] = null;
      const foundSpot = this.inv.findEmptySpace(alreadyEquipped);
      if (foundSpot) {
        this.inv.addItem(alreadyEquipped, foundSpot.row, foundSpot.col);
      } else {
        // Revert since there was no space for old item
        this.inv.addItem(item, item.row, item.col);
        this.inv.equipment[slotName] = alreadyEquipped;
        
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.addKillFeed("⚠️ NO STORAGE SPACE TO SWAP ITEM!");
        }
        return;
      }
    }

    // Equip item
    this.inv.equipment[slotName] = item;

    // Trigger updates
    sound.playReload();
    this.applyEquipmentStats();
    this.renderItems();
  }

  recycleItem(item) {
    if (item.isLocked) {
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.addKillFeed("⚠️ ITEM IS LOCKED!");
      }
      return;
    }

    const itemRarity = (item.rarity || 'normal').toLowerCase();
    if (typeof this.inv.recycledDust[itemRarity] !== 'number') {
      this.inv.recycledDust[itemRarity] = 0;
    }

    const rolledDust = Math.floor(Math.random() * 4) + 5; // 5-8 dust
    this.inv.recycledDust[itemRarity] += rolledDust;

    this.inv.removeItem(item);
    sound.playImpact(); // break down sound

    if (window.gameInstance && window.gameInstance.ui) {
      window.gameInstance.ui.addKillFeed(`♻️ Recycled ${item.name} for ${rolledDust} ${itemRarity.toUpperCase()} DUST`);
    }

    this.renderItems();
  }

  getEquipmentSlotForItem(item) {
    if (!item) return null;
    const type = item.type;
    const baseId = item.baseId || '';
    if (type === 'weapon' || baseId.startsWith('weapon_')) {
      if (baseId.includes('melee') || baseId.includes('sword') || baseId.includes('axe') || baseId.includes('blade')) {
        return 'melee';
      }
      return 'primary';
    }
    if (type === 'helmet' || baseId.includes('helmet')) return 'head';
    if (type === 'vest' || type === 'torso' || baseId.includes('vest')) return 'torso';
    if (type === 'gloves' || baseId.includes('gloves')) return 'gloves';
    if (type === 'boots' || type === 'legs' || baseId.includes('boots')) return 'legs';
    return null;
  }

  learnRecipe(recipeItem) {
    if (!recipeItem || recipeItem.type !== 'recipe') return;
    const targetBaseId = recipeItem.recipeTargetBaseId || 'weapon_ar15';
    if (!this.player.learnedRecipes) {
      this.player.learnedRecipes = [];
    }
    if (!this.player.learnedRecipes.includes(targetBaseId)) {
      this.player.learnedRecipes.push(targetBaseId);
    }
    this.inv.removeItem(recipeItem);
    sound.playReload();

    try {
      localStorage.setItem('god_caliber_learned_recipes', JSON.stringify(this.player.learnedRecipes));
    } catch (e) {}

    if (window.gameInstance && window.gameInstance.ui) {
      window.gameInstance.ui.addKillFeed(`📜 LEARNED RECIPE: ${recipeItem.name}!`);
    }
    this.renderItems();
    this.renderCraftableGrid();
  }

  toggleItemLock(item) {
    item.isLocked = !item.isLocked;
    sound.playReload();
    if (window.gameInstance && window.gameInstance.ui) {
      const lockStatus = item.isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED";
      window.gameInstance.ui.addKillFeed(`${lockStatus} ${item.name}`);
    }
    if (this.upgradeTargetItem === item) {
      this.updateUpgradeUI();
    }
    this.renderItems();
  }

  recycleAll() {
    let recycledCount = 0;

    // Loop backwards since we are removing items from the array
    for (let i = this.inv.items.length - 1; i >= 0; i--) {
      const item = this.inv.items[i];
      if (!item.isLocked) {
        const itemRarity = (item.rarity || 'normal').toLowerCase();
        if (typeof this.inv.recycledDust[itemRarity] !== 'number') {
          this.inv.recycledDust[itemRarity] = 0;
        }
        const rolledDust = Math.floor(Math.random() * 4) + 5;
        this.inv.recycledDust[itemRarity] += rolledDust;
        this.inv.removeItem(item);
        recycledCount++;
      }
    }

    if (recycledCount > 0) {
      sound.playImpact();
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.addKillFeed(`♻️ Recycled ${recycledCount} items!`);
      }
      this.renderItems();
    } else {
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.addKillFeed("⚠️ No unlocked items to recycle!");
      }
    }
  }

  initCraftingListeners() {
    const btnForge = document.getElementById('craft-forge-btn');
    const btnUpgrade = document.getElementById('craft-upgrade-btn');
    const slotUpgrade = document.getElementById('craft-upgrade-slot');

    if (btnForge) {
      btnForge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.craftForgeItem();
      });
    }

    if (btnUpgrade) {
      btnUpgrade.addEventListener('click', (e) => {
        e.stopPropagation();
        this.craftOrUpgrade();
      });
    }

    if (slotUpgrade) {
      slotUpgrade.addEventListener('click', (e) => {
        e.stopPropagation();
        this.upgradeTargetItem = null;
        this.updateUpgradeUI();
      });
    }
  }

  setUpgradeTarget(item) {
    this.upgradeTargetItem = item;
    this.updateUpgradeUI();
  }

  updateUpgradeUI() {
    const slotEl = document.getElementById('craft-upgrade-slot');
    const infoEl = document.getElementById('craft-upgrade-info');
    const nameEl = document.getElementById('upgrade-item-display-name');
    const costEl = document.getElementById('upgrade-cost-label');
    const btnEl = document.getElementById('craft-upgrade-btn');

    if (!slotEl) return;

    if (this.upgradeTargetItem) {
      const item = this.upgradeTargetItem;
      slotEl.classList.add('has-item');
      slotEl.innerHTML = `<div class="upgrade-item-preview">${item.icon}</div>`;
      
      if (infoEl) infoEl.classList.remove('hidden');
      if (nameEl) {
        nameEl.textContent = item.name;
        nameEl.style.color = item.borderColor;
      }
      
      if (item.type === 'recipe') {
        const costStr = "Cost: 40 Legendary 🟠, 25 Epic 🟣";
        if (costEl) costEl.textContent = costStr;
        if (btnEl) {
          btnEl.textContent = "CRAFT LEGENDARY";
          btnEl.disabled = false;
        }
      } else {
        const rarity = item.rarity;
        if (rarity === 'normal') {
          if (costEl) costEl.textContent = "Cost: 20 Normal ⚪";
          if (btnEl) {
            btnEl.textContent = "UPGRADE TO MAGIC";
            btnEl.disabled = false;
          }
        } else if (rarity === 'magic') {
          if (costEl) costEl.textContent = "Cost: 20 Magic 🔵";
          if (btnEl) {
            btnEl.textContent = "UPGRADE TO RARE";
            btnEl.disabled = false;
          }
        } else if (rarity === 'rare') {
          if (costEl) costEl.textContent = "Cost: 25 Rare 🟡";
          if (btnEl) {
            btnEl.textContent = "UPGRADE TO EPIC";
            btnEl.disabled = false;
          }
        } else {
          if (costEl) costEl.textContent = "Max upgrade reached (Legendary requires recipes)";
          if (btnEl) {
            btnEl.textContent = "MAX UPGRADE";
            btnEl.disabled = true;
          }
        }
      }
    } else {
      slotEl.classList.remove('has-item');
      slotEl.innerHTML = `<span class="upgrade-placeholder-text">CLICK GRID ITEM/RECIPE TO PLACE</span>`;
      if (infoEl) infoEl.classList.add('hidden');
    }
  }

  craftForgeItem() {
    const baseId = this.selectedCraftBaseId || 'weapon_ar15';
    const selectRarity = document.getElementById('craft-rarity-select');
    const targetRarity = selectRarity ? selectRarity.value : 'normal';
    const dust = this.inv.recycledDust;
    let canAfford = true;
    let costText = "";

    if (targetRarity === 'normal') {
      if (dust.normal < 15) canAfford = false;
      costText = "15 Normal Dust";
    } else if (targetRarity === 'magic') {
      if (dust.normal < 25) canAfford = false;
      costText = "25 Normal Dust";
    } else if (targetRarity === 'rare') {
      if (dust.magic < 15 || dust.normal < 10) canAfford = false;
      costText = "15 Magic, 10 Normal Dust";
    } else if (targetRarity === 'epic') {
      if (dust.rare < 20 || dust.magic < 10) canAfford = false;
      costText = "20 Rare, 10 Magic Dust";
    } else {
      return;
    }

    if (!canAfford) {
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.addKillFeed(`⚠️ CANNOT AFFORD: Requires ${costText}!`);
      }
      return;
    }

    const newItem = this.inv.generateRandomItem(baseId, targetRarity);
    const spot = this.inv.findEmptySpace(newItem);
    if (!spot) {
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.addKillFeed("⚠️ NO STORAGE SPACE FOR FORGED ITEM!");
      }
      return;
    }

    if (targetRarity === 'normal') {
      dust.normal -= 15;
    } else if (targetRarity === 'magic') {
      dust.normal -= 25;
    } else if (targetRarity === 'rare') {
      dust.magic -= 15;
      dust.normal -= 10;
    } else if (targetRarity === 'epic') {
      dust.rare -= 20;
      dust.magic -= 10;
    }

    this.inv.addItem(newItem, spot.row, spot.col);
    sound.playReload();
    if (window.gameInstance && window.gameInstance.ui) {
      window.gameInstance.ui.addKillFeed(`🔨 FORGED ${newItem.name}!`);
    }
    this.renderItems();
  }

  craftOrUpgrade() {
    if (!this.upgradeTargetItem) return;

    const item = this.upgradeTargetItem;
    const dust = this.inv.recycledDust;

    if (item.type === 'recipe') {
      if (dust.epic < 30 || dust.legendary < 20) {
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.addKillFeed("⚠️ NOT ENOUGH DUST TO CRAFT LEGENDARY!");
        }
        return;
      }

      this.inv.removeItem(item);
      const targetBaseId = item.recipeTargetBaseId;
      const newItem = this.inv.generateRandomItem(targetBaseId, 'legendary');
      const spot = this.inv.findEmptySpace(newItem);

      if (!spot) {
        // Revert recipe back
        const recipeSpot = this.inv.findEmptySpace(item);
        if (recipeSpot) {
          this.inv.addItem(item, recipeSpot.row, recipeSpot.col);
        } else {
          this.inv.items.push(item);
        }
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.addKillFeed("⚠️ NO STORAGE SPACE FOR LEGENDARY ITEM!");
        }
        return;
      }

      dust.epic -= 30;
      dust.legendary -= 20;
      this.inv.addItem(newItem, spot.row, spot.col);
      this.upgradeTargetItem = null;
      sound.playReload();

      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.addKillFeed(`🔨 CRAFTED SPECIAL LEGENDARY: ${newItem.name}!`);
      }
      this.renderItems();
    } else {
      let nextRarity = '';
      let requiredRarityDust = '';
      let cost = 0;

      if (item.rarity === 'normal') {
        nextRarity = 'magic';
        requiredRarityDust = 'normal';
        cost = 20;
      } else if (item.rarity === 'magic') {
        nextRarity = 'rare';
        requiredRarityDust = 'magic';
        cost = 20;
      } else if (item.rarity === 'rare') {
        nextRarity = 'epic';
        requiredRarityDust = 'rare';
        cost = 25;
      } else {
        return;
      }

      if (dust[requiredRarityDust] < cost) {
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.addKillFeed(`⚠️ NOT ENOUGH ${requiredRarityDust.toUpperCase()} DUST!`);
        }
        return;
      }

      dust[requiredRarityDust] -= cost;

      const upgradedTemp = this.inv.generateRandomItem(item.baseId, nextRarity);
      const oldName = item.name;
      item.name = upgradedTemp.name;
      item.color = upgradedTemp.color;
      item.borderColor = upgradedTemp.borderColor;
      item.rarity = upgradedTemp.rarity;
      item.modifiers = upgradedTemp.modifiers;
      item.modifiersList = upgradedTemp.modifiersList;

      this.applyEquipmentStats();
      sound.playReload();

      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.addKillFeed(`⚡ UPGRADED ${oldName} TO ${item.name}!`);
      }

      this.updateUpgradeUI();
      this.renderItems();
    }
  }
}
