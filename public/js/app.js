import { getCookie, setCookie } from './utils.js';
import { renderLeaderboard } from './leaderboard.js';

const socket = io();

const currentBreadCounter = document.getElementById('current-bread-count'),
  globalBreadCounter = document.getElementById('global-bread-count'),
  personalBreadCounter = document.getElementById('personal-bread-count'),
  playerCount = document.getElementById('player-count'),
  bakerLabel = document.getElementById('baker-label'),
  bakeButton = document.getElementById('bake-button'),
  bakerModal = document.getElementById('baker-modal'),
  bakerForm = document.getElementById('baker-form'),
  bakerInput = document.getElementById('baker-name-input'),
  bakerDisplay = document.getElementById('baker-display'),
  leaderboardList = document.getElementById('leaderboard-list'),
  anonBakeBtn = document.getElementById('anon-bake-btn'),
  authErrorMessage = document.getElementById('auth-error-message'),
  marketCard = document.getElementById('market-card'),
  creditsCounter = document.getElementById('credits-count'),
  sellButton = document.getElementById('sell-button');

let cache = {
  globalBread: 0,
  user: {}
};

function checkUnlockThresholds() {
  if (cache.user.stats.breadBakedAllTime >= 10 && marketCard.classList.contains('hidden')) {
    marketCard.classList.remove('hidden');
    marketCard.classList.add('pop-in');
  }
  
  sellButton.disabled = cache.user.inventory.bread < 1;
}

function authenticateBaker(name) {
  if (authErrorMessage) {
    authErrorMessage.textContent = '';
    authErrorMessage.classList.add('hidden');
  }

  socket.emit('auth:baker', { bakerName: name });
}

function dispatchGameAction(actionKey) {
  socket.emit('game:action', { actionKey });
}

const existingBakerName = getCookie('bakerName');

if (!existingBakerName) {
  bakerModal.classList.remove('hidden');
}

socket.on('connect', () => {
  let bakerName = getCookie('bakerName');

  if (bakerName) {
    socket.emit('auth:baker', { bakerName });
  }
});

bakerForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = bakerInput.value.trim();
  
  if (name) {
    authenticateBaker(name);
  }
});

if (anonBakeBtn) {
  anonBakeBtn.addEventListener('click', () => {
    bakerModal.classList.add('hidden');

    if (authErrorMessage) {
      authErrorMessage.textContent = '';
      authErrorMessage.classList.add('hidden');
    }
  });
}

socket.on('auth:error', (data) => {
  if (authErrorMessage) {
    authErrorMessage.textContent = data.message || 'Invalid baker name.';
    authErrorMessage.classList.remove('hidden');
  }

  bakerModal.classList.remove('hidden');
});

socket.on('auth:success', (data) => {
  setCookie('bakerName', data.bakerName);
  
  cache.user = data;

  bakerDisplay.textContent = `${cache.user.bakerName}'s Bakery`;

  currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();
  personalBreadCounter.textContent = cache.user.stats.breadBakedAllTime.toLocaleString();

  creditsCounter.textContent = cache.user.currency.credits.toLocaleString();
  
  checkUnlockThresholds();

  bakerModal.classList.add('hidden');

  if (authErrorMessage) {
    authErrorMessage.textContent = '';
    authErrorMessage.classList.add('hidden');
  }
});

socket.on('init:state', (data) => {
  cache.globalBread = data.breadCount;
  globalBreadCounter.textContent = cache.globalBread.toLocaleString();

  playerCount.textContent = data.activePlayers;
  bakerLabel.textContent = `Baker${data.activePlayers > 1 ? 's' : ''}`;
});

socket.on('presence:update', (data) => {
  playerCount.textContent = data.activePlayers;
  bakerLabel.textContent = `Baker${data.activePlayers > 1 ? 's' : ''}`;
});

socket.on('state:update', (data) => {
  cache.globalBread = data.breadCount;
  globalBreadCounter.textContent = cache.globalBread.toLocaleString();
});

socket.on('personal:update', (data) => {
  cache.user = data;
  
  currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();
  personalBreadCounter.textContent = cache.user.stats.breadBakedAllTime.toLocaleString();

  checkUnlockThresholds();
});

socket.on('leaderboard:update', (data) => {
  renderLeaderboard(data, leaderboardList);
});

bakeButton.addEventListener('click', () => {
  cache.user.inventory.bread += 1;
  currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();
  
  cache.globalBread += 1;
  globalBreadCounter.textContent = cache.globalBread.toLocaleString();

  cache.user.stats.breadBakedAllTime += 1;
  cache.user.stats.breadBakedThisIteration += 1;
  personalBreadCounter.textContent = cache.user.stats.breadBakedAllTime.toLocaleString();

  dispatchGameAction('action:bake');
});

// Placeholder listener for sell button
sellButton.addEventListener('click', () => {
  cache.user.inventory.bread -= 1;
  currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();

  cache.user.currency.credits += 1;
  creditsCounter.textContent = cache.user.currency.credits.toLocaleString();

  cache.user.stats.creditsEarnedAllTime += 1;
  cache.user.stats.creditsEarnedThisIteration += 1;

  dispatchGameAction('action:sell');
});