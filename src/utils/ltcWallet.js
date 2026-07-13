const bitcore = require('bitcore-lib-ltc');

const FETCH_TIMEOUT_MS = 15_000;
const NETWORK_FEE_SATOSHIS = 10_000; // ~0.0001 LTC

function withToken(url) {
  const token = process.env.BLOCKCYPHER_TOKEN;
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${token}`;
}

// Legacy (L/M), P2SH (3-prefix), or bech32 (ltc1...) addresses.
function isValidLtcAddress(address) {
  return (
    /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(address) ||
    /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
    /^ltc1[a-z0-9]{6,87}$/.test(address)
  );
}

function getBotLtcAddress() {
  const pk = new bitcore.PrivateKey(process.env.LTC_PRIVATE_KEY);
  return pk.toAddress().toString();
}

async function sendLtc(toAddress, amountLtc) {
  const fromAddress = getBotLtcAddress();
  const satoshis = Math.round(amountLtc * 1e8);

  const addrRes = await fetch(
    withToken(`https://api.blockcypher.com/v1/ltc/main/addrs/${fromAddress}?unspentOnly=true`),
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  );
  if (!addrRes.ok) throw new Error(`BlockCypher address lookup failed (${addrRes.status})`);
  const addrData = await addrRes.json();

  const utxos = (addrData.txrefs || []).map(u => new bitcore.Transaction.UnspentOutput({
    txId:        u.tx_hash,
    outputIndex: u.tx_output_n,
    address:     fromAddress,
    script:      bitcore.Script.buildPublicKeyHashOut(new bitcore.Address(fromAddress)).toString(),
    satoshis:    u.value,
  }));
  if (utxos.length === 0) throw new Error('Bot wallet has no spendable UTXOs.');

  const tx = new bitcore.Transaction()
    .from(utxos)
    .to(toAddress, satoshis)
    .change(fromAddress)
    .fee(NETWORK_FEE_SATOSHIS)
    .sign(process.env.LTC_PRIVATE_KEY);

  const txHex = tx.uncheckedSerialize();

  const pushRes = await fetch(withToken('https://api.blockcypher.com/v1/ltc/main/txs/push'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx: txHex }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const pushData = await pushRes.json().catch(() => ({}));
  if (!pushRes.ok) {
    const detail = pushData?.error || (pushData?.errors || []).map(e => e.error || e).join(', ');
    throw new Error(detail || `BlockCypher push failed (${pushRes.status})`);
  }

  return pushData.tx?.hash || pushData.hash;
}

module.exports = { isValidLtcAddress, getBotLtcAddress, sendLtc };
