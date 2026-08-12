// Inventory Data Model, Rarity Tiers & Modifier Pools Management

export const RARITIES = {
  normal: { name: 'NORMAL', color: '#64748b', numMods: 0 },
  magic: { name: 'MAGIC', color: '#00f0ff', numMods: 1 },
  rare: { name: 'RARE', color: '#ffe600', numMods: 2 },
  epic: { name: 'EPIC', color: '#d946ef', numMods: 4 },
  legendary: { name: 'LEGENDARY', color: '#f97316', numMods: 6 }
};

export const MODIFIER_POOL = {
  head: [
    { key: 'maxHp', label: 'Max HP', min: 10, max: 30, unit: ' HP' },
    { key: 'moveSpeed', label: 'Movement Speed', min: 0.05, max: 0.15, percent: true, unit: '%' },
    { key: 'jumpForce', label: 'Jump Height', min: 0.05, max: 0.15, percent: true, unit: '%' }
  ],
  torso: [
    { key: 'maxHp', label: 'Max HP', min: 25, max: 65, unit: ' HP' },
    { key: 'damageReduction', label: 'Damage Reduction', min: 0.05, max: 0.25, percent: true, unit: '%' },
    { key: 'moveSpeed', label: 'Movement Speed', min: -0.05, max: 0.10, percent: true, unit: '%' }
  ],
  legs: [
    { key: 'moveSpeed', label: 'Movement Speed', min: 0.10, max: 0.25, percent: true, unit: '%' },
    { key: 'jumpForce', label: 'Jump Height', min: 0.10, max: 0.25, percent: true, unit: '%' },
    { key: 'crouchSpeed', label: 'Crouch Movement Speed', min: 0.10, max: 0.20, percent: true, unit: '%' }
  ],
  gloves: [
    { key: 'reloadSpeed', label: 'Reload Speed', min: 0.10, max: 0.35, percent: true, unit: '%' },
    { key: 'fireRate', label: 'Fire Rate Modifier', min: 0.10, max: 0.25, percent: true, unit: '%' },
    { key: 'meleeDamage', label: 'Melee Damage', min: 0.10, max: 0.35, percent: true, unit: '%' }
  ],
  primary: [
    { key: 'weaponDamage', label: 'Weapon Damage', min: 0.10, max: 0.40, percent: true, unit: '%' },
    { key: 'fireRate', label: 'Fire Rate Modifier', min: 0.10, max: 0.30, percent: true, unit: '%' },
    { key: 'magazineCapacity', label: 'Magazine Size', min: 10, max: 30, unit: ' rounds' }
  ],
  melee: [
    { key: 'meleeDamage', label: 'Melee Damage Modifier', min: 0.15, max: 0.50, percent: true, unit: '%' },
    { key: 'moveSpeed', label: 'Movement Speed', min: 0.05, max: 0.15, percent: true, unit: '%' }
  ]
};

export const SPECIAL_LEGENDARIES = {
  weapon_ar15: "VORTEX ASSAULT RIFLE",
  weapon_pistol: "APEX HANDCANNON",
  weapon_sniper: "VOID STALKER",
  weapon_shotgun: "REAPER SWEEP",
  weapon_knife: "NEON SHARD",
  item_helmet: "APOLLO NEURAL HELMET",
  item_vest: "TITAN AEGIS VEST",
  item_gloves: "CYPHER GRIP GLOVES"
};

export const ITEM_TEMPLATES = {
  item_helmet: { name: 'TACTICAL HELMET', type: 'head', width: 2, height: 2, icon: '🪖', desc: 'Protective headgear.' },
  item_vest: { name: 'COMBAT VEST', type: 'torso', width: 2, height: 3, icon: '🦺', desc: 'Ballistic plate armor.' },
  item_gloves: { name: 'TACTICAL GLOVES', type: 'gloves', width: 2, height: 2, icon: '🧤', desc: 'Combat-ready handwear.' },
  weapon_ar15: { name: 'COMBAT RIFLE', type: 'primary', width: 3, height: 2, icon: '🔫', desc: 'Standard issue modular rifle.' },
  weapon_pistol: { name: 'P-57 PISTOL', type: 'primary', width: 2, height: 2, icon: '🔫', desc: 'Futuristic tactical sidearm.' },
  weapon_sniper: { name: 'A-20 SNIPER RIFLE', type: 'primary', width: 4, height: 2, icon: '🔭', desc: 'High-caliber bolt-action sniper.' },
  weapon_shotgun: { name: 'S-12 SHOTGUN', type: 'primary', width: 3, height: 2, icon: '💥', desc: 'Close-quarters spread shotgun.' },
  weapon_knife: { name: 'COMBAT KNIFE', type: 'melee', width: 2, height: 1, icon: '🗡️', desc: 'High-grade tactical steel.' },
  item_recipe: { name: 'LEGENDARY RECIPE', type: 'recipe', width: 2, height: 2, icon: '📜', desc: 'A rare blueprint for crafting a legendary item.' },
  item_respawn_token: { name: 'RESPAWN TOKEN', type: 'consumable', width: 1, height: 1, icon: '📿', desc: 'Grants one extra life. On death, respawn inside the circle at 50% HP.' }
};

export class InventoryManager {
  constructor(rows = 5, cols = 12) {
    this.rows = rows;
    this.cols = cols;
    
    // Grid representation: 2D array [row][col] storing item reference or null
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    
    // List of all items currently in inventory
    this.items = [];

    // Recycled dust crafting resources
    this.recycledDust = {
      normal: 0,
      magic: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };

    // Equipment slots
    this.equipment = {
      head: null,
      torso: null,
      legs: null,
      gloves: null,
      primary: null,   // P-57 Pistol
      secondary: null,
      melee: null,     // Combat Knife
    };

    this.initDefaultItems();
  }

