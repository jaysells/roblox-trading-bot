const redis = require('./redis');

// Accounts younger than this at join time are flagged as likely alts.
// This is a heuristic (account-age check) — Discord gives bots no reliable
// way to prove two accounts belong to the same person.
const ALT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

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
  const stats = await redis.hgetall(`invitestats:${inviterId}`);
  return {
    joins:  parseInt(stats?.joins, 10)  || 0,
    leaves: Math.max(0, parseInt(stats?.leaves, 10) || 0),
    alts:   parseInt(stats?.alts, 10)   || 0,
  };
}

async function bumpInviterStats(inviterId, deltas) {
  await ensureStatsMigrated(inviterId);
  const hashKey = `invitestats:${inviterId}`;
  for (const [field, delta] of Object.entries(deltas)) {
    if (delta) await redis.hincrby(hashKey, field, delta);
  }
}

// Diffs the current invite list against the last cached snapshot to figure
// out which invite was used. Falls back to detecting a single-use invite
// that vanished (deleted the instant it hit its use cap).
async function findUsedInviterId(guild) {
  const oldMap = inviteCache.get(guild.id) || new Map();

  let newInvites;
  try {
    newInvites = await guild.invites.fetch();
  } catch (e) {
    console.error(`[invites] Could not fetch invites for ${guild.name} (needs Manage Server):`, e.message);
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

async function recordJoin(inviterId, member) {
  const joinedId = member.id;
  const existingRaw = await redis.get(`invited_by:${joinedId}`);

  if (existingRaw) {
    // This Discord account has already been credited to an inviter before —
    // never count the same user twice, even across leave/rejoin cycles.
    const data = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
    if (data.active) return;

    data.active = true;
    await redis.set(`invited_by:${joinedId}`, JSON.stringify(data));
    await bumpInviterStats(data.inviterId, { leaves: -1 });
    return;
  }

  const accountAge = Date.now() - member.user.createdTimestamp;
  const isAlt = accountAge < ALT_THRESHOLD_MS;

  await redis.set(`invited_by:${joinedId}`, JSON.stringify({ inviterId, isAlt, active: true }));
  await bumpInviterStats(inviterId, { joins: 1, alts: isAlt ? 1 : 0 });
}

async function recordLeave(userId) {
  const raw = await redis.get(`invited_by:${userId}`);
  if (!raw) return;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data.active) return;

  data.active = false;
  await redis.set(`invited_by:${userId}`, JSON.stringify(data));
  await bumpInviterStats(data.inviterId, { leaves: 1 });
}

async function handleMemberJoin(member) {
  if (member.user.bot) return;

  // Serialized per guild: concurrent joins must fetch-diff-and-update the
  // invite cache one at a time or they'll race on the same stale snapshot.
  const inviterId = await runExclusive(member.guild.id, () => findUsedInviterId(member.guild));
  if (!inviterId) return; // vanity URL, widget, or couldn't be determined
  if (inviterId === member.id) return; // can't credit yourself

  await recordJoin(inviterId, member);
}

async function handleMemberLeave(member) {
  await recordLeave(member.id);
}

module.exports = {
  cacheGuildInvites,
  noteInviteCreate,
  noteInviteDelete,
  handleMemberJoin,
  handleMemberLeave,
  getInviterStats,
};
