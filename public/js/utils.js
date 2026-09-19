export function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

export function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/`;
}

export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

/**
 * Calculates the quantity and total cost when buying/selling in batches or max amount.
 * @param {string|number} multiplier - '1', '10', '100', '1000', or 'max'
 * @param {number} availableResource - Current balance (bread for selling, credits for buying)
 * @param {number} unitCost - Base cost per item (e.g. 1 bread per sale, or base cost for upgrades)
 * @returns {{ quantity: number, totalCost: number }}
 */
export function resolveMultiplierQuantity(multiplier, availableResource, unitCost = 1) {
  if (multiplier === 'max') {
    const maxQuantity = Math.floor(availableResource / unitCost);
    return {
      quantity: Math.max(1, maxQuantity),
      totalCost: Math.max(0, maxQuantity * unitCost)
    };
  }

  const targetQuantity = parseInt(multiplier, 10) || 1;
  return {
    quantity: targetQuantity,
    totalCost: targetQuantity * unitCost
  };
}