import { getCookie, setCookie } from './utils.js';
import { renderLeaderboard } from './leaderboard.js';

const socket = io();

const DOM = {
  currentBreadCounter: document.getElementById('current-bread-count'),
  globalBreadCounter: document.getElementById('global-bread-count'),
  personalBreadCounter: document.getElementById('personal-bread-count'),
  playerCount: document.getElementById('player-count'),
  bakerLabel: document.getElementById('baker-label'),
  bakeButton: document.getElementById('bake-button'),
  bakerModal: document.getElementById('baker-modal'),
  bakerForm: document.getElementById('baker-form'),
  bakerInput: document.getElementById('baker-name-input'),
  bakerDisplay: document.getElementById('baker-display'),
  leaderboardList: document.getElementById('leaderboard-list'),
  anonBakeBtn: document.getElementById('anon-bake-btn'),
  authErrorMessage: document.getElementById('auth-error-message'),
  marketCard: document.getElementById('market-card'),
  creditsCounter: document.getElementById('credits-count'),
  sellButton: document.getElementById('sell-button')
};

let cache = {
  globalBread: 0,
  user: {}
};

function checkUnlockThresholds() {
  if (cache.user.stats.breadBakedAllTime >= 10 && DOM.marketCard.classList.contains('hidden')) {
    DOM.marketCard.classList.remove('hidden');
    DOM.marketCard.classList.add('pop-in');
  }
  
  DOM.sellButton.disabled = cache.user.inventory.bread < 1;
}

function authenticateBaker(name) {
  if (DOM.authErrorMessage) {
    DOM.authErrorMessage.textContent = '';
    DOM.authErrorMessage.classList.add('hidden');
  }

  socket.emit('auth:baker', { bakerName: name });
}

function dispatchGameAction(actionKey) {
  socket.emit('game:action', { actionKey });
}

const existingBakerName = getCookie('bakerName');

if (!existingBakerName) {
  DOM.bakerModal.classList.remove('hidden');
}

socket.on('connect', () => {
  let bakerName = getCookie('bakerName');

  if (bakerName) {
    socket.emit('auth:baker', { bakerName });
  }
});

socket.on('auth:error', (data) => {
  if (DOM.authErrorMessage) {
    DOM.authErrorMessage.textContent = data.message || 'Invalid baker name.';
    DOM.authErrorMessage.classList.remove('hidden');
  }

  DOM.bakerModal.classList.remove('hidden');
});

socket.on('auth:success', (data) => {
  setCookie('bakerName', data.bakerName);
  
  cache.user = data;

  DOM.bakerDisplay.textContent = `${cache.user.bakerName}'s Bakery`;

  DOM.currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();
  DOM.personalBreadCounter.textContent = cache.user.stats.breadBakedAllTime.toLocaleString();

  DOM.creditsCounter.textContent = cache.user.currency.credits.toLocaleString();
  
  checkUnlockThresholds();

  DOM.bakerModal.classList.add('hidden');

  if (DOM.authErrorMessage) {
    DOM.authErrorMessage.textContent = '';
    DOM.authErrorMessage.classList.add('hidden');
  }
});

socket.on('init:state', (data) => {
  cache.globalBread = data.breadCount;
  DOM.globalBreadCounter.textContent = cache.globalBread.toLocaleString();

  DOM.playerCount.textContent = data.activePlayers;
  DOM.bakerLabel.textContent = `Baker${data.activePlayers > 1 ? 's' : ''}`;
});

socket.on('presence:update', (data) => {
  DOM.playerCount.textContent = data.activePlayers;
  DOM.bakerLabel.textContent = `Baker${data.activePlayers > 1 ? 's' : ''}`;
});

socket.on('state:update', (data) => {
  cache.globalBread = data.breadCount;
  DOM.globalBreadCounter.textContent = cache.globalBread.toLocaleString();
});

socket.on('personal:update', (data) => {
  cache.user = data;
  
  DOM.currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();
  DOM.personalBreadCounter.textContent = cache.user.stats.breadBakedAllTime.toLocaleString();

  checkUnlockThresholds();
});

socket.on('leaderboard:update', (data) => {
  renderLeaderboard(data, DOM.leaderboardList);
});

DOM.bakerForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = DOM.bakerInput.value.trim();
  
  if (name) {
    authenticateBaker(name);
  }
});

DOM.anonBakeBtn?.addEventListener('click', () => {
  DOM.bakerModal.classList.add('hidden');

  if (DOM.authErrorMessage) {
    DOM.authErrorMessage.textContent = '';
    DOM.authErrorMessage.classList.add('hidden');
  }
});

DOM.bakeButton?.addEventListener('click', () => {
  cache.user.inventory.bread += 1;
  DOM.currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();
  
  cache.globalBread += 1;
  DOM.globalBreadCounter.textContent = cache.globalBread.toLocaleString();

  cache.user.stats.breadBakedAllTime += 1;
  cache.user.stats.breadBakedThisIteration += 1;
  DOM.personalBreadCounter.textContent = cache.user.stats.breadBakedAllTime.toLocaleString();

  dispatchGameAction('action:bake');
});

DOM.sellButton?.addEventListener('click', () => {
  cache.user.inventory.bread -= 1;
  DOM.currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();

  cache.user.currency.credits += 1;
  DOM.creditsCounter.textContent = cache.user.currency.credits.toLocaleString();

  cache.user.stats.creditsEarnedAllTime += 1;
  cache.user.stats.creditsEarnedThisIteration += 1;

  dispatchGameAction('action:sell');
});