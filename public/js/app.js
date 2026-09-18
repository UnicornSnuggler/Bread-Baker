import { getCookie, setCookie } from './utils.js';
import { renderLeaderboard } from './leaderboard.js';

const socket = io();

const globalBreadCounter = document.getElementById('global-bread-count'),
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
  fundsCounter = document.getElementById('funds-count'),
  sellButton = document.getElementById('sell-button');

let cache = {
  globalBread: 0,
  personalBread: 0,
  funds: 0
};

function checkUnlockThresholds() {
  if (cache.personalBread >= 10 && marketCard.classList.contains('hidden')) {
    marketCard.classList.remove('hidden');
    marketCard.classList.add('pop-in');
  }
}

function authenticateBaker(name) {
  if (authErrorMessage) {
    authErrorMessage.textContent = '';
    authErrorMessage.classList.add('hidden');
  }
  socket.emit('auth:baker', { bakerName: name });
}

const existingBakerName = getCookie('bakerName');
if (!existingBakerName) {
  bakerModal.classList.remove('hidden');
}

socket.on('connect', () => {
  const bakerName = getCookie('bakerName');
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
  
  bakerDisplay.textContent = `${data.bakerName}'s Bakery`;
  cache.personalBread = data.userBreadBaked || 0;
  personalBreadCounter.textContent = cache.personalBread.toLocaleString();
  
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
  cache.personalBread = data.personalBread;
  personalBreadCounter.textContent = cache.personalBread.toLocaleString();
  checkUnlockThresholds();
});

socket.on('leaderboard:update', (data) => {
  renderLeaderboard(data, leaderboardList);
});

bakeButton.addEventListener('click', () => {
  cache.globalBread += 1;
  cache.personalBread += 1;

  globalBreadCounter.textContent = cache.globalBread.toLocaleString();
  personalBreadCounter.textContent = cache.personalBread.toLocaleString();

  checkUnlockThresholds();
  socket.emit('action:bake');
});

// Placeholder listener for sell button
sellButton.addEventListener('click', () => {
  // Logic for exchanging personal bread for funds will go here
});