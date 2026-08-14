import * as THREE from 'three';
import { sound } from './audio.js';
import { formatDiscordInvite, copyLobbyLink } from './multiplayer/NetworkManager.js';
import { MinimapManager } from './minimap.js';

const _tempV = new THREE.Vector3();

export class UIManager {
  constructor(controls) {
    this.controls = controls;

    // Minimap Manager
    this.minimapContainerEl = document.getElementById('minimap-container');
    this.minimap = new MinimapManager('minimap-canvas');

    this.lastRivalUpdate = performance.now();

    // DOM Elements
    this.hpValueEl = document.getElementById('hp-value');
    this.hpFillEl = document.getElementById('health-bar-fill');
    
    this.ammoCurrentEl = document.getElementById('ammo-current');
    this.staminaFillEl = document.getElementById('stamina-bar-fill');
    this.staminaTextEl = document.getElementById('stamina-text');

    this.centerNoticeEl = document.getElementById('center-notice');
    this.noticeTextEl = document.getElementById('notice-text');

    this.hitmarkerEl = document.getElementById('hitmarker');
    this.killFeedEl = document.getElementById('kill-feed');

    // Options Sliders & Fullscreen
    this.sfxSlider = document.getElementById('sfx-slider');
    this.sfxValText = document.getElementById('sfx-val');
    this.bgmSlider = document.getElementById('bgm-slider');
    this.bgmValText = document.getElementById('bgm-val');
    this.sensSlider = document.getElementById('sens-slider');
    this.sensValText = document.getElementById('sens-val');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');
    this.startBtn = document.getElementById('start-btn');

    // Rebind Table
    this.rebindTableEl = document.getElementById('rebind-table');
    this.rebindNoticeEl = document.getElementById('rebind-notice');

    // Profile & Multiplayer Elements
    this.playerNameInput = document.getElementById('player-name-input');
    this.lobbyPinInput = document.getElementById('lobby-pin-input');
    this.lobbyStatusText = document.getElementById('lobby-status-text');
    this.hostLobbyBtn = document.getElementById('host-lobby-btn');
    this.copyLinkBtn = document.getElementById('copy-link-btn');
    this.discordShareBtn = document.getElementById('discord-share-btn');
    this.roomCodeInput = document.getElementById('room-code-input');
    this.joinLobbyBtn = document.getElementById('join-lobby-btn');
    this.connectedPlayersList = document.getElementById('connected-players-list');
    this.sprintModeSelect = document.getElementById('sprint-mode-select');

    this.crosshairStyleSelect = document.getElementById('crosshair-style-select');
    this.crosshairColorPicker = document.getElementById('crosshair-color-picker');
    this.crosshairSizeSlider = document.getElementById('crosshair-size-slider');
    this.crosshairSizeVal = document.getElementById('crosshair-size-val');
    this.crosshairThicknessSlider = document.getElementById('crosshair-thickness-slider');
    this.crosshairThicknessVal = document.getElementById('crosshair-thickness-val');
    this.crosshairGapSlider = document.getElementById('crosshair-gap-slider');
    this.crosshairGapVal = document.getElementById('crosshair-gap-val');
    this.crosshairOpacitySlider = document.getElementById('crosshair-opacity-slider');
    this.crosshairOpacityVal = document.getElementById('crosshair-opacity-val');
    this.crosshairPreviewCanvas = document.getElementById('crosshair-preview-canvas');

    // Dynamic HUD Crosshair Overlay Canvas
    this.hudCrosshairCanvas = document.createElement('canvas');
    this.hudCrosshairCanvas.id = 'hud-crosshair-canvas';
    this.hudCrosshairCanvas.width = 160;
    this.hudCrosshairCanvas.height = 160;
    this.hudCrosshairCanvas.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:90;';
    document.body.appendChild(this.hudCrosshairCanvas);

    // DOM State Cache
    this._cachedHp = -1;
    this._cachedAmmo = -1;
    this._cachedPostureState = '';
    this._cachedReloadingState = null;

    this.hitmarkerTimeout = null;

    this.initAudioUnlock();
    this.initTabs();
    this.initOptions();
    this.initRebindTable();
    this.initExitButton();
    this.initResultOverlays();
  }

