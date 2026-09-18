const mongoose = require('mongoose');

const GameStateSchema = new mongoose.Schema({
  key: { type: String, default: 'global_state', unique: true },
  breadCount: { type: Number, default: 0 },
  totalClicks: { type: Number, default: 0 }
});

module.exports = mongoose.model('GameState', GameStateSchema);