  initDefaultItems() {
    // Generate default equipped primary & melee weapons as NORMAL (no modifiers)
    const pistol = this.generateRandomItem('weapon_pistol', 'normal');
    const knife = this.generateRandomItem('weapon_knife', 'normal');

    this.equipment.primary = pistol;
    this.equipment.melee = knife;
  }

  hasRespawnToken() {
    return this.items.some(item => item.baseId === 'item_respawn_token');
  }

  consumeRespawnToken() {
    const token = this.items.find(item => item.baseId === 'item_respawn_token');
    if (token) {
      this.removeItem(token);
      return true;
    }
    return false;
  }

  // Generates randomized items with tiered modifier statistics
  generateRandomItem(baseId, rarityName) {
    const uniqueId = `${baseId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (baseId === 'item_recipe') {
      const bases = ['item_helmet', 'item_vest', 'item_gloves', 'weapon_ar15', 'weapon_pistol', 'weapon_sniper', 'weapon_shotgun', 'weapon_knife'];
      const targetBase = bases[Math.floor(Math.random() * bases.length)];
      return {
        id: uniqueId,
        baseId: baseId,
        name: `RECIPE: ${SPECIAL_LEGENDARIES[targetBase] || ITEM_TEMPLATES[targetBase].name}`,
        type: 'recipe',
        width: 2,
        height: 2,
        color: `linear-gradient(135deg, #131a26 0%, #f9731615 100%)`,
        borderColor: '#f97316',
        rarity: 'legendary',
        icon: '📜',
        desc: `Place on Crafting Bench with dust to forge this unique Legendary.`,
        modifiers: {},
        modifiersList: [],
        recipeTargetBaseId: targetBase
      };
    }

    const template = ITEM_TEMPLATES[baseId];
    if (!template) return null;

    const rarity = RARITIES[rarityName] || RARITIES.normal;
    const itemType = template.type;
    const modPool = MODIFIER_POOL[itemType] || [];

    const modifiers = {};
    const selectedModsList = [];

    // Shuffle and choose distinct modifiers up to numMods
    const shuffledMods = [...modPool].sort(() => 0.5 - Math.random());
    const modsToApply = shuffledMods.slice(0, Math.min(rarity.numMods, shuffledMods.length));

    modsToApply.forEach(mod => {
      let rolledVal = Math.random() * (mod.max - mod.min) + mod.min;
      if (!mod.percent) {
        rolledVal = Math.round(rolledVal);
      } else {
        rolledVal = Math.round(rolledVal * 100) / 100;
      }
      modifiers[mod.key] = rolledVal;

      const valStr = mod.percent ? `+${Math.round(rolledVal * 100)}%` : `+${rolledVal}`;
      selectedModsList.push(`${valStr}${mod.unit} ${mod.label}`);
    });

    let name = template.name;
    if (rarityName === 'legendary' && SPECIAL_LEGENDARIES[baseId]) {
      name = SPECIAL_LEGENDARIES[baseId];
    } else if (rarityName !== 'normal') {
      const suffixes = ['of Swiftness', 'of the Gladiator', 'of Force', 'of Power', 'of Aegis', 'of Precision'];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      name = `${rarity.name} ${template.name} ${suffix}`;
    }

    return {
      id: uniqueId,
      baseId: baseId,
      name: name,
      type: template.type,
      width: template.width,
      height: template.height,
      color: `linear-gradient(135deg, #131a26 0%, ${rarity.color}25 100%)`,
      borderColor: rarity.color,
      rarity: rarityName,
      icon: template.icon,
      desc: template.desc,
      modifiers: modifiers,
      modifiersList: selectedModsList
    };
  }

  // Find first empty space in grid that can fit item
  findEmptySpace(item) {
    for (let r = 0; r <= this.rows - item.height; r++) {
      for (let c = 0; c <= this.cols - item.width; c++) {
        if (this.canPlaceItem(item, r, c)) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  canPlaceItem(item, targetRow, targetCol, ignoreItem = null) {
    if (targetRow < 0 || targetCol < 0) return false;
    if (targetRow + item.height > this.rows) return false;
    if (targetCol + item.width > this.cols) return false;

    for (let r = targetRow; r < targetRow + item.height; r++) {
      for (let c = targetCol; c < targetCol + item.width; c++) {
        const occupant = this.grid[r][c];
        if (occupant !== null && occupant !== ignoreItem) {
          return false;
        }
      }
    }
    return true;
  }

  addItem(item, row, col) {
    if (!this.canPlaceItem(item, row, col)) return false;

    item.row = row;
    item.col = col;
    if (!this.items.includes(item)) {
      this.items.push(item);
    }

    for (let r = row; r < row + item.height; r++) {
      for (let c = col; c < col + item.width; c++) {
        this.grid[r][c] = item;
      }
    }
    return true;
  }

  removeItem(item) {
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === item) {
          this.grid[r][c] = null;
        }
      }
    }
  }

  moveItem(item, targetRow, targetCol) {
    this.removeItem(item);

    if (this.canPlaceItem(item, targetRow, targetCol)) {
      this.addItem(item, targetRow, targetCol);
      return true;
    } else {
      this.addItem(item, item.row, item.col);
      return false;
    }
  }

  equipItem(slotName, item) {
    if (this.equipment.hasOwnProperty(slotName)) {
      this.equipment[slotName] = item;
      return true;
    }
    return false;
  }

  unequipItem(slotName) {
    if (this.equipment.hasOwnProperty(slotName)) {
      const item = this.equipment[slotName];
      this.equipment[slotName] = null;
      return item;
    }
    return null;
  }
}
