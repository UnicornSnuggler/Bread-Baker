const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  bakerName: { type: String, required: true, unique: true },
  breadBaked: { type: Number, default: 0 },
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);