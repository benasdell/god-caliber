// Keyboard, Mouse Look, and Key Rebinding Control Manager

export class Controls {
  constructor(domElement, blockerElement) {
    this.domElement = domElement;
    this.blocker = blockerElement;
    
    this.isLocked = false;
    this.sensitivity = 0.0022;

    // Configurable Keybindings with defaults
    this.defaultBindings = {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      sprint: 'ShiftLeft',
      crouch: 'ControlLeft',
      jump: 'Space',
      reload: 'KeyR',
      melee: 'KeyX',
      inventory: 'KeyI',
      interact: 'KeyE',
      drop: 'KeyQ',
      slot1: 'Digit1',
      slot2: 'Digit2',
      crafting: 'KeyC',
    };

    this.sprintMode = 'hold'; // 'hold' | 'toggle'
    this.playerName = 'Player_1';
    this.crosshairConfig = {
      style: 'cross_dot',
      color: '#00ffaa',
      size: 8,
      thickness: 2,
      gap: 4,
      opacity: 0.9
    };

    this.bindings = { ...this.defaultBindings };
    this.loadBindings();

    this.keyState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      crouch: false,
      jump: false,
      reload: false,
      melee: false,
      inventory: false,
      interact: false,
      drop: false,
      slot1: false,
      slot2: false,
      crafting: false,
      escape: false,
      tab: false,
    };

    this.lastInventoryCloseTime = 0;
    this.mouseDelta = { x: 0, y: 0 };
    this.mouseDown = false;
    this.shootRequested = false;
    this.sprintToggled = false;

    // Rebinding mode tracking
    this.rebindingAction = null;

