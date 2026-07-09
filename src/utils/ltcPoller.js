const { EmbedBuilder } = require('discord.js');
const redis = require('./redis');

const LOG_CHANNEL_ID = '1524672603585904742';
const POLL_INTERVAL  = 20_000; // 20 seconds
const WIGGLE_LITOSHIS = 50_000; // 0.0005 LTC tolerance

async function getLTCPrice() {
  const cached = await redis.get('ltc:price:cache');
  if (cached) return parseFloat(cached);

  const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd');
  const data = await res.json();
  const price = data.litecoin.usd;
  await redis.set('ltc:price:cache', String(price), { ex: 60 });
  return price;
}

async function getAddressTxs(address) {
  try {
    const res = await fetch(`https://api.blockcypher.com/v1/ltc/main/addrs/${encodeURIComponent(address)}/full?limit=50`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.txs || [];
  } catch {
    return null;
  }
}

async function completePurchase(client, userId, pending, txHash) {
  await redis.set(`ltc:seen:${txHash}`, '1', { ex: 86400 });

  const codes = [];
  for (const item of pending.items) {
    const code = await redis.lpop(`cape:${item.capeId}:codes`);
    if (code) codes.push({ name: item.name, emoji: item.emoji, code });

    const rawCape = await redis.get(`cape:${item.capeId}`);
    if (rawCape) {
      const cape = typeof rawCape === 'string' ? JSON.parse(rawCape) : rawCape;
      cape.stock = Math.max(0, (cape.stock || 1) - 1);
      await redis.set(`cape:${item.capeId}`, JSON.stringify(cape));
    }
    await redis.del(`ltc:lock:${item.capeId}`);
  }

  // DM user
  try {
    const user = await client.users.fetch(userId);
    if (codes.length > 0) {
      const lines = codes.map(c => `${c.emoji} **${c.name}:** \`${c.code}\``).join('\n');
      await user.send(`✅ **Payment confirmed!**\n\nHere are your cape codes:\n\n${lines}`).catch(() => {});
    } else {
      await user.send('✅ Payment confirmed, but no codes were available. Please contact support.').catch(() => {});
    }
  } catch {}

  // Log
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setTitle('💰 Cape Purchase')
      .setColor(0x57F287)
      .addFields(
        { name: 'User',   value: `<@${userId}>`,                                             inline: true  },
        { name: 'Total',  value: `$${pending.totalUSD.toFixed(2)} | ${pending.totalLTC} LTC`, inline: true  },
        { name: 'Items',  value: pending.items.map(i => `${i.emoji} ${i.name}`).join('\n'),   inline: false },
        { name: 'TX',     value: `\`${txHash}\``,                                             inline: false }
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed] }).catch(() => {});
  }

  await redis.del(`ltc:pending:${userId}`);
}

async function checkPendingPayments(client) {
  const ltcAddress = await redis.get('ltc:address');
  if (!ltcAddress) return;

  const keys = await redis.keys('ltc:pending:*');
  if (!keys || keys.length === 0) return;

  const txs = await getAddressTxs(ltcAddress);
  if (!txs) return;

  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;

    const pending = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const userId  = key.replace('ltc:pending:', '');

    // Expired
    if (Date.now() > pending.expiresAt) {
      try {
        const user = await client.users.fetch(userId);
        await user.send('⏰ Your LTC payment window expired. Feel free to try again.').catch(() => {});
      } catch {}
      for (const item of pending.items) await redis.del(`ltc:lock:${item.capeId}`);
      await redis.del(key);
      continue;
    }

    const expectedLitoshis = Math.round(pending.totalLTC * 1e8);

    // Already matched a tx — just check confirmations
    if (pending.detectedTxHash) {
      const tx = txs.find(t => t.hash === pending.detectedTxHash);
      if (tx && (tx.confirmations || 0) >= 1) {
        await completePurchase(client, userId, pending, pending.detectedTxHash);
      }
      continue;
    }

    // Find a matching unprocessed tx
    for (const tx of txs) {
      if (await redis.get(`ltc:seen:${tx.hash}`)) continue;
      if (await redis.get(`ltc:claimed:${tx.hash}`)) continue;

      let matched = false;
      for (const out of (tx.outputs || [])) {
        if (out.addresses && out.addresses.includes(ltcAddress)) {
          if (Math.abs(out.value - expectedLitoshis) <= WIGGLE_LITOSHIS) {
            matched = true;
            break;
          }
        }
      }
      if (!matched) continue;

      // Claim this tx for this user
      await redis.set(`ltc:claimed:${tx.hash}`, userId, { ex: 3600 });

      if ((tx.confirmations || 0) >= 1) {
        await completePurchase(client, userId, pending, tx.hash);
      } else {
        pending.detectedTxHash = tx.hash;
        const ttlSeconds = Math.ceil((pending.expiresAt - Date.now()) / 1000) + 300;
        await redis.set(key, JSON.stringify(pending), { ex: Math.max(ttlSeconds, 60) });
        try {
          const user = await client.users.fetch(userId);
          await user.send('💸 **Payment detected!** Waiting for 1 blockchain confirmation...').catch(() => {});
        } catch {}
      }
      break;
    }
  }
}

function startPoller(client) {
  setInterval(() => checkPendingPayments(client).catch(e => console.error('[LTC Poller]', e.message)), POLL_INTERVAL);
  console.log('[LTC Poller] Started.');
}

module.exports = { startPoller, getLTCPrice };
