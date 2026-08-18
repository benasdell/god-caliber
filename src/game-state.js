// Game State Machine for Battle Royale mode
// States: LOBBY → LOOT_PHASE → COMBAT_PHASE → FINAL_CIRCLE → VICTORY / DEFEAT

export const MATCH_PHASES = {
  LOBBY: 'LOBBY',
  LOOT_PHASE: 'LOOT_PHASE',
  COMBAT_PHASE: 'COMBAT_PHASE',
  FINAL_CIRCLE: 'FINAL_CIRCLE',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
};

export class GameStateManager {
  constructor() {
    this.phase = MATCH_PHASES.LOBBY;
    this.phaseTimer = 0;          // Seconds remaining in current phase
    this.matchTime = 0;           // Total elapsed match time
    this.circleStage = 0;         // Current circle stage (0-4)
    this.isMatchActive = false;
    
    // Match stats for end screen
    this.stats = {
      kills: 0,
      headshots: 0,
      damageDealt: 0,
      itemsLooted: 0,
      itemsCrafted: 0,
      respawnTokensUsed: 0,
      survivalTime: 0,
    };

    // Phase durations in seconds
    this.PHASE_DURATIONS = {
      LOOT_PHASE: 60,      // 60 seconds (1 minute) looting phase
      COMBAT_STAGE_1: 45,  // Circle stage 1→2
      COMBAT_STAGE_2: 40,  // Circle stage 2→3
      COMBAT_STAGE_3: 30,  // Circle stage 3→4 (final)
      FINAL_CIRCLE: 60,    // Final circle duration
    };

    this.allowAIRespawn = true;
  }

  startMatch() {
    this.phase = MATCH_PHASES.LOOT_PHASE;
    this.phaseTimer = this.PHASE_DURATIONS.LOOT_PHASE;
    this.matchTime = 0;
    this.circleStage = 0;
    this.isMatchActive = true;
    this.allowAIRespawn = true;
    this.resetStats();
  }

  resetStats() {
    Object.keys(this.stats).forEach(k => this.stats[k] = 0);
  }

  update(deltaTime) {
    if (!this.isMatchActive) return;
    
    this.matchTime += deltaTime;
    this.stats.survivalTime = this.matchTime;

    if (this.phase === MATCH_PHASES.LOOT_PHASE) {
      this.phaseTimer -= deltaTime;
      if (this.phaseTimer <= 0) {
        this.phase = MATCH_PHASES.COMBAT_PHASE;
        this.circleStage = 1;
        this.phaseTimer = this.PHASE_DURATIONS.COMBAT_STAGE_1;
      }
    } else if (this.phase === MATCH_PHASES.COMBAT_PHASE) {
      this.phaseTimer -= deltaTime;
      if (this.phaseTimer <= 0) {
        this.circleStage++;
        if (this.circleStage >= 4) {
          this.phase = MATCH_PHASES.FINAL_CIRCLE;
          this.phaseTimer = this.PHASE_DURATIONS.FINAL_CIRCLE;
          this.allowAIRespawn = false; // Lock AI respawns in final circle
        } else if (this.circleStage === 2) {
          this.phaseTimer = this.PHASE_DURATIONS.COMBAT_STAGE_2;
        } else if (this.circleStage === 3) {
          this.phaseTimer = this.PHASE_DURATIONS.COMBAT_STAGE_3;
        }
      }
    } else if (this.phase === MATCH_PHASES.FINAL_CIRCLE) {
      this.phaseTimer -= deltaTime;
      if (this.phaseTimer <= 0) {
        this.triggerVictory();
      }
    }
  }

  checkVictoryCondition(aliveHumanCount, activeAICount) {
    if (!this.isMatchActive) return null;
    if (this.phase !== MATCH_PHASES.COMBAT_PHASE && this.phase !== MATCH_PHASES.FINAL_CIRCLE) return null;

    if (aliveHumanCount === 0) {
      this.triggerDefeat();
      return 'DEFEAT';
    }

    if (this.phase === MATCH_PHASES.FINAL_CIRCLE && activeAICount === 0 && aliveHumanCount === 1) {
      this.triggerVictory();
      return 'VICTORY';
    }

    return null;
  }

  triggerVictory() {
    this.phase = MATCH_PHASES.VICTORY;
    this.isMatchActive = false;
  }

  triggerDefeat() {
    this.phase = MATCH_PHASES.DEFEAT;
    this.isMatchActive = false;
  }

  restartMatch() {
    this.phase = MATCH_PHASES.LOBBY;
    this.isMatchActive = false;
  }

  // Helpers for other systems to query
  get isLootPhase() { return this.phase === MATCH_PHASES.LOOT_PHASE; }
  get isCombatActive() { return this.phase === MATCH_PHASES.COMBAT_PHASE || this.phase === MATCH_PHASES.FINAL_CIRCLE; }
  get shouldSpawnAI() { return this.isCombatActive; }
  
  get targetAICount() {
    if (!this.shouldSpawnAI) return 0;
    if (this.circleStage <= 2) return 6;
    if (this.circleStage === 3) return 10;
    return 14; // Final circle
  }

  get aiComposition() {
    if (this.circleStage <= 2) return { HUMANOID: 0.8, DRONE: 0.2, GOLIATH: 0.0 };
    if (this.circleStage === 3) return { HUMANOID: 0.6, DRONE: 0.2, GOLIATH: 0.2 };
    return { HUMANOID: 0.4, DRONE: 0.3, GOLIATH: 0.3 };
  }
}
