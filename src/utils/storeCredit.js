const redis = require('./redis');

// Balances are tracked in integer cents, not float dollars, since store
// credit accumulates from many small additions (7.5 cents/invite) and
// floating-point drift would compound over time.

async function getStoreCreditCents(userId) {
  const raw = await redis.get(`storecredit:${userId}`);
  return Math.max(0, parseInt(raw, 10) || 0);
}

async function addStoreCreditCents(userId, cents) {
  if (!cents) return;
  await redis.incrby(`storecredit:${userId}`, cents);
}

// Atomic decrement-then-rollback-if-negative, same pattern as the discount
// code and invite-claim balances, so concurrent checkouts can't double-spend
// the same store credit.
async function spendStoreCreditCents(userId, cents) {
  if (!cents) return true;
  const remaining = await redis.decrby(`storecredit:${userId}`, cents);
  if (remaining < 0) {
    await redis.incrby(`storecredit:${userId}`, cents);
    return false;
  }
  return true;
}

async function getStoreCreditCap() {
  const raw = await redis.get('storecredit:cap');
  return raw == null ? null : Math.max(0, parseInt(raw, 10) || 0);
}

async function setStoreCreditCap(cents) {
  if (cents == null) {
    await redis.del('storecredit:cap');
  } else {
    await redis.set('storecredit:cap', cents);
  }
}

async function getTotalStoreCreditCents() {
  const keys = await redis.keys('storecredit:*');
  let total = 0;
  for (const key of keys || []) {
    if (key === 'storecredit:cap') continue;
    total += Math.max(0, parseInt(await redis.get(key), 10) || 0);
  }
  return total;
}

module.exports = {
  getStoreCreditCents,
  addStoreCreditCents,
  spendStoreCreditCents,
  getStoreCreditCap,
  setStoreCreditCap,
  getTotalStoreCreditCents,
};
