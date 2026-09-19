const { Filter } = require('bad-words');
const GameState = require('../models/GameState');
const User = require('../models/User');
const { processAction } = require('../services/actionProcessor');

function validateBakerName(rawName) {
  if (!rawName || typeof rawName !== 'string')
    return 'Name is required.';

  const cleanName = rawName.trim(),
    allowedPattern = /^[a-zA-Z0-9 _-]+$/,
    filter = new Filter();

  if (cleanName.length < 2)
    return 'Baker name must be at least 2 characters long.';

  if (cleanName.length > 20)
    return 'Baker name cannot exceed 20 characters.';

  if (!allowedPattern.test(cleanName))
    return 'Names can only contain letters, numbers, spaces, underscores, and hyphens.';

  if (filter.isProfane(cleanName))
    return 'Please choose a family-friendly baker name, you heathen...';

  return null;
}

const cache = {
  userStates: {},
  pendingDirtyUsers: new Set(),
  globalBread: 0,
  pendingGlobalClicks: 0
};

function getTopTenLeaderboard() {
  return Object.values(cache.userStates)
    .sort((a, b) => (b.stats.breadBakedAllTime) - (a.stats.breadBakedAllTime))
    .slice(0, 10);
}

module.exports = (io) => {
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

  io.on('connection', (socket) => {
    socket.on('auth:baker', async (data) => {
      const rawName = data?.bakerName;

      const validationError = validateBakerName(rawName);
      if (validationError)
        return socket.emit('auth:error', { message: validationError });

      const name = rawName.trim();
      socket.bakerName = name;

      if (!cache.userStates[name]) {
        const userDoc = await User.findOneAndUpdate(
          { bakerName: name },
          { $set: { lastSeen: new Date() } },
          {
            upsert: true,
            setDefaultsOnInsert: true,
            returnDocument: 'after'
          }
        ).lean();

        cache.userStates[name] = userDoc;
      }

      socket.emit('auth:success', cache.userStates[name]);

      socket.emit('init:state', {
        breadCount: cache.globalBread,
        activePlayers: io.engine.clientsCount
      });

      io.emit('leaderboard:update', getTopTenLeaderboard());
    });

    socket.on('game:action', (payload) => {
      const bakerName = socket.bakerName;
      const userState = cache.userStates[bakerName];

      if (!userState)
        return;

      const result = processAction(payload, userState);

      if (result.success) {
        cache.pendingDirtyUsers.add(bakerName);

        if (result.isGlobal) {
          const incrementAmount = result.quantity || 1;
          cache.globalBread += incrementAmount;
          cache.pendingGlobalClicks += incrementAmount;
          
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