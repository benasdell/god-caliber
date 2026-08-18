// Data-driven Enemy Archetype Registry
// Defines stats, spatial distance bands, steering weights, flight dynamics, and weapon parameters.

export const ENEMY_REGISTRY = {
  HUMANOID: {
    type: 'HUMANOID',
    difficultyTier: 'Minion',
    hp: 100,
    speed: 8.0,
    maxForce: 18.0,
    colRadius: 0.75,
    colliderOffset: { x: 0, y: 1.0, z: 0 },
    headshotMinY: 1.35,
    color: 0xef4444,
    scale: { x: 1.0, y: 1.0, z: 1.0 },
    
    // Combat Spatial Distance Banding
    ranges: {
      minStandoff: 12.0,   // Retreat/backpedal threshold if player gets too close
      maxStandoff: 25.0,   // Maximum standoff range for effective shooting
      meleeDistance: 2.5   // Emergency close quarter distance
    },

    // Craig Reynolds Steering Weights
    steering: {
      wSeek: 1.0,
      wArrival: 1.2,
      wSeparation: 2.5,
      wObstacleAvoidance: 3.0,
      wStrafe: 1.8,
      wRepulsion: 4.0
    },

    weapon: {
      defaultType: 'PISTOL',
      rifleChance: 0.4,
      pistolFireRate: 1.2,
      rifleFireRate: 2.0,
      damage: 12,
      speed: 50
    }
  },

  GOLIATH: {
    type: 'GOLIATH',
    difficultyTier: 'Elite',
    hp: 250,
    speed: 4.0,
    maxForce: 12.0,
    colRadius: 1.25,
    colliderOffset: { x: 0, y: 1.4, z: 0 },
    headshotMinY: 1.80,
    color: 0xd97706,
    scale: { x: 1.4, y: 1.4, z: 1.4 },

    ranges: {
      minStandoff: 2.5,
      maxStandoff: 3.0,
      meleeDistance: 3.0
    },

    steering: {
      wSeek: 2.2,
      wArrival: 1.5,
      wSeparation: 4.0,
      wObstacleAvoidance: 4.0,
      wStrafe: 0.0,
      wRepulsion: 5.0
    },

    weapon: {
      defaultType: 'BATTLEAXE',
      swingCooldown: 1.5,
      damage: 35,
      meleeRange: 2.8
    }
  },

  DRONE: {
    type: 'DRONE',
    difficultyTier: 'Minion',
    hp: 60,
    speed: 6.0,
    maxForce: 22.0,
    colRadius: 0.60,
    colliderOffset: { x: 0, y: 0.45, z: 0 },
    headshotMinY: 0.35,
    color: 0x38bdf8,
    scale: { x: 1.0, y: 1.0, z: 1.0 },

    ranges: {
      minStandoff: 1.8,
      maxStandoff: 18.0,
      meleeDistance: 1.8
    },

    steering: {
      wSeek: 1.5,
      wArrival: 1.0,
      wSeparation: 2.0,
      wObstacleAvoidance: 2.5,
      wStrafe: 1.2,
      wRepulsion: 3.0
    },

    flight: {
      baseAltitude: 4.5,
      sineAmplitude: 1.2,
      sineFrequency: 2.0
    },

    weapon: {
      defaultType: 'KAMIKAZE',
      detonateDamage: 45,
      detonateRange: 1.8
    }
  }
};
