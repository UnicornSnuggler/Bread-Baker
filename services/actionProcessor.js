const actionsConfig = require('../config/gameActions');

function processAction(actionKey, playerState) {
  const config = actionsConfig[actionKey];
  
  if (!config) return { success: false, reason: 'Unknown action' };

  // 1. Validate Costs against in-memory player state
  for (const location of Object.keys(config.cost)) {
    for (const [resource, amount] of Object.entries(config.cost[location])) {
      if ((playerState[location][resource] || 0) < amount) {
        return { success: false, reason: `Not enough ${resource}` };
      }
    }
  }

  // 2. Deduct Costs
  for (const location of Object.keys(config.cost)) {
    for (const [resource, amount] of Object.entries(config.cost[location])) {
      playerState[location][resource] -= amount;
    }
  }

  // 3. Grant Rewards
  for (const location of Object.keys(config.rewards)) {
    for (const [resource, amount] of Object.entries(config.rewards[location])) {
      playerState[location][resource] = (playerState[location][resource] || 0) + amount;
    }
  }

  return { success: true, updatedState: playerState };
}

module.exports = { processAction };