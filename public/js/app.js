import { getCookie, setCookie, resolveMultiplierQuantity } from './utils.js';
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
  sellButton: document.getElementById('sell-button'),
  buyOvenButton: document.getElementById('buy-oven-button'),
  ovenProgressContainer: document.getElementById('oven-progress-container'),
  ovenProgressWrapper: document.getElementById('oven-progress-wrapper'),
  ovenProgressBar: document.getElementById('oven-progress-bar'),
  ovenCount: document.getElementById('oven-count'),
  ovenRate: document.getElementById('oven-rate'),
  sellMultiplierGroup: document.getElementById('sell-multiplier-group'),
  ovenMultiplierGroup: document.getElementById('oven-multiplier-group')
};

let cache = {
  globalBread: 0,
  user: {}
};

// State tracking for selected multipliers
let selectedMultipliers = {
  sell: '1',
  oven: '1'
};

let ovenInterval = null;

function checkUnlockThresholds() {
  const creditsEarned = cache.user.stats?.creditsEarnedAllTime || 0;
  const breadBaked = cache.user.stats?.breadBakedAllTime || 0;

  // Reveal Market Stall
  if (breadBaked >= 10 && DOM.marketCard.classList.contains('hidden')) {
    DOM.marketCard.classList.remove('hidden');
    DOM.marketCard.classList.add('pop-in');
  }
  
  // Calculate required amount based on sell multiplier
  const userBread = cache.user.inventory?.bread || 0;
  const sellBatch = resolveMultiplierQuantity(selectedMultipliers.sell, userBread, 1);
  DOM.sellButton.disabled = userBread < 1 || (selectedMultipliers.sell !== 'max' && userBread < sellBatch.quantity);

  // Reveal Buy Oven button when user has 10 credits earned (all time)
  if (creditsEarned >= 10 && DOM.buyOvenButton.classList.contains('hidden')) {
    DOM.buyOvenButton.classList.remove('hidden');
    DOM.buyOvenButton.classList.add('pop-in');
    DOM.ovenMultiplierGroup.classList.remove('hidden');
    DOM.ovenMultiplierGroup.classList.add('pop-in');
  }
  
  const userCredits = cache.user.currency?.credits || 0;
  const ovenBatch = resolveMultiplierQuantity(selectedMultipliers.oven, userCredits, 10);
  DOM.buyOvenButton.disabled = userCredits < 10 || (selectedMultipliers.oven !== 'max' && userCredits < ovenBatch.totalCost);
  
  syncOvenLoop();
}

function setupMultiplierListeners(groupElement, targetType) {
  if (!groupElement) return;

  groupElement.addEventListener('click', (e) => {
    const btn = e.target.closest('.multiplier-btn');
    if (!btn) return;

    // Toggle active UI state
    groupElement.querySelectorAll('.multiplier-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Update active multiplier state
    selectedMultipliers[targetType] = btn.dataset.multiplier;
    checkUnlockThresholds();
  });
}

function syncOvenLoop() {
  const ovenCount = cache.user.upgrades?.oven;

  if (ovenCount > 0) {
    DOM.ovenProgressWrapper?.classList.remove('hidden');

    DOM.ovenCount.textContent = ovenCount.toLocaleString();
    DOM.ovenRate.textContent = ovenCount.toLocaleString();

    if (!ovenInterval) {
      startOvenLoop();
    }
  }
}

function startOvenLoop() {
  const duration = 1000;
  const tickRate = 50;
  let elapsed = 0;

  ovenInterval = setInterval(() => {
    elapsed += tickRate;

    const progressPercent = Math.min((elapsed / duration) * 100, 100);
    
    DOM.ovenProgressBar.style.width = `${progressPercent}%`;

    if (elapsed >= duration) {
      elapsed = 0;

      DOM.ovenProgressBar.style.width = '0%';
      
      triggerBake(cache.user.upgrades?.oven);
    }
  }, tickRate);
}

function triggerBake(quantity, isManual = false) {
  cache.user.inventory.bread += quantity;
  DOM.currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();

  cache.globalBread += quantity;
  DOM.globalBreadCounter.textContent = cache.globalBread.toLocaleString();

  cache.user.stats.breadBakedAllTime += quantity;
  cache.user.stats.breadBakedThisIteration += quantity;
  DOM.personalBreadCounter.textContent = cache.user.stats.breadBakedAllTime.toLocaleString();

  dispatchGameAction('action:bake', { quantity });
}

function authenticateBaker(name) {
  if (DOM.authErrorMessage) {
    DOM.authErrorMessage.textContent = '';
    DOM.authErrorMessage.classList.add('hidden');
  }

  socket.emit('auth:baker', { bakerName: name });
}

function dispatchGameAction(actionKey, payloadData = {}) {
  socket.emit('game:action', { actionKey, ...payloadData });
}

// Bind multiplier bar interactions
setupMultiplierListeners(DOM.sellMultiplierGroup, 'sell');
setupMultiplierListeners(DOM.ovenMultiplierGroup, 'oven');

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
  DOM.creditsCounter.textContent = cache.user.currency.credits.toLocaleString();

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
  triggerBake(1, true);
});

DOM.sellButton?.addEventListener('click', () => {
  const userBread = cache.user.inventory?.bread || 0;
  const batch = resolveMultiplierQuantity(selectedMultipliers.sell, userBread, 1);

  if (userBread < batch.quantity) return;

  cache.user.inventory.bread -= batch.quantity;
  DOM.currentBreadCounter.textContent = cache.user.inventory.bread.toLocaleString();

  cache.user.currency.credits += batch.quantity;
  DOM.creditsCounter.textContent = cache.user.currency.credits.toLocaleString();

  cache.user.stats.creditsEarnedAllTime += batch.quantity;
  cache.user.stats.creditsEarnedThisIteration += batch.quantity;

  dispatchGameAction('action:sell', { multiplier: selectedMultipliers.sell, quantity: batch.quantity });
  checkUnlockThresholds();
});

DOM.buyOvenButton?.addEventListener('click', () => {
  const userCredits = cache.user.currency?.credits || 0;
  const batch = resolveMultiplierQuantity(selectedMultipliers.oven, userCredits, 10);

  if (userCredits < batch.totalCost) return;

  dispatchGameAction('action:buy_oven', { multiplier: selectedMultipliers.oven, quantity: batch.quantity });
});