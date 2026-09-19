const { Filter } = require('bad-words');
const GameState = require('../models/GameState');
const User = require('../models/User');
const { processAction } = require('../services/actionProcessor');

const filter = new Filter();

// Formal server-side validation rules
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

  // Whitelist: letters, numbers, spaces, underscores, hyphens
  const allowedPattern = /^[a-zA-Z0-9 _-]+$/;
  if (!allowedPattern.test(cleanName)) {
    return 'Names can only contain letters, numbers, spaces, underscores, and hyphens.';
  }

  // Profanity check
  if (filter.isProfane(cleanName)) {
    return 'Please choose a family-friendly baker name!';
  }

  return null; // Valid input
}

// In-memory RAM storage
const cache = {
  userStates: {},               // Full state per bakerName
  pendingDirtyUsers: new Set(), // Modified names needing DB write
  globalBread: 0,
  pendingGlobalClicks: 0
};

// Fast RAM leaderboard sorter
function getTopTenLeaderboard() {
  return Object.values(cache.userStates)
    .sort((a, b) => (b.stats.breadBakedAllTime) - (a.stats.breadBakedAllTime))
    .slice(0, 10);
}

module.exports = (io) => {
  // 1. Boot Hydration: Load DB state into Node RAM
  (async () => {
    try {
      const globalState = await GameState.findOne({ key: 'global_state' });
      if (globalState) cache.globalBread = globalState.breadCount || 0;

      const allUsers = await User.find({}).lean();
      allUsers.forEach((user) => {
        cache.userStates[user.bakerName] = user;
      });
    } catch (err) {
      console.error('Error hydrating RAM cache on startup:', err);
    }
  })();

  // 2. Periodic Database Writer (Every 2 Seconds)
  setInterval(async () => {
    try {
      if (cache.pendingGlobalClicks > 0) {
        const clicks = cache.pendingGlobalClicks;
        cache.pendingGlobalClicks = 0;
        await GameState.findOneAndUpdate(
          { key: 'global_state' },
          { $inc: { breadCount: clicks, totalClicks: clicks } },
          { upsert: true }
        );
      }

      if (cache.pendingDirtyUsers.size > 0) {
        const dirtyNames = Array.from(cache.pendingDirtyUsers);
        cache.pendingDirtyUsers.clear();

        const bulkOps = dirtyNames.map((bakerName) => ({
          updateOne: {
            filter: { bakerName },
            update: { $set: cache.userStates[bakerName] }
          }
        }));

        await User.bulkWrite(bulkOps);
      }
    } catch (err) {
      console.error('Error executing background DB flush:', err);
    }
  }, 2000);

  // 3. Socket Handlers
  io.on('connection', (socket) => {

    socket.on('auth:baker', async (data) => {
      const rawName = data?.bakerName;

      // Validate before touching cache or MongoDB[cite: 1]
      const validationError = validateBakerName(rawName);
      if (validationError) {
        return socket.emit('auth:error', { message: validationError }); // Explicit rejection[cite: 1]
      }

      const name = rawName.trim();
      socket.bakerName = name;

      // Load or initialize user in cache
      if (!cache.userStates[name]) {
        const userDoc = await User.findOneAndUpdate(
          { bakerName: name },
          { $set: { lastSeen: new Date() } },
          { upsert: true, returnDocument: 'after' }
        ).lean();
        cache.userStates[name] = userDoc;
      }

      // Emit success and send state payloads[cite: 1]
      socket.emit('auth:success', cache.userStates[name]);

      socket.emit('init:state', {
        breadCount: cache.globalBread,
        activePlayers: io.engine.clientsCount
      });

      io.emit('leaderboard:update', getTopTenLeaderboard());
    });

    // Gateway for data-driven game actions
    socket.on('game:action', (payload) => {
      const bakerName = socket.bakerName;
      const userState = cache.userStates[bakerName];
      if (!userState) return;

      const result = processAction(payload.actionKey, userState);

      if (result.success) {
        cache.pendingDirtyUsers.add(bakerName);

        if (result.isGlobal) {
          cache.globalBread += 1;
          cache.pendingGlobalClicks += 1;
          io.emit('state:update', { breadCount: cache.globalBread, bakedBy: bakerName });
        }

        socket.emit('personal:update', result.updatedState);
        io.emit('leaderboard:update', getTopTenLeaderboard());
      } else {
        socket.emit('action:error', { message: result.reason });
      }
    });

    socket.on('disconnect', () => {
      io.emit('presence:update', { activePlayers: io.engine.clientsCount });
    });
  });
};