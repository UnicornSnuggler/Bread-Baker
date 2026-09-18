import { getCookie, setCookie } from './utils.js';
import { renderLeaderboard } from './leaderboard.js';

const socket = io();

// DOM Elements
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
  authErrorMessage = document.getElementById('auth-error-message');

let cache = {
  globalBread: 0,
  personalBread: 0
};

function authenticateBaker(name) {
  // Reset error message UI state before sending
  if (authErrorMessage) {
    authErrorMessage.textContent = '';
    authErrorMessage.classList.add('hidden');
  }
  
  // Emit to server for validation (do NOT store cookie until server accepts!)
  socket.emit('auth:baker', { bakerName: name });
}

// Check auth status immediately on script execution
const existingBakerName = getCookie('bakerName');
if (!existingBakerName) {
  bakerModal.classList.remove('hidden');
}

// Authenticate on socket connection if cookie exists
socket.on('connect', () => {
  const bakerName = getCookie('bakerName');
  if (bakerName) {
    socket.emit('auth:baker', { bakerName });
  }
});

// Modal Form Submission
bakerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = bakerInput.value.trim();
  if (name) {
    authenticateBaker(name);
  }
});

// Anonymous Bake Button Listener
if (anonBakeBtn) {
  anonBakeBtn.addEventListener('click', () => {
    bakerModal.classList.add('hidden');
    if (authErrorMessage) {
      authErrorMessage.textContent = '';
      authErrorMessage.classList.add('hidden');
    }
  });
}

// --- SOCKET LISTENERS ---

// Server rejected the submission with an explicit error
socket.on('auth:error', (data) => {
  if (authErrorMessage) {
    authErrorMessage.textContent = data.message || 'Invalid baker name.';
    authErrorMessage.classList.remove('hidden');
  }
  // Ensure modal stays open for correction
  bakerModal.classList.remove('hidden');
});

// Authenticated session accepted by server
socket.on('auth:success', (data) => {
  // Now safely persist cookie on successful validation
  setCookie('bakerName', data.bakerName);
  
  bakerDisplay.textContent = `Baker: ${data.bakerName}`;
  cache.personalBread = data.userBreadBaked || 0;
  personalBreadCounter.textContent = cache.personalBread.toLocaleString();

  // Hide modal and clear error container
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
});

// Dynamic Leaderboard Updates via imported utility module
socket.on('leaderboard:update', (data) => {
  renderLeaderboard(data, leaderboardList);
});

// User action with optimistic dual prediction
bakeButton.addEventListener('click', () => {
  cache.globalBread += 1;
  cache.personalBread += 1;

  globalBreadCounter.textContent = cache.globalBread.toLocaleString();
  personalBreadCounter.textContent = cache.personalBread.toLocaleString();

  socket.emit('action:bake');
});