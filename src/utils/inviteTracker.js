const redis = require('./redis');

// Accounts younger than this at join time are flagged as likely alts.
// This is a heuristic (account-age check) — Discord gives bots no reliable
// way to prove two accounts belong to the same person.
const ALT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// In-memory only: guildId -> Map<inviteCode, { uses, maxUses, inviterId }>
// Rebuilt from Discord on every restart; the durable data lives in Redis.
const inviteCache = new Map();

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

async function getInviterStats(inviterId) {
  const raw = await redis.get(`invites:${inviterId}`);
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { joins: 0, leaves: 0, alts: 0 };
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

    const stats = await getInviterStats(data.inviterId);
    stats.leaves = Math.max(0, stats.leaves - 1);
    await redis.set(`invites:${data.inviterId}`, JSON.stringify(stats));
    return;
  }

  const accountAge = Date.now() - member.user.createdTimestamp;
  const isAlt = accountAge < ALT_THRESHOLD_MS;

  await redis.set(`invited_by:${joinedId}`, JSON.stringify({ inviterId, isAlt, active: true }));

  const stats = await getInviterStats(inviterId);
  stats.joins += 1;
  if (isAlt) stats.alts += 1;
  await redis.set(`invites:${inviterId}`, JSON.stringify(stats));
}

async function recordLeave(userId) {
  const raw = await redis.get(`invited_by:${userId}`);
  if (!raw) return;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data.active) return;

  data.active = false;
  await redis.set(`invited_by:${userId}`, JSON.stringify(data));

  const stats = await getInviterStats(data.inviterId);
  stats.leaves += 1;
  await redis.set(`invites:${data.inviterId}`, JSON.stringify(stats));
}

async function handleMemberJoin(member) {
  if (member.user.bot) return;

  const inviterId = await findUsedInviterId(member.guild);
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
