const redis = require('./redis');
const { DEV_USER_ID } = require('./permissions');

// Alerts the owner (once per guild, not on every failed join) if the bot
// can't read invites there — almost always a missing "Manage Server"
// permission on the bot's role, which otherwise fails completely silently
// (console-only) and looks exactly like "invites just aren't tracking".
const alertedGuilds = new Set();
async function alertInvitePermissionIssue(guild, error) {
  if (alertedGuilds.has(guild.id)) return;
  alertedGuilds.add(guild.id);
  try {
    const owner = await guild.client.users.fetch(DEV_USER_ID);
    await owner.send(
      `⚠️ **Invite tracking is broken in "${guild.name}".**\n` +
      `The bot can't fetch invites there (${error.message}).\n` +
      `Give the bot's role the **Manage Server** permission in that server's Server Settings → Roles, then it should start working without a restart.`
    ).catch(() => {});
  } catch {}
}

// A join only counts once the member has been in the server this long, and
// only if their Discord account was already at least this old *when they
// joined*. Both are heuristics — Discord gives bots no reliable way to prove
// two accounts belong to the same person — but they raise the cost of farming
// invite rewards with disposable/rejoin-spam accounts.
const RETENTION_MS      = 24 * 60 * 60 * 1000;
const ALT_THRESHOLD_MS  = 7 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

// In-memory only: guildId -> Map<inviteCode, { uses, maxUses, inviterId }>
// Rebuilt from Discord on every restart; the durable data lives in Redis.
const inviteCache = new Map();

// Per-guild queue so concurrent joins (e.g. several people arriving via the
// same invite at once) fetch-diff-and-update the invite cache one at a time
// instead of racing on the same read-modify-write and tearing each other's update.
const guildJoinQueues = new Map();

function runExclusive(guildId, task) {
  const prev = guildJoinQueues.get(guildId) || Promise.resolve();
  const run = prev.then(task, task);
  guildJoinQueues.set(guildId, run.then(() => {}, () => {}));
  return run;
}

function snapshotInvites(invites) {
  const map = new Map();
  invites.forEach(inv => {
    map.set(inv.code, { uses: inv.uses, maxUses: inv.maxUses, inviterId: inv.inviter?.id || null });
  });
  return map;
}

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, snapshotInvites(invites));
  } catch (e) {
    console.error(`[invites] Failed to cache invites for ${guild.name}:`, e.message);
    await alertInvitePermissionIssue(guild, e);
  }
}

function noteInviteCreate(invite) {
  if (!invite.guild) return;
  const map = inviteCache.get(invite.guild.id) || new Map();
  map.set(invite.code, { uses: invite.uses || 0, maxUses: invite.maxUses, inviterId: invite.inviter?.id || null });
  inviteCache.set(invite.guild.id, map);
}

function noteInviteDelete(invite) {
  if (!invite.guild) return;
  const map = inviteCache.get(invite.guild.id);
  if (map) map.delete(invite.code);
}

// Stats live in a Redis hash (invitestats:{id}) so concurrent joins/leaves for
// the same inviter increment atomically via HINCRBY instead of racing on a
// read-modify-write of a JSON blob (which drops updates when two land at once).
// One-time lazy migration from the old `invites:{id}` JSON blob format below.
async function ensureStatsMigrated(inviterId) {
  const hashKey = `invitestats:${inviterId}`;
  if (await redis.exists(hashKey)) return;

  const oldRaw = await redis.get(`invites:${inviterId}`);
  if (!oldRaw) return;
  const old = typeof oldRaw === 'string' ? JSON.parse(oldRaw) : oldRaw;
  await redis.hset(hashKey, {
    joins:  old.joins  || 0,
    leaves: old.leaves || 0,
    alts:   old.alts   || 0,
  });
}

async function getInviterStats(inviterId) {
  await ensureStatsMigrated(inviterId);
  const stats   = await redis.hgetall(`invitestats:${inviterId}`);
  const joins   = parseInt(stats?.joins, 10)  || 0;
  const leaves  = Math.max(0, parseInt(stats?.leaves, 10) || 0);
  const alts    = parseInt(stats?.alts, 10)   || 0;
  const claimed = Math.max(0, parseInt(stats?.claimed, 10) || 0);
  const net     = Math.max(0, joins - leaves);

  return { joins, leaves, alts, claimed, net, claimable: Math.max(0, net - claimed) };
}

async function bumpInviterStats(inviterId, deltas) {
  await ensureStatsMigrated(inviterId);
  const hashKey = `invitestats:${inviterId}`;
  for (const [field, delta] of Object.entries(deltas)) {
    if (delta) await redis.hincrby(hashKey, field, delta);
  }
}

// Atomically reserves `count` invites out of an inviter's claimable balance so
// concurrent/duplicate claims (double-clicks, two claim types at once) can't
// spend the same invites twice. Mirrors the discount-code decrement-then-
// rollback-if-invalid pattern used in the cape shop.
async function claimInvites(inviterId, count) {
  await ensureStatsMigrated(inviterId);
  const hashKey = `invitestats:${inviterId}`;
  const newClaimed = await redis.hincrby(hashKey, 'claimed', count);

  const stats = await redis.hgetall(hashKey);
  const joins  = parseInt(stats?.joins, 10)  || 0;
  const leaves = Math.max(0, parseInt(stats?.leaves, 10) || 0);
  const net    = Math.max(0, joins - leaves);

  if (newClaimed > net) {
    await redis.hincrby(hashKey, 'claimed', -count); // roll back — insufficient balance
    return false;
  }
  return true;
}

async function refundInvites(inviterId, count) {
  if (!count) return;
  await redis.hincrby(`invitestats:${inviterId}`, 'claimed', -count);
}

