const GameState = require('../models/GameState');
const User = require('../models/User');

const activePlayers = {};

async function getOrCreateGameState() {
  let state = await GameState.findOne({ key: 'global_state' });
  if (!state) state = await GameState.create({ key: 'global_state', breadCount: 0, totalClicks: 0 });
  return state;
}

async function getLeaderboard() {
  return await User.find({}, 'bakerName breadBaked').sort({ breadBaked: -1 }).limit(10).lean();
}

async function broadcastLeaderboard(io) {
  const leaderboard = await getLeaderboard();
  io.emit('leaderboard:update', leaderboard);
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    activePlayers[socket.id] = { joinedAt: new Date(), bakerName: null, clicks: 0 };

    socket.on('auth:baker', async (data) => {
      const name = data.bakerName ? data.bakerName.trim() : 'Anonymous Baker';
      if (activePlayers[socket.id]) activePlayers[socket.id].bakerName = name;

      const user = await User.findOneAndUpdate(
        { bakerName: name },
        { $set: { lastSeen: new Date() } },
        { upsert: true, returnDocument: 'after' }
      );

      socket.emit('auth:success', { bakerName: user.bakerName, userBreadBaked: user.breadBaked });

      console.log(`${name} has logged in!`);

      await broadcastLeaderboard(io);
    });

    socket.on('action:bake', async () => {
      const bakerName = activePlayers[socket.id]?.bakerName;
      if (activePlayers[socket.id]) activePlayers[socket.id].clicks += 1;

      const updatedState = await GameState.findOneAndUpdate(
        { key: 'global_state' },
        { $inc: { breadCount: 1, totalClicks: 1 } },
        { returnDocument: 'after', upsert: true }
      );

      let personalBread = activePlayers[socket.id].clicks;
      if (bakerName) {
        const updatedUser = await User.findOneAndUpdate({ bakerName }, { $inc: { breadBaked: 1 } }, { returnDocument: 'after' });
        if (updatedUser) personalBread = updatedUser.breadBaked;
      }

      socket.emit('personal:update', { personalBread });
      io.emit('state:update', { breadCount: updatedState.breadCount, bakedBy: bakerName || socket.id });
      await broadcastLeaderboard(io);
    });

    socket.on('disconnect', () => {
      console.log(`${activePlayers[socket.id].bakerName ?? 'Anonymous Baker'} has logged out...`);
      delete activePlayers[socket.id];
      io.emit('presence:update', { activePlayers: Object.keys(activePlayers).length });
    });

    (async () => {
      const state = await getOrCreateGameState();
      const leaderboard = await getLeaderboard();
      socket.emit('init:state', { breadCount: state.breadCount, activePlayers: Object.keys(activePlayers).length });
      socket.emit('leaderboard:update', leaderboard);
      io.emit('presence:update', { activePlayers: Object.keys(activePlayers).length });
    })();
  });
};