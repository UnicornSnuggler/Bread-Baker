const mongoose = require('mongoose');

const CurrencySchema = new mongoose.Schema({
  credits: { type: Number, default: 0 }
});

const InventorySchema = new mongoose.Schema({
  bread: { type: Number, default: 0 }
});

const UpgradesSchema = new mongoose.Schema({
  oven: { type: Number, default: 0 }
});

const StatsSchema = new mongoose.Schema({
  lastSeen: { type: Date, default: Date.now },
  iterations: { type: Number, default: 1 },

  // Currency

  creditsEarnedAllTime: { type: Number, default: 0 },
  creditsEarnedThisIteration: { type: Number, default: 0 },

  // Inventory

  breadBakedAllTime: { type: Number, default: 0 },
  breadBakedThisIteration: { type: Number, default: 0 }
});

const UserSchema = new mongoose.Schema({
  bakerName: { type: String, required: true, unique: true },
  stats: { type: StatsSchema, default: () => ({}) },
  currency: { type: CurrencySchema, default: () => ({}) },
  inventory: { type: InventorySchema, default: () => ({}) },
  upgrades: { type: UpgradesSchema, default: () => ({}) }
});

module.exports = mongoose.model('User', UserSchema);