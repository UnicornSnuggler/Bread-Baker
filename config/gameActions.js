module.exports = {
  'action:bake': {
    type: 'INCREMENT',
    cost: {},
    rewards: {
      inventory: {
        bread: 1
      }
    },
    stats: {
        breadBakedAllTime: 1,
        breadBakedThisIteration: 1
    },
    isGlobal: true
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
    },
    stats: {
        creditsEarnedAllTime: 1,
        creditsEarnedThisIteration: 1
    }
  },
  'action:buy_oven': {
    type: 'EXCHANGE',
    cost: {
      currency: {
        credits: 10
      }
    },
    rewards: {
      upgrades: {
        oven: 1
      }
    },
    stats: {}
  }
};