  initAudioUnlock() {
    // Explicit user gesture handler to unlock AudioContext in modern browsers
    const unlockAudio = () => {
      sound.init();
    };

    if (this.startBtn) {
      this.startBtn.addEventListener('click', unlockAudio);
    }
    document.addEventListener('click', unlockAudio, { once: false });
  }

  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = btn.getAttribute('data-tab');

        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });

        const activeContent = document.getElementById(tabId);
        if (activeContent) activeContent.classList.add('active');
      });
    });
  }

  initOptions() {
    if (this.sfxSlider) {
      this.sfxSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.sfxValText) this.sfxValText.textContent = `${val}%`;
        sound.setSFXVolume(val / 100);
      });
    }

    if (this.bgmSlider) {
      this.bgmSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.bgmValText) this.bgmValText.textContent = `${val}%`;
        sound.setBGMVolume(val / 100);
      });
    }

    if (this.sensSlider) {
      this.sensSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const sensScalar = (val / 50);
        if (this.sensValText) this.sensValText.textContent = `${sensScalar.toFixed(1)}x`;
        this.controls.sensitivity = 0.0022 * sensScalar;
      });
    }

    // Windowed Fullscreen Toggle
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.warn(`Fullscreen error: ${err.message}`);
          });
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
      });
    }

    // Player Profile & Multiplayer Wiring
    if (this.playerNameInput && this.controls) {
      this.playerNameInput.value = this.controls.playerName || 'Player_1';
      this.playerNameInput.addEventListener('input', (e) => {
        this.controls.playerName = e.target.value;
        this.controls.saveBindings();
      });
    }

    if (this.hostLobbyBtn) {
      this.hostLobbyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.gameInstance || !window.gameInstance.network) return;
        const net = window.gameInstance.network;

        if (!net.isHost) {
          const pin = this.lobbyPinInput ? this.lobbyPinInput.value : '';
          const code = net.hostLobby(pin);
          this.hostLobbyBtn.textContent = 'STOP HOSTING';
          this.hostLobbyBtn.style.background = 'rgba(255, 68, 68, 0.2)';
          this.hostLobbyBtn.style.borderColor = '#ff4444';
          this.hostLobbyBtn.style.color = '#ff4444';

          if (this.lobbyStatusText) {
            this.lobbyStatusText.textContent = `Lobby Active: ${code} (Host)`;
            this.lobbyStatusText.style.color = '#00ffcc';
          }
          if (this.copyLinkBtn) this.copyLinkBtn.classList.remove('hidden');
          if (this.discordShareBtn) this.discordShareBtn.classList.remove('hidden');
          this.renderConnectedPlayers();
        } else {
          net.stopHosting();
          this.resetLobbyUI();
        }
      });
    }

    if (this.copyLinkBtn) {
      this.copyLinkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.gameInstance && window.gameInstance.network && window.gameInstance.network.roomId) {
          const code = window.gameInstance.network.roomId;
          const res = await copyLobbyLink(code);
          if (res.success) {
            this.copyLinkBtn.textContent = res.isLocalhost ? 'LINK & TUNNEL NOTE COPIED! ✔' : 'LINK COPIED! ✔';
            setTimeout(() => {
              this.copyLinkBtn.textContent = 'COPY INVITE LINK 📋';
            }, 2500);
          } else {
            alert(`Share this Join URL:\n${res.messageText || res.url}`);
          }
        }
      });
    }

    if (this.discordShareBtn) {
      this.discordShareBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.gameInstance && window.gameInstance.network && window.gameInstance.network.roomId) {
          const code = window.gameInstance.network.roomId;
          const hostName = (this.controls && this.controls.playerName) ? this.controls.playerName : 'Player_1';
          const pin = this.lobbyPinInput ? this.lobbyPinInput.value : '';
          const url = `${window.location.origin}${window.location.pathname}?lobby=${encodeURIComponent(code)}`;
          const pinText = pin ? ` (PIN: \`${pin}\`)` : '';
          const cardText = `🎮 **Join my God-Caliber match!**\nHost: **${hostName}** | Lobby Code: \`${code}\`${pinText}\n👉 Click to join: ${url}`;
          try {
            await navigator.clipboard.writeText(cardText);
            this.discordShareBtn.textContent = 'CARD COPIED! 🎮';
            setTimeout(() => {
              this.discordShareBtn.textContent = 'SHARE TO DISCORD 🎮';
            }, 2500);
          } catch (err) {
            alert(`Discord Invite Card:\n\n${cardText}`);
          }
        }
      });
    }

    if (this.roomCodeInput) {
      this.roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    }

    if (this.joinLobbyBtn) {
      this.joinLobbyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = this.roomCodeInput ? this.roomCodeInput.value : '';
        const pin = this.lobbyPinInput ? this.lobbyPinInput.value : '';
        if (!code) {
          alert('Please enter a valid 6-character Room Code (e.g. GC-8842)');
          return;
        }
        if (window.gameInstance && window.gameInstance.network) {
          window.gameInstance.network.joinLobby(code, pin);
          // Show connecting state — actual 'connected' state comes from connection-state event
          if (this.lobbyStatusText) {
            this.lobbyStatusText.textContent = `⏳ Connecting to: ${code.toUpperCase()}...`;
            this.lobbyStatusText.style.color = '#ffb703';
          }
        }
      });
    }

    if (this.sprintModeSelect && this.controls) {
      this.sprintModeSelect.value = this.controls.sprintMode || 'hold';
      this.sprintModeSelect.addEventListener('change', (e) => {
        this.controls.sprintMode = e.target.value;
        this.controls.saveBindings();
      });
    }

    // Crosshair Editor Listeners
    this.initCrosshairEditor();
  }

  initCrosshairEditor() {
    if (!this.controls) return;
    const cfg = this.controls.crosshairConfig;

    if (this.crosshairStyleSelect) {
      this.crosshairStyleSelect.value = cfg.style || 'cross_dot';
      this.crosshairStyleSelect.addEventListener('change', (e) => {
        cfg.style = e.target.value;
        this.controls.saveBindings();
        this.renderCrosshairPreview();
      });
    }
    if (this.crosshairColorPicker) {
      this.crosshairColorPicker.value = cfg.color || '#00ffaa';
      this.crosshairColorPicker.addEventListener('input', (e) => {
        cfg.color = e.target.value;
        this.controls.saveBindings();
        this.renderCrosshairPreview();
      });
    }
    if (this.crosshairSizeSlider) {
      this.crosshairSizeSlider.value = cfg.size || 8;
      this.crosshairSizeSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        cfg.size = v;
        if (this.crosshairSizeVal) this.crosshairSizeVal.textContent = `${v}px`;
        this.controls.saveBindings();
        this.renderCrosshairPreview();
      });
    }
    if (this.crosshairThicknessSlider) {
      this.crosshairThicknessSlider.value = cfg.thickness || 2;
      this.crosshairThicknessSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        cfg.thickness = v;
        if (this.crosshairThicknessVal) this.crosshairThicknessVal.textContent = `${v}px`;
        this.controls.saveBindings();
        this.renderCrosshairPreview();
      });
    }
    if (this.crosshairGapSlider) {
      this.crosshairGapSlider.value = cfg.gap || 4;
      this.crosshairGapSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        cfg.gap = v;
        if (this.crosshairGapVal) this.crosshairGapVal.textContent = `${v}px`;
        this.controls.saveBindings();
        this.renderCrosshairPreview();
      });
    }
    if (this.crosshairOpacitySlider) {
      this.crosshairOpacitySlider.value = Math.round((cfg.opacity || 0.9) * 100);
      this.crosshairOpacitySlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        cfg.opacity = v / 100;
        if (this.crosshairOpacityVal) this.crosshairOpacityVal.textContent = `${v}%`;
        this.controls.saveBindings();
        this.renderCrosshairPreview();
      });
    }

    this.renderCrosshairPreview();
  }

  renderCrosshairPreview() {
    if (!this.crosshairPreviewCanvas || !this.controls) return;
    const ctx = this.crosshairPreviewCanvas.getContext('2d');
    this.drawCrosshair(ctx, this.controls.crosshairConfig, 160, 160, false);
  }

  resetLobbyUI() {
    if (this.hostLobbyBtn) {
      this.hostLobbyBtn.textContent = 'HOST LOBBY';
      this.hostLobbyBtn.style.background = '';
      this.hostLobbyBtn.style.borderColor = '';
      this.hostLobbyBtn.style.color = '';
    }
    if (this.copyLinkBtn) {
      this.copyLinkBtn.classList.add('hidden');
      this.copyLinkBtn.textContent = 'COPY INVITE LINK 📋';
    }
    if (this.discordShareBtn) {
      this.discordShareBtn.classList.add('hidden');
      this.discordShareBtn.textContent = 'SHARE TO DISCORD 🎮';
    }
    if (this.lobbyStatusText) {
      this.lobbyStatusText.textContent = 'Singleplayer (Local Dev Server)';
      this.lobbyStatusText.style.color = '#00ffcc';
    }
    if (this.connectedPlayersList) {
      this.connectedPlayersList.innerHTML = '<div style="color: #94a3b8; font-style: italic;">No peers connected yet</div>';
    }
  }

  /** Update lobby status UI based on NetworkManager connection state (0.3.4) */
  updateConnectionState(state, detail = '') {
    if (!this.lobbyStatusText) return;

    switch (state) {
      case 'connecting':
        this.lobbyStatusText.textContent = '⏳ Connecting...';
        this.lobbyStatusText.style.color = '#ffb703';
        break;
      case 'connected': {
        const net = window.gameInstance?.network;
        const roomId = net?.roomId || '';
        const role = net?.isHost ? '(Host)' : '(Client)';
        this.lobbyStatusText.textContent = `✅ Connected: ${roomId} ${role}`;
        this.lobbyStatusText.style.color = '#00ffcc';
        this.renderConnectedPlayers();
        break;
      }
      case 'retrying':
        this.lobbyStatusText.textContent = `🔄 Retrying... ${detail}`;
        this.lobbyStatusText.style.color = '#ff8800';
        break;
      case 'failed':
        this.lobbyStatusText.textContent = `❌ Connection Failed${detail ? ': ' + detail : ''}`;
        this.lobbyStatusText.style.color = '#ff2a6d';
        break;
      case 'disconnected':
        this.lobbyStatusText.textContent = `⚠️ Disconnected${detail ? ': ' + detail : ''}`;
        this.lobbyStatusText.style.color = '#ff2a6d';
        break;
      case 'idle':
        this.lobbyStatusText.textContent = 'Singleplayer (Local Dev Server)';
        this.lobbyStatusText.style.color = '#00ffcc';
        break;
    }
  }

  renderConnectedPlayers() {
    if (!this.connectedPlayersList) return;
    this.connectedPlayersList.innerHTML = '';

    const net = (window.gameInstance && window.gameInstance.network) ? window.gameInstance.network : null;
    const localName = (this.controls && this.controls.playerName) ? this.controls.playerName : 'Player_1';
    const isHost = net ? net.isHost : false;
    const roleTag = isHost ? '(You / Host)' : '(You)';
    const icon = isHost ? '👑' : '👤';

    const hostRow = document.createElement('div');
    hostRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(0,255,204,0.1);border-radius:4px;';
    hostRow.innerHTML = `<span>${icon} ${localName} ${roleTag}</span><span style="color:#00ffcc;font-size:11px;">ACTIVE</span>`;
    this.connectedPlayersList.appendChild(hostRow);

    if (net && net.peerPlayers) {
      net.peerPlayers.forEach((peer, id) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(15,23,42,0.6);border-radius:4px;';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `👤 ${peer.displayName || id}`;
        
        row.appendChild(nameSpan);

        if (isHost) {
          const kickBtn = document.createElement('button');
          kickBtn.textContent = 'KICK';
          kickBtn.style.cssText = 'background:#ff2a6d;color:#fff;border:none;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold;';
          kickBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            net.kickPeer(id);
            this.renderConnectedPlayers();
          });
          row.appendChild(kickBtn);
        }

        this.connectedPlayersList.appendChild(row);
      });
    }
  }

  drawCrosshair(ctx, config, width, height, isADS = false) {
    ctx.clearRect(0, 0, width, height);
    if (isADS) return; // Auto-hide crosshair when ADS is active!

    const cx = width / 2;
    const cy = height / 2;
    const size = parseInt(config.size || 8, 10);
    const thickness = parseInt(config.thickness || 2, 10);
    const gap = parseInt(config.gap || 4, 10);
    const opacity = parseFloat(config.opacity || 0.9);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = config.color || '#00ffaa';
    ctx.fillStyle = config.color || '#00ffaa';
    ctx.lineWidth = thickness;

    const style = config.style || 'cross_dot';

    // Dot
    if (style === 'dot' || style === 'cross_dot') {
      ctx.beginPath();
      ctx.arc(cx, cy, thickness, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cross
    if (style === 'cross' || style === 'cross_dot') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - gap); ctx.lineTo(cx, cy - gap - size);
      ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + gap + size);
      ctx.moveTo(cx - gap, cy); ctx.lineTo(cx - gap - size, cy);
      ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + gap + size, cy);
      ctx.stroke();
    }

    // Circle
    if (style === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, gap + size, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  initRebindTable() {
    if (!this.rebindTableEl || !this.controls) return;
    this.renderRebindRows();

    this.controls.onRebindComplete = (action, newKey) => {
      if (this.rebindNoticeEl) this.rebindNoticeEl.classList.add('hidden');
      this.renderRebindRows();
    };
  }

  renderRebindRows() {
    if (!this.rebindTableEl || !this.controls) return;
    this.rebindTableEl.innerHTML = '';

    const actions = [
      { id: 'forward', label: 'Move Forward' },
      { id: 'backward', label: 'Move Backward' },
      { id: 'left', label: 'Strafe Left' },
      { id: 'right', label: 'Strafe Right' },
      { id: 'sprint', label: 'Sprint' },
      { id: 'crouch', label: 'Crouch / Slide' },
      { id: 'jump', label: 'Jump' },
      { id: 'reload', label: 'Reload Weapon' },
      { id: 'melee', label: 'Melee Attack (Knife)' },
      { id: 'inventory', label: 'Tactical Inventory' },
      { id: 'interact', label: 'Interact / Pick Up' },
      { id: 'drop', label: 'Drop Active Weapon' },
      { id: 'slot1', label: 'Equip Weapon Slot 1' },
      { id: 'slot2', label: 'Equip Weapon Slot 2' },
    ];

    actions.forEach(action => {
      const row = document.createElement('div');
      row.className = 'rebind-row';

      const label = document.createElement('span');
      label.className = 'rebind-label';
      label.textContent = action.label;

      const btn = document.createElement('button');
      btn.className = 'rebind-btn';
      btn.textContent = this.controls.bindings[action.id] || 'Unbound';

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.controls.rebindingAction = action.id;
        btn.textContent = 'PRESS KEY...';
        btn.classList.add('waiting');
        if (this.rebindNoticeEl) this.rebindNoticeEl.classList.remove('hidden');
      });

      row.appendChild(label);
      row.appendChild(btn);
      this.rebindTableEl.appendChild(row);
    });
  }

  initExitButton() {
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Exit God-Caliber and close tab?')) {
          window.close();
          document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#05070a;color:#00f0ff;font-family:Orbitron,sans-serif;font-size:24px;">
              GOD-CALIBER SESSION TERMINATED. YOU MAY CLOSE THIS TAB.
            </div>
          `;
        }
      });
    }
  }

  initResultOverlays() {
    const victoryOverlay = document.getElementById('victory-overlay');
    const defeatOverlay = document.getElementById('defeat-overlay');

    if (victoryOverlay) {
      victoryOverlay.addEventListener('click', (e) => {
        if (!e.target.closest('#play-again-btn')) {
          e.stopPropagation();
        }
      });
    }
    if (defeatOverlay) {
      defeatOverlay.addEventListener('click', (e) => {
        if (!e.target.closest('#play-again-defeat-btn')) {
          e.stopPropagation();
        }
      });
    }
  }

  updateHUD(player, weapon, inventory, circleManager, targets) {
    // 0. Minimap Render
    if (this.minimap) {
      const circle = circleManager || (window.gameInstance ? window.gameInstance.circle : null);
      const enemyTargets = targets || (window.gameInstance && window.gameInstance.targetManager ? window.gameInstance.targetManager.targets : []);
      this.minimap.render(player, circle, enemyTargets);
    }

    // 0. Dynamic Canvas Crosshair Update (Auto-hide when controls.isLocked is false; Red Dot Sight for Vortex Rifle in ADS; Auto-hide for other ADS/Scopes)
    if (this.hudCrosshairCanvas && this.controls) {
      const adsProgress = weapon ? (weapon.adsProgress ?? weapon.scopeProgress ?? 0) : 0;
      const isScoped = weapon ? weapon.isScoped : false;
      const weaponType = weapon ? weapon.currentWeaponType : null;
      const isVortexRifle = weaponType === 'weapon_ar15';

      if (!this.controls.isLocked) {
        this.hudCrosshairCanvas.style.display = 'none';
        this.hudCrosshairCanvas.style.opacity = '0';
      } else if (isVortexRifle && adsProgress > 0.05) {
        // Functional Tactical Red Dot Sight for Vortex Assault Rifle ADS
        this.hudCrosshairCanvas.style.display = 'block';
        this.hudCrosshairCanvas.style.opacity = '1';
        const ctx = this.hudCrosshairCanvas.getContext('2d');
        this.drawRedDotSight(ctx, 160, 160, adsProgress);
      } else if (isScoped || adsProgress > 0.5) {
        this.hudCrosshairCanvas.style.display = 'none';
        this.hudCrosshairCanvas.style.opacity = '0';
      } else {
        this.hudCrosshairCanvas.style.display = 'block';
        this.hudCrosshairCanvas.style.opacity = '1';
        const ctx = this.hudCrosshairCanvas.getContext('2d');
        this.drawCrosshair(ctx, this.controls.crosshairConfig, 160, 160, false);
      }
    }
    // 1. Health Bar (Cached update)
    const roundedHp = Math.max(0, Math.ceil(player.hp));
    if (roundedHp !== this._cachedHp) {
      this._cachedHp = roundedHp;
      if (this.hpValueEl) this.hpValueEl.textContent = roundedHp;
      if (this.hpFillEl) {
        const hpPct = Math.max(0, Math.min(100, (roundedHp / player.maxHp) * 100));
        this.hpFillEl.style.width = `${hpPct}%`;
        if (hpPct <= 25) {
          this.hpFillEl.style.background = 'linear-gradient(90deg, #ff2a6d 0%, #ff5252 100%)';
          this.hpFillEl.style.boxShadow = '0 0 12px #ff2a6d';
        } else if (hpPct <= 50) {
          this.hpFillEl.style.background = 'linear-gradient(90deg, #ffb703 0%, #ffe600 100%)';
          this.hpFillEl.style.boxShadow = '0 0 10px #ffb703';
        } else {
          this.hpFillEl.style.background = 'linear-gradient(90deg, #05ffa1 0%, #00f0ff 100%)';
          this.hpFillEl.style.boxShadow = '0 0 10px #05ffa1';
        }
      }
    }

    // 2. Ammo Count (Cached update)
    if (weapon.currentAmmo !== this._cachedAmmo) {
      this._cachedAmmo = weapon.currentAmmo;
      if (this.ammoCurrentEl) {
        this.ammoCurrentEl.textContent = weapon.currentAmmo;
        this.ammoCurrentEl.style.color = (weapon.currentAmmo === 0) ? '#ff2a6d' : '#ffffff';
      }
    }

    // 3. Reloading Center Notice (Cached update)
    let reloadState = 'hidden';
    if (weapon.isReloading) reloadState = 'reloading';
    else if (weapon.currentAmmo === 0) reloadState = 'empty';

    if (reloadState !== this._cachedReloadingState) {
      this._cachedReloadingState = reloadState;
      if (this.centerNoticeEl) {
        if (reloadState === 'reloading') {
          this.centerNoticeEl.classList.remove('hidden');
          if (this.noticeTextEl) this.noticeTextEl.textContent = 'RELOADING...';
        } else if (reloadState === 'empty') {
          this.centerNoticeEl.classList.remove('hidden');
          if (this.noticeTextEl) this.noticeTextEl.textContent = 'PRESS [R] TO RELOAD';
        } else {
          this.centerNoticeEl.classList.add('hidden');
        }
      }
    }

    // 4. Movement / Posture Status Bar (Unlimited Movement)
    let postureState = 'NORMAL';
    if (player.isSliding) postureState = 'SLIDING';
    else if (player.isCrouching) postureState = 'CROUCHED';
    else if (player.isSprinting) postureState = 'SPRINTING';

    if (postureState !== this._cachedPostureState) {
      this._cachedPostureState = postureState;

      if (this.staminaFillEl) {
        this.staminaFillEl.style.width = '100%';
        if (postureState === 'SLIDING') this.staminaFillEl.style.background = 'linear-gradient(90deg, #ffb703 0%, #ffe600 100%)';
        else if (postureState === 'CROUCHED') this.staminaFillEl.style.background = 'linear-gradient(90deg, #05ffa1 0%, #00f0ff 100%)';
        else if (postureState === 'SPRINTING') this.staminaFillEl.style.background = 'linear-gradient(90deg, #00f0ff 0%, #0077ff 100%)';
        else this.staminaFillEl.style.background = 'linear-gradient(90deg, #64748b 0%, #94a3b8 100%)';
      }

      if (this.staminaTextEl) {
        this.staminaTextEl.textContent = postureState;
        if (postureState === 'SLIDING') this.staminaTextEl.style.color = '#ffb703';
        else if (postureState === 'CROUCHED') this.staminaTextEl.style.color = '#05ffa1';
        else if (postureState === 'SPRINTING') this.staminaTextEl.style.color = '#00f0ff';
        else this.staminaTextEl.style.color = '#94a3b8';
      }
    }

    // Update ammo card weapon name dynamically
    const activeSlot = (window.gameInstance ? window.gameInstance.activeWeaponSlot : null) || 'primary';
    const activeItem = inventory ? inventory.equipment[activeSlot] : null;
    const weaponNameEl = document.querySelector('.ammo-card .weapon-name');
    if (weaponNameEl) {
      const slotTag = activeSlot === 'primary' ? '[SLOT 1]' : '[SLOT 2]';
      if (activeItem) {
        weaponNameEl.textContent = `${activeItem.name} ${slotTag}`;
      } else {
        weaponNameEl.textContent = `NO WEAPON ${slotTag}`;
      }
    }

    // 5. Weapon Preview Loadout Slots (Slot 1 active vs Slot 2 stowed)
    const slot1El = document.getElementById('slot-1-preview');
    const slot2El = document.getElementById('slot-2-preview');
    if (slot1El && slot2El && inventory) {
      const slot1Title = slot1El.querySelector('.slot-weapon-title');
      const slot2Title = slot2El.querySelector('.slot-weapon-title');
      
      if (slot1Title) {
        slot1Title.textContent = inventory.equipment.primary ? `🔫 ${inventory.equipment.primary.name}` : 'EMPTY';
      }
      if (slot2Title) {
        slot2Title.textContent = inventory.equipment.melee ? `🗡️ ${inventory.equipment.melee.name}` : 'EMPTY';
      }

      if (weapon.isMeleeActive) {
        slot1El.className = 'weapon-slot-item stowed';
        slot2El.className = 'weapon-slot-item active';
      } else {
        slot1El.className = 'weapon-slot-item ' + (inventory.equipment.primary ? 'active' : 'stowed');
        slot2El.className = 'weapon-slot-item ' + (inventory.equipment.primary ? 'stowed' : 'active');
      }
    }
  }

  triggerHitmarker() {
    if (!this.hitmarkerEl) return;
    this.hitmarkerEl.classList.remove('hidden');
    if (this.hitmarkerTimeout) clearTimeout(this.hitmarkerTimeout);
    this.hitmarkerTimeout = setTimeout(() => {
      this.hitmarkerEl.classList.add('hidden');
    }, 150);
  }

  addKillFeed(text) {
    if (!this.killFeedEl) return;

    const item = document.createElement('div');
    item.className = 'feed-item';
    item.textContent = text;
    this.killFeedEl.appendChild(item);

    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.5s ease';
      setTimeout(() => item.remove(), 500);
    }, 3500);
  }

  spawnDamageNumber(value, worldPos, isHeadshot = false) {
    const el = document.createElement('div');
    el.className = 'damage-number' + (isHeadshot ? ' headshot' : '');
    el.textContent = Math.round(value);

    document.getElementById('game-container').appendChild(el);

    if (!this.activeDamageNumbers) this.activeDamageNumbers = [];

    this.activeDamageNumbers.push({
      el: el,
      worldPos: worldPos.clone(),
      startTime: performance.now(),
      duration: 800,
    });
  }

  updateDamageNumbers(camera) {
    if (!this.activeDamageNumbers || this.activeDamageNumbers.length === 0) return;

    const now = performance.now();
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;

    for (let i = this.activeDamageNumbers.length - 1; i >= 0; i--) {
      const obj = this.activeDamageNumbers[i];
      const elapsed = now - obj.startTime;

      if (elapsed >= obj.duration) {
        obj.el.remove();
        this.activeDamageNumbers.splice(i, 1);
        continue;
      }

      const pct = elapsed / obj.duration;
      obj.el.style.opacity = 1 - pct;

      // Project 3D coordinates to 2D screen
      _tempV.copy(obj.worldPos);
      
      // Let the text float upwards slightly in 3D world space
      _tempV.y += pct * 0.4;
      
      _tempV.project(camera);

      // Hide if behind player camera
      if (_tempV.z > 1) {
        obj.el.style.display = 'none';
        continue;
      }

      obj.el.style.display = 'block';
      const x = (_tempV.x * widthHalf) + widthHalf;
      const y = -(_tempV.y * heightHalf) + heightHalf;

      obj.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    }
  }

  updateLeaderboardUI() {
    const body = document.getElementById('leaderboard-body');
    if (!body) return;

    const entries = [];
    const game = window.gameInstance;

    // 1. Add Local Player
    if (game && game.player) {
      const name = (this.controls && this.controls.playerName) ? this.controls.playerName : 'Player_1';
      const hp = Math.max(0, Math.ceil(game.player.hp || 0));
      const kills = game.playerKills || 0;
      const deaths = game.playerDeaths || 0;
      const ping = game.network?.diagnostics?.lastLatency || 0;
      entries.push({
        name: name,
        status: hp > 0 ? '<span style="color:#00f0ff;font-weight:bold;">ALIVE</span>' : '<span style="color:#ff2a6d;font-weight:bold;">DEAD</span>',
        kills: kills,
        deaths: deaths,
        kdr: deaths === 0 ? kills.toFixed(1) : (kills / deaths).toFixed(1),
        ping: ping > 0 ? `${ping}ms` : 'LOCAL',
        isLocalPlayer: true
      });
    }

    // 2. Add Active WebRTC Human Peers
    if (game && game.network && game.network.peerPlayers) {
      const ping = game.network.diagnostics?.lastLatency || 0;
      game.network.peerPlayers.forEach((peer, peerId) => {
        const hp = Math.max(0, Math.ceil(peer.hp || 0));
        const kills = peer.kills || 0;
        const deaths = peer.deaths || 0;
        entries.push({
          name: peer.displayName || 'Peer',
          status: hp > 0 ? '<span style="color:#00f0ff;font-weight:bold;">ALIVE</span>' : '<span style="color:#ff2a6d;font-weight:bold;">DEAD</span>',
          kills: kills,
          deaths: deaths,
          kdr: deaths === 0 ? kills.toFixed(1) : (kills / deaths).toFixed(1),
          ping: ping > 0 ? `${ping}ms` : '35ms',
          isLocalPlayer: false
        });
      });
    }

    // 3. Add Active Match AI Bots
    if (game && game.targetManager && game.targetManager.targets) {
      game.targetManager.targets.forEach(bot => {
        const status = bot.isDestroyed ? '<span style="color:#64748b;">ELIMINATED</span>' : '<span style="color:#ffb703;">BOT AI</span>';
        entries.push({
          name: bot.idName || 'Rival_Bot',
          status: status,
          kills: 0,
          deaths: bot.isDestroyed ? 1 : 0,
          kdr: '0.0',
          ping: 'BOT',
          isLocalPlayer: false
        });
      });
    }

    // Sort entries by Kills (descending), then by KDR (descending)
    entries.sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return parseFloat(b.kdr) - parseFloat(a.kdr);
    });

    let html = '';
    entries.forEach((entry, idx) => {
      const rank = idx + 1;
      const highlightClass = entry.isLocalPlayer ? 'class="leaderboard-row-highlight"' : '';

      html += `
        <tr ${highlightClass}>
          <td>#${rank}</td>
          <td>${entry.name} ${entry.isLocalPlayer ? '(YOU)' : ''}</td>
          <td>${entry.status}</td>
          <td>${entry.kills}</td>
          <td>${entry.deaths}</td>
          <td>${entry.kdr}</td>
          <td>${entry.ping}</td>
        </tr>
      `;
    });
    body.innerHTML = html;
  }

  updatePhaseHUD(gameState) {
    const titleEl = document.getElementById('wave-title');
    const waveTimerEl = document.getElementById('wave-timer');
    
    if (!gameState || !gameState.isMatchActive) {
      if (titleEl) titleEl.textContent = 'MATCH STANDBY';
      if (waveTimerEl) waveTimerEl.textContent = 'CLICK TO ENTER COMBAT ZONE';
      return;
    }
    
    const phaseNames = {
      LOOT_PHASE: '🔍 LOOTING PHASE',
      COMBAT_PHASE: '⚔️ COMBAT PHASE',
      FINAL_CIRCLE: '💀 FINAL CIRCLE',
    };
    
    const phaseText = phaseNames[gameState.phase] || 'BATTLE ROYALE';
    const mins = Math.floor(Math.max(0, gameState.phaseTimer) / 60);
    const secs = Math.floor(Math.max(0, gameState.phaseTimer) % 60);
    const timerText = `NEXT PHASE: ${mins}:${secs.toString().padStart(2, '0')}`;

    // Update main top-center HUD card
    if (titleEl) titleEl.textContent = phaseText;
    if (waveTimerEl) {
      if (gameState.isLootPhase) {
        waveTimerEl.textContent = `${timerText} • NO MOBS ACTIVE`;
      } else {
        const activeBotsCount = window.gameInstance?.targetManager 
          ? window.gameInstance.targetManager.targets.filter(b => !b.isDestroyed).length 
          : 0;
        waveTimerEl.textContent = `${timerText} • ${activeBotsCount}/${gameState.targetAICount} MOBS`;
      }
    }
  }

  showVictoryOverlay(stats) {
    if (this.minimapContainerEl) {
      this.minimapContainerEl.style.display = 'none';
    }
    if (this.hudCrosshairCanvas) {
      this.hudCrosshairCanvas.style.display = 'none';
      this.hudCrosshairCanvas.style.opacity = '0';
    }
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (e) {}
    }
    const overlay = document.getElementById('victory-overlay');
    const statsContainer = document.getElementById('victory-stats');
    if (!overlay || !statsContainer) return;

    const mins = Math.floor((stats.survivalTime || 0) / 60);
    const secs = Math.floor((stats.survivalTime || 0) % 60);
    const timeStr = `${mins}m ${secs}s`;

    statsContainer.innerHTML = `
      <div class="result-stat-row"><span>SURVIVAL TIME:</span><span>${timeStr}</span></div>
      <div class="result-stat-row"><span>KILLS:</span><span>${stats.kills || 0} (${stats.headshots || 0} Headshots)</span></div>
      <div class="result-stat-row"><span>DAMAGE DEALT:</span><span>${Math.round(stats.damageDealt || 0)}</span></div>
      <div class="result-stat-row"><span>ITEMS LOOTED:</span><span>${stats.itemsLooted || 0}</span></div>
      <div class="result-stat-row"><span>ITEMS CRAFTED:</span><span>${stats.itemsCrafted || 0}</span></div>
    `;

    overlay.classList.remove('hidden');
  }

  showDefeatOverlay(stats) {
    if (this.minimapContainerEl) {
      this.minimapContainerEl.style.display = 'none';
    }
    if (this.hudCrosshairCanvas) {
      this.hudCrosshairCanvas.style.display = 'none';
      this.hudCrosshairCanvas.style.opacity = '0';
    }
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (e) {}
    }
    const overlay = document.getElementById('defeat-overlay');
    const statsContainer = document.getElementById('defeat-stats');
    if (!overlay || !statsContainer) return;

    const mins = Math.floor((stats.survivalTime || 0) / 60);
    const secs = Math.floor((stats.survivalTime || 0) % 60);
    const timeStr = `${mins}m ${secs}s`;

    statsContainer.innerHTML = `
      <div class="result-stat-row"><span>SURVIVAL TIME:</span><span>${timeStr}</span></div>
      <div class="result-stat-row"><span>KILLS:</span><span>${stats.kills || 0} (${stats.headshots || 0} Headshots)</span></div>
      <div class="result-stat-row"><span>DAMAGE DEALT:</span><span>${Math.round(stats.damageDealt || 0)}</span></div>
      <div class="result-stat-row"><span>ITEMS LOOTED:</span><span>${stats.itemsLooted || 0}</span></div>
      <div class="result-stat-row"><span>RESPAWNS USED:</span><span>${stats.respawnTokensUsed || 0}</span></div>
    `;

    overlay.classList.remove('hidden');
  }

  hideResultOverlays() {
    if (this.minimapContainerEl) {
      this.minimapContainerEl.style.display = 'block';
    }
    const victoryOverlay = document.getElementById('victory-overlay');
    const defeatOverlay = document.getElementById('defeat-overlay');
    if (victoryOverlay) victoryOverlay.classList.add('hidden');
    if (defeatOverlay) defeatOverlay.classList.add('hidden');
  }
}