    this.initListeners();
  }

  loadBindings() {
    try {
      const saved = localStorage.getItem('cyberstrike_keybindings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const VALID_CODE_REGEX = /^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|Tab|Escape|Enter|Arrow[A-Za-z]+)$/;
          for (const key of Object.keys(parsed)) {
            if (this.defaultBindings.hasOwnProperty(key) && typeof parsed[key] === 'string' && VALID_CODE_REGEX.test(parsed[key])) {
              this.bindings[key] = parsed[key];
            }
          }
        }
      }
      const profileSaved = localStorage.getItem('cyberstrike_player_profile');
      if (profileSaved) {
        const parsed = JSON.parse(profileSaved);
        if (parsed.sprintMode && (parsed.sprintMode === 'hold' || parsed.sprintMode === 'toggle')) this.sprintMode = parsed.sprintMode;
        if (parsed.playerName && typeof parsed.playerName === 'string') this.playerName = parsed.playerName.replace(/<[^>]*>/g, '').trim().substring(0, 16);
        if (parsed.crosshairConfig && typeof parsed.crosshairConfig === 'object') this.crosshairConfig = { ...this.crosshairConfig, ...parsed.crosshairConfig };
      }
    } catch (e) {
      console.warn('Could not load profile from localStorage', e);
    }
  }

  saveBindings() {
    try {
      localStorage.setItem('cyberstrike_keybindings', JSON.stringify(this.bindings));
      const profile = {
        sprintMode: this.sprintMode,
        playerName: this.playerName,
        crosshairConfig: this.crosshairConfig
      };
      localStorage.setItem('cyberstrike_player_profile', JSON.stringify(profile));
    } catch (e) {
      console.warn('Could not save profile to localStorage', e);
    }
  }

  rebindAction(actionName, newKeyCode) {
    if (!this.bindings.hasOwnProperty(actionName)) return false;
    this.bindings[actionName] = newKeyCode;
    this.saveBindings();
    return true;
  }

  initListeners() {
    // Direct listener on start button for 100% reliable game entry
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.domElement.requestPointerLock();
      });
    }

    // Block right-click context menu in-game
    document.addEventListener('contextmenu', (event) => {
      if (this.isLocked) {
        event.preventDefault();
      }
    });

    // Track right mouse down state for zoom/scope
    this.rightMouseDown = false;

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.domElement) {
        this.isLocked = true;
        this.blocker.classList.add('hidden');
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
        
        // Auto-close inventory if pointer lock is re-acquired (e.g. by clicking back into game canvas)
        const inventoryOverlay = document.getElementById('inventory-overlay');
        if (inventoryOverlay && !inventoryOverlay.classList.contains('hidden')) {
          inventoryOverlay.classList.add('hidden');
        }
      } else {
        this.isLocked = false;
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
        
        // Only show blocker if inventory, victory, or defeat overlay is NOT currently open AND was NOT closed within last 400ms
        const inventoryOverlay = document.getElementById('inventory-overlay');
        const victoryOverlay = document.getElementById('victory-overlay');
        const defeatOverlay = document.getElementById('defeat-overlay');
        const isInventoryOpen = inventoryOverlay && !inventoryOverlay.classList.contains('hidden');
        const isVictoryOpen = victoryOverlay && !victoryOverlay.classList.contains('hidden');
        const isDefeatOpen = defeatOverlay && !defeatOverlay.classList.contains('hidden');
        const timeSinceInvClose = Date.now() - this.lastInventoryCloseTime;

        if (!isInventoryOpen && !isVictoryOpen && !isDefeatOpen && timeSinceInvClose > 400) {
          this.blocker.classList.remove('hidden');
        } else {
          this.blocker.classList.add('hidden');
        }
      }
    });

    // Mouse movement (Clamp raw pointer lock event anomalies to preserve 1:1 flick precision)
    document.addEventListener('mousemove', (event) => {
      if (!this.isLocked) return;
      const clampX = Math.max(-200, Math.min(200, event.movementX || 0));
      const clampY = Math.max(-200, Math.min(200, event.movementY || 0));
      this.mouseDelta.x += clampX;
      this.mouseDelta.y += clampY;
    });

    // Mouse click
    document.addEventListener('mousedown', (event) => {
      if (!this.isLocked) return;
      if (event.button === 0) { // Left click
        this.mouseDown = true;
        this.shootRequested = true;
      } else if (event.button === 2) { // Right click
        this.rightMouseDown = true;
      }
    });

    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        this.mouseDown = false;
      } else if (event.button === 2) {
        this.rightMouseDown = false;
      }
    });

    // Keyboard keydown / keyup
    document.addEventListener('keydown', (event) => {
      const timeSinceInvClose = Date.now() - this.lastInventoryCloseTime;

      if (event.code === 'Escape') {
        const inventoryOverlay = document.getElementById('inventory-overlay');
        const isInventoryOpen = inventoryOverlay && !inventoryOverlay.classList.contains('hidden');

        if (isInventoryOpen) {
          event.preventDefault();
          event.stopPropagation();
          this.lastInventoryCloseTime = Date.now();
          if (window.gameInstance && window.gameInstance.inventoryUI) {
            window.gameInstance.inventoryUI.close();
          }
          if (this.blocker) this.blocker.classList.add('hidden');
          setTimeout(() => {
            if (window.gameInstance && !window.gameInstance.inventoryUI.isOpen && !document.pointerLockElement) {
              window.gameInstance.requestPointerLockSafe();
            }
          }, 80);
          return;
        }

        if (!this.isLocked) {
          // If in Pause Menu, ESC unpauses and returns to gameplay
          event.preventDefault();
          if (this.blocker) this.blocker.classList.add('hidden');
          try {
            const p = this.domElement.requestPointerLock();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {}
          return;
        }
      }

      if (event.code === 'Tab') {
        event.preventDefault();
        this.keyState.tab = true;
        return;
      }

      if (this.rebindingAction) {
        // Intercept keypress for rebinding
        event.preventDefault();
        const newKey = event.code;
        if (newKey !== 'Escape') {
          this.rebindAction(this.rebindingAction, newKey);
        }
        const action = this.rebindingAction;
        this.rebindingAction = null;
        if (this.onRebindComplete) this.onRebindComplete(action, newKey);
        return;
      }

      if (!this.isLocked) {
        // Allow inventory, crafting, escape, and tab keys even when pointer is not locked
        if (
          event.code === this.bindings.inventory ||
          event.code === this.bindings.crafting ||
          event.code === 'Escape' ||
          event.code === 'Tab'
        ) {
          this.updateKeyState(event.code, true);
        }
        return;
      }
      this.updateKeyState(event.code, true);
    });

    document.addEventListener('keyup', (event) => {
      if (event.code === 'Tab') {
        event.preventDefault();
        this.keyState.tab = false;
        return;
      }
      this.updateKeyState(event.code, false);
    });
  }

  updateKeyState(code, isPressed) {
    if (code === 'Escape') this.keyState.escape = isPressed;

    // Match code against bound keys
    if (code === this.bindings.forward || code === 'ArrowUp') this.keyState.forward = isPressed;
    if (code === this.bindings.backward || code === 'ArrowDown') this.keyState.backward = isPressed;
    if (code === this.bindings.left || code === 'ArrowLeft') this.keyState.left = isPressed;
    if (code === this.bindings.right || code === 'ArrowRight') this.keyState.right = isPressed;
    
    if (code === this.bindings.sprint || code === 'ShiftRight') {
      if (this.sprintMode === 'toggle') {
        if (isPressed) {
          this.sprintToggled = !this.sprintToggled;
        }
        this.keyState.sprint = this.sprintToggled;
      } else {
        this.keyState.sprint = isPressed; // Hold to Sprint
      }
    }
    if (code === this.bindings.crouch || code === 'ControlRight') this.keyState.crouch = isPressed;
    if (code === this.bindings.jump) this.keyState.jump = isPressed;
    if (code === this.bindings.reload) this.keyState.reload = isPressed;
    if (code === this.bindings.melee) this.keyState.melee = isPressed;
    if (code === this.bindings.inventory) this.keyState.inventory = isPressed;
    if (code === this.bindings.interact) this.keyState.interact = isPressed;
    if (code === this.bindings.drop) this.keyState.drop = isPressed;
    if (code === this.bindings.slot1 || code === 'Digit1') this.keyState.slot1 = isPressed;
    if (code === this.bindings.slot2 || code === 'Digit2') this.keyState.slot2 = isPressed;
    if (code === this.bindings.crafting) this.keyState.crafting = isPressed;
  }

  getMouseDelta() {
    return { x: this.mouseDelta.x, y: this.mouseDelta.y };
  }

  resetMouseDelta() {
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }

  getAndResetMouseDelta() {
    // Clamp accumulated per-frame mouse movement to max 120px to eliminate sudden rapid camera jarring/flicking
    const clampX = Math.max(-120, Math.min(120, this.mouseDelta.x));
    const clampY = Math.max(-120, Math.min(120, this.mouseDelta.y));
    const delta = { x: clampX, y: clampY };
    this.resetMouseDelta();
    return delta;
  }
}
