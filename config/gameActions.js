module.exports = {
  'action:bake': {
    type: 'INCREMENT',
    cost: {},
    rewards: {
      inventory: {
        bread: 1
      }
    },
    isGlobal: true // also increments global pool
  },
  'action:sell': {
    type: 'EXCHANGE',
    cost: { 
      inventory: {
        bread: 1 
      }
    },
    rewards: {
      currency: {
        credits: 1
      }
    }
  },
  'action:buy_oven': {
    type: 'EXCHANGE',
    cost: {
      currency: {
        credits: 50
      }
    },
    rewards: {
      upgrades: {
        oven: 1
      }
    }
  }
};