const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const redis = require('./redis');

const LOG_CHANNEL_ID = '1524672603585904742';
const POLL_INTERVAL  = 20_000;

function parseEmoji(str) {
  const match = str.match(/^<(a?):([^:]+):(\d+)>$/);
  if (match) return { animated: !!match[1], name: match[2], id: match[3] };
  return str;
}

async function getLTCPrice() {
  const cached = await redis.get('ltc:price:cache');
  if (cached) return parseFloat(cached);

  const apis = [
    async () => {
      const res  = await fetch('https://api.coinbase.com/v2/prices/LTC-USD/spot');
      const data = await res.json();
      return parseFloat(data.data.amount);
    },
    async () => {
      const res  = await fetch('https://min-api.cryptocompare.com/data/price?fsym=LTC&tsyms=USD');
      const data = await res.json();
      return data.USD;
    },
    async () => {
      const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd');
      const data = await res.json();
      return data.litecoin.usd;
    },
  ];

  for (const fn of apis) {
    try {
      const price = await fn();
      if (price && price > 0) {
        await redis.set('ltc:price:cache', String(price), { ex: 60 });
        return price;
      }
    } catch {}
  }

  throw new Error('All LTC price APIs failed');
}

// Defined locally to avoid circular dependency with capeShop.js
async function syncStock(capeId) {
  const raw = await redis.get(`cape:${capeId}`);
  if (!raw) return;
  const cape = typeof raw === 'string' ? JSON.parse(raw) : raw;
  cape.stock = await redis.llen(`cape:${capeId}:codes`);
  await redis.set(`cape:${capeId}`, JSON.stringify(cape));
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

async function updateCapeStockMessage(client) {
  const raw = await redis.get('capestock:message');
  if (!raw) return;

  const { channelId, messageId } = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg) return;

  const capeIds = await redis.smembers('capes');
  if (!capeIds || capeIds.length === 0) return;

  const capes = [];
  for (const id of capeIds) {
    const capeRaw = await redis.get(`cape:${id}`);
    if (!capeRaw) continue;
    const cape  = typeof capeRaw === 'string' ? JSON.parse(capeRaw) : capeRaw;
    cape.stock  = await redis.llen(`cape:${id}:codes`);
    capes.push(cape);
  }

  const embed = new EmbedBuilder()
    .setTitle('🎭 Cape Shop')
    .setDescription('Browse and buy Minecraft capes with LTC.\nSelect a cape from the dropdown below to add it to your cart.')
    .setColor(0x5865F2)
    .addFields(capes.map(c => ({
      name: `${c.emoji} ${c.name}`,
      value: c.stock > 0
        ? `**$${c.price.toFixed(2)}** • ${c.stock} in stock`
        : `**$${c.price.toFixed(2)}** • ~~Out of stock~~`,
      inline: true,
    })))
    .setFooter({ text: 'Payments via LTC • Instant delivery after 1 confirmation' });

  const inStock = capes.filter(c => c.stock > 0);

  if (inStock.length === 0) {
    await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    return;
  }

  const options = [
    ...inStock.map(c => ({
      label: c.name.slice(0, 100),
      description: `$${c.price.toFixed(2)} USD`,
      value: c.id,
      emoji: parseEmoji(c.emoji),
    })),
    { label: 'Leave', description: 'Close this menu', value: 'cape_leave', emoji: '✖️' },
  ];

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cape_shop_select')
      .setPlaceholder('Select a cape to add to your cart...')
      .addOptions(options)
  );

  await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
}

async function completePurchase(client, userId, pending, txHash) {
  await redis.set(`ltc:seen:${txHash}`, '1', { ex: 86400 });

  const codes = pending.reservedCodes || [];

  try {
    const user = await client.users.fetch(userId);
    if (codes.length > 0) {
      const lines = codes.map(c => `${c.emoji} **${c.name}:** \`${c.code}\``).join('\n');
      const instructions = [
        '**How to redeem your cape:**',
        '',
        '**1.** Go to <https://minecraft.net/redeem> and make sure you are logged in with the account you want to claim it on.',
        '',
        '**2.** Type in the code and click next, then click confirm.',
        '',
        '**3.** Go to Minecraft launcher and launch bedrock edition.',
        '',
        '**4.** Go to skin customization and check your capes. Equip the cape, it will automatically sync to java edition after this. (if you don\'t see the cape yet restart the game and make sure you are on the correct account)',
        '',
        '**5.** Open Minecraft launcher and go to skins, click new skin and you should see your cape in there.',
        '',
        '**Note:** sometimes it might take a few minutes for the cape to show up on bedrock edition. Fully restarting Minecraft launcher helps too.',
      ].join('\n');
      await user.send(`✅ **Payment confirmed!**\n\nHere are your cape codes:\n${lines}\n\n${instructions}`).catch(() => {});
    } else {
      await user.send('✅ Payment confirmed! Contact support for your codes.').catch(() => {});
    }
  } catch {}

  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setTitle('💰 Cape Purchase')
      .setColor(0x57F287)
      .addFields(
        { name: 'User',  value: `<@${userId}>`,                                              inline: true  },
        { name: 'Total', value: `$${pending.totalUSD.toFixed(2)} | ${pending.totalLTC} LTC`, inline: true  },
        { name: 'Items', value: pending.items.map(i => `${i.emoji} ${i.name}`).join('\n'),   inline: false },
        { name: 'TX',    value: `\`${txHash}\``,                                             inline: false }
      )
      .setTimestamp();
    await logChannel.send({ embeds: [embed] }).catch(() => {});
  }

  await redis.del(`ltc:pending:${userId}`);
  await updateCapeStockMessage(client);
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

    if (Date.now() > pending.expiresAt && !pending.detectedTxHash) {
      try {
        const user = await client.users.fetch(userId);
        await user.send('⏰ Your LTC payment window expired. Feel free to try again.').catch(() => {});
      } catch {}
      if (pending.reservedCodes) {
        for (const r of pending.reservedCodes) {
          await redis.rpush(`cape:${r.capeId}:codes`, r.code);
          await syncStock(r.capeId);
        }
      }
      await redis.del(key);
      await updateCapeStockMessage(client);
      continue;
    }

    if (pending.detectedTxHash) {
      const tx = txs.find(t => t.hash === pending.detectedTxHash);
      if (tx && (tx.confirmations || 0) >= 1) {
        await completePurchase(client, userId, pending, pending.detectedTxHash);
      }
      continue;
    }

    const expectedLitoshis = Math.round(pending.totalLTC * 1e8);
    const createdAt        = pending.createdAt || (pending.expiresAt - 3 * 60 * 1000);

    for (const tx of txs) {
      if (await redis.get(`ltc:seen:${tx.hash}`)) continue;

      const txTime = tx.received ? new Date(tx.received).getTime() : Date.now();
      if (txTime < createdAt - 60_000) continue;

      const fromBuyer = (tx.inputs || []).some(inp =>
        inp.addresses && inp.addresses.includes(pending.buyerLtcAddress)
      );
      if (!fromBuyer) continue;

      const outputToUs = (tx.outputs || []).find(out =>
        out.addresses && out.addresses.includes(ltcAddress)
      );
      if (!outputToUs) continue;
      if (outputToUs.value < expectedLitoshis * 0.8) continue;

      if ((tx.confirmations || 0) >= 1) {
        await completePurchase(client, userId, pending, tx.hash);
      } else {
        pending.detectedTxHash = tx.hash;
        await redis.set(key, JSON.stringify(pending), { ex: 86400 });
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

module.exports = { startPoller, getLTCPrice, updateCapeStockMessage };
