// Procedural Web Audio API Sound System with Volume Controls & BGM

class SoundFX {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;

    this.sfxVolume = 0.8;
    this.bgmVolume = 0.4;

    this.bgmOsc1 = null;
    this.bgmOsc2 = null;
    this.bgmLfo = null;
    this.isBGMPlaying = false;

    this.crackBuffer = null;
    this.tailBuffer = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        
        // Master Gain Node
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.ctx.destination);

        // SFX Gain Node
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxVolume;
        this.sfxGain.connect(this.masterGain);

        // BGM Gain Node
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this.bgmVolume;
        this.bgmGain.connect(this.masterGain);

        // Pre-generate static gunshot noise buffers for zero-allocation playback
        const crackBufSize = Math.floor(this.ctx.sampleRate * 0.06);
        this.crackBuffer = this.ctx.createBuffer(1, crackBufSize, this.ctx.sampleRate);
        const crackData = this.crackBuffer.getChannelData(0);
        for (let i = 0; i < crackBufSize; i++) crackData[i] = Math.random() * 2 - 1;

        const tailBufSize = Math.floor(this.ctx.sampleRate * 0.1);
        this.tailBuffer = this.ctx.createBuffer(1, tailBufSize, this.ctx.sampleRate);
        const tailData = this.tailBuffer.getChannelData(0);
        for (let i = 0; i < tailBufSize; i++) tailData[i] = (Math.random() * 2 - 1) * (1 - i / tailBufSize);

        this.startAmbientBGM();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setSFXVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  setBGMVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    }
  }

  stopAmbientBGM() {
    if (!this.isBGMPlaying) return;
    if (this.bgmOsc1) {
      try { this.bgmOsc1.stop(); this.bgmOsc1.disconnect(); } catch (e) {}
      this.bgmOsc1 = null;
    }
    if (this.bgmLfo) {
      try { this.bgmLfo.stop(); this.bgmLfo.disconnect(); } catch (e) {}
      this.bgmLfo = null;
    }
    this.isBGMPlaying = false;
  }

  startAmbientBGM() {
    if (this.isBGMPlaying || !this.ctx) return;
    this.isBGMPlaying = true;

    const t = this.ctx.currentTime;

    // Ambient Sci-Fi Drone Oscillator 1
    this.bgmOsc1 = this.ctx.createOscillator();
    this.bgmLfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    this.bgmOsc1.type = 'sine';
    this.bgmOsc1.frequency.setValueAtTime(55, t); // A1 note

    this.bgmLfo.frequency.value = 0.2; // Slow pulse
    lfoGain.gain.value = 4;
    this.bgmLfo.connect(this.bgmOsc1.frequency);
    this.bgmLfo.start();

    // Lowpass filter for smooth ambient tone
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;

    this.bgmOsc1.connect(filter);
    filter.connect(this.bgmGain);

    this.bgmOsc1.start(t);
  }

  // Realistic AR-15 Gunshot - Layered synthesis
  playGunshot() {
    if (!this.ctx) return;
    this.init();

    const t = this.ctx.currentTime;

    // Layer 1: Mechanical transient click (5ms)
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(3500, t);
    click.frequency.exponentialRampToValueAtTime(800, t + 0.005);
    clickGain.gain.setValueAtTime(0.12, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.005);
    click.connect(clickGain);
    clickGain.connect(this.sfxGain);
    click.start(t);
    click.stop(t + 0.006);

    // Layer 2: Low thump / body of the report (80ms)
    const thump = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(150, t);
    thump.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    thumpGain.gain.setValueAtTime(0.20, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    thump.connect(thumpGain);
    thumpGain.connect(this.sfxGain);
    thump.start(t);
    thump.stop(t + 0.085);

    // Layer 3: High-frequency crack / supersonic snap (60ms)
    let crackBuf = this.crackBuffer;
    if (!crackBuf) {
      const crackBufSize = Math.floor(this.ctx.sampleRate * 0.06);
      crackBuf = this.ctx.createBuffer(1, crackBufSize, this.ctx.sampleRate);
      const crackData = crackBuf.getChannelData(0);
      for (let i = 0; i < crackBufSize; i++) crackData[i] = Math.random() * 2 - 1;
    }
    const crackSrc = this.ctx.createBufferSource();
    crackSrc.buffer = crackBuf;

    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 3000;
    crackFilter.Q.value = 1.2;

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.18, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    crackSrc.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.sfxGain);
    crackSrc.start(t);

    // Layer 4: Tail reverb rumble (100ms, quiet)
    let tailBuf = this.tailBuffer;
    if (!tailBuf) {
      const tailBufSize = Math.floor(this.ctx.sampleRate * 0.1);
      tailBuf = this.ctx.createBuffer(1, tailBufSize, this.ctx.sampleRate);
      const tailData = tailBuf.getChannelData(0);
      for (let i = 0; i < tailBufSize; i++) tailData[i] = (Math.random() * 2 - 1) * (1 - i / tailBufSize);
    }
    const tailSrc = this.ctx.createBufferSource();
    tailSrc.buffer = tailBuf;

    const tailFilter = this.ctx.createBiquadFilter();
    tailFilter.type = 'lowpass';
    tailFilter.frequency.value = 600;

    const tailGain = this.ctx.createGain();
    tailGain.gain.setValueAtTime(0.08, t + 0.01);
    tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    tailSrc.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(this.sfxGain);
    tailSrc.start(t + 0.01);
  }

  // Hitmarker Ping
  playHit() {
    if (!this.ctx) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  // Impact sound
  playImpact() {
    if (!this.ctx) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  // Reload sound
  playReload() {
    if (!this.ctx) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(600, t);
    gain1.gain.setValueAtTime(0.2, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.05);
  }

  // Empty magazine click
  playEmpty() {
    if (!this.ctx) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(900, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  // Jump sound
  playJump() {
    if (!this.ctx) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.15);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Melee knife swing sound (metallic shing)
  playMeleeSwing() {
    if (!this.ctx) return;
    this.init();

    const t = this.ctx.currentTime;

    // High-freq metallic sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(4000, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
    gain.gain.setValueAtTime(0.10, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.085);

    // Short noise burst for texture
    const nBufSize = Math.floor(this.ctx.sampleRate * 0.04);
    const nBuf = this.ctx.createBuffer(1, nBufSize, this.ctx.sampleRate);
    const nData = nBuf.getChannelData(0);
    for (let i = 0; i < nBufSize; i++) {
      nData[i] = (Math.random() * 2 - 1) * (1 - i / nBufSize);
    }
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = nBuf;
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'highpass';
    nFilter.frequency.value = 3000;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.08, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    nSrc.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.sfxGain);
    nSrc.start(t);
  }

  // Melee hit thud sound
  playMeleeHit() {
    if (!this.ctx) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.065);
  }
}

export const sound = new SoundFX();
