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
    anonBakeBtn = document.getElementById('anon-bake-btn');

// Close modal without authenticating
anonBakeBtn.addEventListener('click', () => {
    bakerModal.classList.add('hidden');
});

let cache = {
    globalBread: 0,
    personalBread: 0
};

function authenticateBaker(name) {
    setCookie('bakerName', name);
    socket.emit('auth:baker', { bakerName: name });
    bakerModal.classList.add('hidden');
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

bakerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = bakerInput.value.trim();
    if (name) {
        authenticateBaker(name);
    }
});

// Authenticated session state load[cite: 4]
socket.on('auth:success', (data) => {
    bakerDisplay.textContent = `Baker: ${data.bakerName}`;
    cache.personalBread = data.userBreadBaked || 0;
    personalBreadCounter.textContent = cache.personalBread.toLocaleString();
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

// Dynamic Leaderboard Updates via imported utility module[cite: 4]
socket.on('leaderboard:update', (data) => {
    renderLeaderboard(data, leaderboardList);
});

// User action with optimistic dual prediction[cite: 4]
bakeButton.addEventListener('click', () => {
    cache.globalBread += 1;
    cache.personalBread += 1;

    globalBreadCounter.textContent = cache.globalBread.toLocaleString();
    personalBreadCounter.textContent = cache.personalBread.toLocaleString();

    socket.emit('action:bake');
});