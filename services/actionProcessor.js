const actionsConfig = require('../config/gameActions');

function processAction(payload, playerState) {
  // Support payload as an object or a simple string key
  const actionKey = typeof payload === 'object' ? payload.actionKey : payload;
  const quantity = (typeof payload === 'object' && payload.quantity) ? Math.max(1, payload.quantity) : 1;

  const config = actionsConfig[actionKey];

  if (!config) return { success: false, reason: 'Unknown action' };

  // 1. Validate Costs against in-memory player state (scaled by quantity)
  for (const location of Object.keys(config.cost)) {
    for (const [resource, amount] of Object.entries(config.cost[location])) {
      const totalCost = amount * quantity;
      if ((playerState[location][resource] || 0) < totalCost) {
        return { success: false, reason: `Not enough ${resource}` };
      }
    }
  }

  // 2. Deduct Costs (scaled by quantity)
  for (const location of Object.keys(config.cost)) {
    for (const [resource, amount] of Object.entries(config.cost[location])) {
      playerState[location][resource] -= (amount * quantity);
    }
  }

  // 3. Grant Rewards (scaled by quantity)
  for (const location of Object.keys(config.rewards)) {
    for (const [resource, amount] of Object.entries(config.rewards[location])) {
      playerState[location][resource] = (playerState[location][resource] || 0) + (amount * quantity);
    }
  }

  // 4. Increment Stats (scaled by quantity)
  for (const [stat, amount] of Object.entries(config.stats)) {
    playerState.stats[stat] = (playerState.stats[stat] || 0) + (amount * quantity);
  }

  return {
    success: true,
    updatedState: playerState,
    isGlobal: config.isGlobal,
    quantity // Return scaled quantity for global tracking
  };
}

module.exports = { processAction };