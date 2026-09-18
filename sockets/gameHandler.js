const GameState = require('../models/GameState');
const User = require('../models/User');

const cache = {
  activePlayers: {},
  leaderboard: {} // { 'BakerName': breadBaked }
};

let pendingGlobalClicks = 0;
const pendingUserClicks = {};

async function getOrCreateGameState() {
  let state = await GameState.findOne({ key: 'global_state' });
  if (!state) {
    state = await GameState.create({ key: 'global_state', breadCount: 0, totalClicks: 0 });
  }
  return state;
}

// Helper: Convert cache.leaderboard object into sorted Top 10 array for emissions
function getTopTenLeaderboard() {
  return Object.entries(cache.leaderboard)
    .map(([bakerName, breadBaked]) => ({ bakerName, breadBaked }))
    .sort((a, b) => b.breadBaked - a.breadBaked)
    .slice(0, 10);
}

module.exports = (io) => {
  let globalBreadCount = 0;

  // --- STARTUP CACHE INITIALIZATION ---
  (async () => {
    try {
      // 1. Prime global bread count
      const state = await getOrCreateGameState();
      globalBreadCount = state.breadCount;

      // 2. Load ALL users into local cache memory
      const allUsers = await User.find({}, 'bakerName breadBaked').lean();
      allUsers.forEach((user) => {
        cache.leaderboard[user.bakerName] = user.breadBaked || 0;
      });
      
      console.log(`Loaded ${allUsers.length} bakers into memory cache.`);
    } catch (err) {
      console.error('Error priming game cache on startup:', err);
    }
  })();

  // --- BACKGROUND DATABASE PERSISTENCE (Every 2 Seconds) ---
  setInterval(async () => {
    try {
      // Flush Global State
      if (pendingGlobalClicks > 0) {
        const clicksToPersist = pendingGlobalClicks;
        pendingGlobalClicks = 0;

        await GameState.findOneAndUpdate(
          { key: 'global_state' },
          { $inc: { breadCount: clicksToPersist, totalClicks: clicksToPersist } },
          { upsert: true }
        );
      }

      // Bulk Flush User Stats
      const usersToUpdate = Object.keys(pendingUserClicks);
      if (usersToUpdate.length > 0) {
        const bulkOps = usersToUpdate.map((bakerName) => {
          const clicks = pendingUserClicks[bakerName];
          delete pendingUserClicks[bakerName];

          return {
            updateOne: {
              filter: { bakerName },
              update: { $inc: { breadBaked: clicks } }
            }
          };
        });

        await User.bulkWrite(bulkOps);
      }
    } catch (err) {
      console.error('Error flushing click buffers to MongoDB:', err);
    }
  }, 2000);


  // --- SOCKET EVENT HANDLERS ---

  io.on('connection', (socket) => {
    cache.activePlayers[socket.id] = { joinedAt: new Date(), bakerName: null, clicks: 0 };

    socket.on('auth:baker', async (data) => {
      const name = data.bakerName ? data.bakerName.trim() : 'Anonymous Baker';
      if (cache.activePlayers[socket.id]) cache.activePlayers[socket.id].bakerName = name;

      // Ensure user exists in memory cache
      if (cache.leaderboard[name] === undefined) {
        cache.leaderboard[name] = 0;
      }

      const user = await User.findOneAndUpdate(
        { bakerName: name },
        { $set: { lastSeen: new Date() } },
        { upsert: true, returnDocument: 'after' }
      );

      // Sync memory score if database had existing score not caught on boot
      cache.leaderboard[name] = user.breadBaked || cache.leaderboard[name] || 0;

      socket.emit('auth:success', { bakerName: user.bakerName, userBreadBaked: user.breadBaked });
      
      // Update top ten in case the logging-in user joins the board
      io.emit('leaderboard:update', getTopTenLeaderboard());
    });

    socket.on('action:bake', () => {
      const bakerName = cache.activePlayers[socket.id]?.bakerName;
      if (cache.activePlayers[socket.id]) cache.activePlayers[socket.id].clicks += 1;

      globalBreadCount += 1;
      pendingGlobalClicks += 1;

      if (bakerName) {
        // 1. Update write buffer for DB persistence
        pendingUserClicks[bakerName] = (pendingUserClicks[bakerName] || 0) + 1;

        // 2. Update real-time memory cache immediately
        cache.leaderboard[bakerName] = (cache.leaderboard[bakerName] || 0) + 1;
      }

      // 3. Emit instant global state and real-time sliced top-10 leaderboard
      io.emit('state:update', { breadCount: globalBreadCount, bakedBy: bakerName || socket.id });
      io.emit('leaderboard:update', getTopTenLeaderboard());
    });

    socket.on('disconnect', () => {
      delete cache.activePlayers[socket.id];
      io.emit('presence:update', { activePlayers: Object.keys(cache.activePlayers).length });
    });

    // Send initial cached state upon connection
    socket.emit('init:state', { breadCount: globalBreadCount, activePlayers: Object.keys(cache.activePlayers).length });
    socket.emit('leaderboard:update', getTopTenLeaderboard());
    io.emit('presence:update', { activePlayers: Object.keys(cache.activePlayers).length });
  });
};