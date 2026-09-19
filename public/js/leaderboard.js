import { escapeHtml, formatNumber } from './utils.js';

export function renderLeaderboard(data, leaderboardList) {
  if (!data || data.length === 0) {
    leaderboardList.innerHTML = '<div style="color: #a0a0a0; font-size: 0.85rem;">No bakers yet!</div>';
    return;
  }

  const oldItems = leaderboardList.querySelectorAll('.leaderboard-item');
  const oldPositions = new Map();
  
  oldItems.forEach((el) => {
    const name = el.getAttribute('data-name');
    if (name) {
      oldPositions.set(name, {
        top: el.getBoundingClientRect().top,
        rank: parseInt(el.getAttribute('data-rank'), 10)
      });
    }
  });

  leaderboardList.innerHTML = data.map((user, index) => `
    <div class="leaderboard-item" data-name="${escapeHtml(user.bakerName)}" data-rank="${index}">
      <span class="leaderboard-rank">#${index + 1}</span>
      <span class="leaderboard-name">${escapeHtml(user.bakerName)}</span>
      <span class="leaderboard-score">${formatNumber(user.stats.breadBakedAllTime)}</span>
    </div>
  `).join('');

  const newItems = leaderboardList.querySelectorAll('.leaderboard-item');
  newItems.forEach((el) => {
    const name = el.getAttribute('data-name');
    const newRank = parseInt(el.getAttribute('data-rank'), 10);
    const oldData = oldPositions.get(name);

    if (oldData) {
      const deltaY = oldData.top - el.getBoundingClientRect().top;
      if (deltaY !== 0) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${deltaY}px)`;
        if (newRank < oldData.rank) el.classList.add('rank-up');

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transition = '';
            el.style.transform = '';
            setTimeout(() => el.classList.remove('rank-up'), 800);
          });
        });
      }
    }
  });
}