// Diffs the current invite list against the last cached snapshot to figure
// out which invite was used. Falls back to detecting a single-use invite
// that vanished (deleted the instant it hit its use cap).
async function findUsedInviterId(guild) {
  const oldMap = inviteCache.get(guild.id);

  if (!oldMap || oldMap.size === 0) {
    // No reliable baseline to diff against — defaulting every uncached code
    // to "0 uses" here would attribute to whichever invite merely has ANY
    // uses at all (not necessarily the one just used), which can silently
    // misattribute or land on an invite with no inviter (null) forever.
    // Resync now and skip attribution for this one join instead of guessing.
    await cacheGuildInvites(guild);
    return null;
  }

  let newInvites;
  try {
    newInvites = await guild.invites.fetch();
  } catch (e) {
    console.error(`[invites] Could not fetch invites for ${guild.name} (needs Manage Server):`, e.message);
    await alertInvitePermissionIssue(guild, e);
    return null;
  }

  let usedInviterId = null;

  for (const inv of newInvites.values()) {
    // Treat a code we've never cached (e.g. inviteCreate hadn't landed yet) as baseline 0 uses
    const oldUses = oldMap.has(inv.code) ? oldMap.get(inv.code).uses : 0;
    if (inv.uses > oldUses) {
      usedInviterId = inv.inviter?.id || null;
      break;
    }
  }

  if (!usedInviterId) {
    for (const [code, old] of oldMap.entries()) {
      if (!newInvites.has(code) && old.maxUses > 0 && old.uses >= old.maxUses - 1) {
        usedInviterId = old.inviterId;
        break;
      }
    }
  }

  inviteCache.set(guild.id, snapshotInvites(newInvites));
  return usedInviterId;
}

async function handleMemberJoin(member) {
  if (member.user.bot) return;

  // Serialized per guild: concurrent joins must fetch-diff-and-update the
  // invite cache one at a time or they'll race on the same stale snapshot.
  const inviterId = await runExclusive(member.guild.id, () => findUsedInviterId(member.guild));
  if (!inviterId) return; // vanity URL, widget, or couldn't be determined
  if (inviterId === member.id) return; // can't credit yourself

  const joinedId = member.id;
  const existingRaw = await redis.get(`invited_by:${joinedId}`);

  if (existingRaw) {
    // This Discord account already earned its one-time credit before (possibly
    // under a different inviter) — reactivate instantly, no new probation.
    const data = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
    if (data.active) return;

    data.active = true;
    await redis.set(`invited_by:${joinedId}`, JSON.stringify(data));
    await bumpInviterStats(data.inviterId, { leaves: -1 });
    return;
  }

  // Never confirmed before — start (or restart) the 24h/account-age probation.
  // Nothing is counted yet; the sweep below decides once the window passes.
  await redis.set(`pending_join:${joinedId}`, JSON.stringify({
    inviterId,
    joinedAt: Date.now(),
    accountCreatedAt: member.user.createdTimestamp,
    guildId: member.guild.id,
  }));
}

async function handleMemberLeave(member) {
  const userId = member.id;

  const raw = await redis.get(`invited_by:${userId}`);
  if (raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data.active) {
      data.active = false;
      await redis.set(`invited_by:${userId}`, JSON.stringify(data));
      await bumpInviterStats(data.inviterId, { leaves: 1 });
    }
    return;
  }

  // Leaving mid-probation voids the attempt entirely: no join, no leave, no
  // permanent credit — they (or whoever invites them next) can try again later.
  await redis.del(`pending_join:${userId}`);
}

// Runs periodically rather than on a per-join timer so it survives restarts:
// any join still pending after RETENTION_MS gets checked and, if it still
// qualifies, confirmed. Cheap enough at this cadence to just scan all pending keys.
async function sweepPendingJoins(client) {
  const keys = await redis.keys('pending_join:*');
  if (!keys || keys.length === 0) return;

  const now = Date.now();
  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    const pending = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const userId = key.replace('pending_join:', '');

    if (now - pending.joinedAt < RETENTION_MS) continue; // still on probation

    const ageAtJoin = pending.joinedAt - pending.accountCreatedAt;
    if (ageAtJoin < ALT_THRESHOLD_MS) {
      // Disqualified: account was too new when it joined. Tracked for
      // visibility only — it never counts toward the join total.
      await bumpInviterStats(pending.inviterId, { alts: 1 });
      await redis.del(key);
      continue;
    }

    const guild = client.guilds.cache.get(pending.guildId);
    if (!guild) {
      await redis.del(key); // bot no longer in that guild
      continue;
    }

    let member = guild.members.cache.get(userId);
    if (!member) {
      try {
        member = await guild.members.fetch(userId);
      } catch {
        member = null;
      }
    }
    if (!member) {
      // They left (or were removed) before we got to confirm them.
      await redis.del(key);
      continue;
    }

    await redis.set(`invited_by:${userId}`, JSON.stringify({ inviterId: pending.inviterId, active: true }));
    await bumpInviterStats(pending.inviterId, { joins: 1 });
    await redis.del(key);
  }
}

function startPendingJoinSweeper(client) {
  setInterval(() => sweepPendingJoins(client).catch(e => console.error('[invites] Sweep error:', e.message)), SWEEP_INTERVAL_MS);
  console.log('[invites] Pending-join sweeper started.');
}

module.exports = {
  cacheGuildInvites,
  noteInviteCreate,
  noteInviteDelete,
  handleMemberJoin,
  handleMemberLeave,
  getInviterStats,
  bumpInviterStats,
  claimInvites,
  refundInvites,
  sweepPendingJoins,
  startPendingJoinSweeper,
};
