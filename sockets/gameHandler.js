const GameState = require('../models/GameState');
const User = require('../models/User');
const validator = require('validator');
const { Filter } = require('bad-words');

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

const filter = new Filter();

function validateBakerName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return 'Name is required.';
  }

  const cleanName = rawName.trim();

  if (cleanName.length < 2) {
    return 'Baker name must be at least 2 characters long.';
  }

  if (cleanName.length > 20) {
    return 'Baker name cannot exceed 20 characters.';
  }

  // Whitelist: letters, numbers, spaces, underscores, and hyphens only
  const allowedPattern = /^[a-zA-Z0-9 _-]+$/;
  if (!allowedPattern.test(cleanName)) {
    return 'Names can only contain letters, numbers, spaces, underscores, and hyphens.';
  }

  // Profanity check
  if (filter.isProfane(cleanName)) {
    return 'Please choose a family-friendly baker name!';
  }

  return null;
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
      const allUsers = await User.find({}, 'bakerName stats.breadBakedAllTime').lean();
      allUsers.forEach((user) => {
        cache.leaderboard[user.bakerName] = user.stats.breadBakedAllTime || 0;
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
              update: { $inc: { 'stats.breadBakedAllTime': clicks } }
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
      const rawName = data?.bakerName;
      
      // 1. Validate Input
      const validationError = validateBakerName(rawName);
      
      // 2. Reject if invalid
      if (validationError) {
        return socket.emit('auth:error', { message: validationError });
      }

      const name = rawName.trim();

      // 3. Proceed only when completely valid
      if (cache.activePlayers[socket.id]) {
        cache.activePlayers[socket.id].bakerName = name;
      }

      if (cache.leaderboard[name] === undefined) {
        cache.leaderboard[name] = 0;
      }

      const user = await User.findOneAndUpdate(
        { bakerName: name },
        { $set: { 'stats.lastSeen': new Date() } },
        { upsert: true, returnDocument: 'after' }
      );

      cache.leaderboard[name] = user.stats.breadBakedAllTime || cache.leaderboard[name] || 0;

      // Emit success
      socket.emit('auth:success', { bakerName: user.bakerName, userBreadBaked: user.stats.breadBakedAllTime });
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