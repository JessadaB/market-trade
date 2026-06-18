#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const WEBHOOK_PATH = path.join(ROOT, 'URLBot.txt');
const STATE_PATH = path.join(ROOT, '.alert-bot-state.json');
const PAPER_PATH = path.join(ROOT, '.paper-trades.jsonl');
const BINANCE = 'https://fapi.binance.com';

const CFG = {
  tf: process.env.ALERT_TF || '5m',
  minScore: Number(process.env.ALERT_MIN_SCORE || 14),
  scanMs: Number(process.env.ALERT_SCAN_MS || 60_000),
  dedupeMs: Number(process.env.ALERT_DEDUPE_MS || 10 * 60_000),
  port: Number(process.env.PORT || process.env.ALERT_PORT || 8787),
  dryRun: process.env.DRY_RUN === '1',
  once: process.argv.includes('--once'),
  aiProvider: (process.env.AI_PROVIDER || 'none').toLowerCase(),
  aiMode: (process.env.AI_MODE || 'alert_only').toLowerCase(),
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  openaiReviewModel: process.env.OPENAI_REVIEW_MODEL || 'gpt-5.5',
  aiMinConfidence: Number(process.env.AI_MIN_CONFIDENCE || 7),
  aiOnlyWhenScoreGte: Number(process.env.AI_ONLY_WHEN_SCORE_GTE || 14),
  aiReviewWhenScoreGte: Number(process.env.AI_REVIEW_WHEN_SCORE_GTE || 16),
  requireAiConfirm: process.env.REQUIRE_AI_CONFIRM === 'true',
  autoTrade: process.env.AUTO_TRADE === 'true',
  maxUsdtPerTrade: Number(process.env.MAX_USDT_PER_TRADE || 5),
  maxLeverage: Number(process.env.MAX_LEVERAGE || 5),
  maxDailyTrades: Number(process.env.MAX_DAILY_TRADES || 3),
  maxDailyLossUsdt: Number(process.env.MAX_DAILY_LOSS_USDT || 10),
  obsidianJournalDir: process.env.OBSIDIAN_JOURNAL_DIR || '',
  timingGuard: process.env.TIMING_GUARD !== 'false',
  timingFastTf: process.env.TIMING_FAST_TF || '5m',
  timingSlowTf: process.env.TIMING_SLOW_TF || '15m',
  maxEntryDriftPct: Number(process.env.MAX_ENTRY_DRIFT_PCT || 0.7),
  maxSignalAgeCandles: Number(process.env.MAX_SIGNAL_AGE_CANDLES || 8),
  minFlowBias: Number(process.env.MIN_FLOW_BIAS || 0.52),
  minRiskReward: Number(process.env.MIN_RISK_REWARD || 2)
};

const COINS = [
  { sym: 'BTCUSDT', label: 'BTC', cat: 'core' },
  { sym: 'ETHUSDT', label: 'ETH', cat: 'core' },
  { sym: 'SOLUSDT', label: 'SOL', cat: 'core' },
  { sym: 'BNBUSDT', label: 'BNB', cat: 'core' },
  { sym: 'XRPUSDT', label: 'XRP', cat: 'core' },
  { sym: 'ADAUSDT', label: 'ADA', cat: 'core' },
  { sym: 'AVAXUSDT', label: 'AVAX', cat: 'l1' },
  { sym: 'SUIUSDT', label: 'SUI', cat: 'l1' },
  { sym: 'APTUSDT', label: 'APT', cat: 'l1' },
  { sym: 'TONUSDT', label: 'TON', cat: 'l1' },
  { sym: 'NEARUSDT', label: 'NEAR', cat: 'l1' },
  { sym: 'INJUSDT', label: 'INJ', cat: 'l1' },
  { sym: 'SEIUSDT', label: 'SEI', cat: 'l1' },
  { sym: 'DOTUSDT', label: 'DOT', cat: 'l1' },
  { sym: 'ATOMUSDT', label: 'ATOM', cat: 'l1' },
  { sym: 'ICPUSDT', label: 'ICP', cat: 'l1' },
  { sym: 'ARBUSDT', label: 'ARB', cat: 'l2' },
  { sym: 'OPUSDT', label: 'OP', cat: 'l2' },
  { sym: 'STRKUSDT', label: 'STRK', cat: 'l2' },
  { sym: 'MANTAUSDT', label: 'MANTA', cat: 'l2' },
  { sym: 'POLUSDT', label: 'POL', cat: 'l2' },
  { sym: 'DOGEUSDT', label: 'DOGE', cat: 'meme' },
  { sym: '1000PEPEUSDT', label: 'PEPE', cat: 'meme' },
  { sym: 'WIFUSDT', label: 'WIF', cat: 'meme' },
  { sym: '1000BONKUSDT', label: 'BONK', cat: 'meme' },
  { sym: 'POPCATUSDT', label: 'POPCAT', cat: 'meme' },
  { sym: 'TRUMPUSDT', label: 'TRUMP', cat: 'meme' },
  { sym: '1000SHIBUSDT', label: 'SHIB', cat: 'meme' },
  { sym: '1000FLOKIUSDT', label: 'FLOKI', cat: 'meme' },
  { sym: 'BOMEUSDT', label: 'BOME', cat: 'meme' },
  { sym: 'NOTUSDT', label: 'NOT', cat: 'meme' },
  { sym: 'LINKUSDT', label: 'LINK', cat: 'defi' },
  { sym: 'UNIUSDT', label: 'UNI', cat: 'defi' },
  { sym: 'AAVEUSDT', label: 'AAVE', cat: 'defi' },
  { sym: 'ONDOUSDT', label: 'ONDO', cat: 'defi' },
  { sym: 'ENAUSDT', label: 'ENA', cat: 'defi' },
  { sym: 'PENDLEUSDT', label: 'PENDLE', cat: 'defi' },
  { sym: 'RUNEUSDT', label: 'RUNE', cat: 'defi' },
  { sym: 'FETUSDT', label: 'FET', cat: 'defi' },
  { sym: 'RENDERUSDT', label: 'RNDR', cat: 'defi' },
  { sym: 'JUPUSDT', label: 'JUP', cat: 'defi' },
  { sym: 'WLDUSDT', label: 'WLD', cat: 'ai' },
  { sym: 'TAOUSDT', label: 'TAO', cat: 'ai' },
  { sym: 'TIAUSDT', label: 'TIA', cat: 'modular' },
  { sym: 'PYTHUSDT', label: 'PYTH', cat: 'oracle' },
  { sym: 'LTCUSDT', label: 'LTC', cat: 'major' },
  { sym: 'BCHUSDT', label: 'BCH', cat: 'major' },
  { sym: 'ORDIUSDT', label: 'ORDI', cat: 'major' },
  { sym: 'ETCUSDT', label: 'ETC', cat: 'major' },
  { sym: 'FILUSDT', label: 'FIL', cat: 'major' },
  { sym: 'PAXGUSDT', label: 'PAXG', cat: 'gold' }
];

const bot = {
  running: false,
  scanning: false,
  startedAt: Date.now(),
  lastScanAt: 0,
  nextScanAt: 0,
  lastError: '',
  lastMessage: '',
  lastHits: [],
  lastSent: {},
  totalScans: 0,
  totalAlerts: 0,
  totalPaperTrades: 0,
  webhookLoaded: false
};

function fP(n, max = 6) {
  if (!Number.isFinite(n)) return '-';
  if (Math.abs(n) >= 1000) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toFixed(max);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readState() {
  try {
    const parsed = JSON.parse(await fs.readFile(STATE_PATH, 'utf8'));
    if (parsed && typeof parsed.lastSent === 'object') bot.lastSent = parsed.lastSent;
  } catch (_) {}
}

async function writeState() {
  const data = JSON.stringify({ lastSent: bot.lastSent, updatedAt: Date.now() }, null, 2);
  await fs.writeFile(STATE_PATH, data);
}

async function readWebhook() {
  const envUrl = (process.env.DISCORD_WEBHOOK || '').trim();
  if (/^https:\/\/discord\.com\/api\/webhooks\//.test(envUrl)) {
    bot.webhookLoaded = true;
    return envUrl;
  }
  const raw = await fs.readFile(WEBHOOK_PATH, 'utf8');
  const url = raw.trim().split(/\s+/).find(v => /^https:\/\/discord\.com\/api\/webhooks\//.test(v));
  if (!url) throw new Error('Set DISCORD_WEBHOOK or put a Discord webhook URL in URLBot.txt');
  bot.webhookLoaded = true;
  return url;
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

async function fetchCandles(sym, interval = CFG.tf, limit = 160) {
  const qs = new URLSearchParams({ symbol: sym, interval, limit: String(limit) });
  const rows = await fetchJson(`${BINANCE}/fapi/v1/klines?${qs}`);
  return rows.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], tb: +k[9] || 0 }));
}

function calcEMA(d, p) {
  const k = 2 / (p + 1);
  let e = d[0];
  return d.map((v, i) => i === 0 ? e : (e = v * k + e * (1 - k)));
}

function calcRSI(c, p = 14) {
  if (c.length < p + 1) return 50;
  let ag = 0, al = 0;
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1];
    d > 0 ? ag += d : al += Math.abs(d);
  }
  ag /= p;
  al /= p;
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p;
    al = (al * (p - 1) + (d < 0 ? Math.abs(d) : 0)) / p;
  }
  return al === 0 ? 100 : 100 - (100 / (1 + ag / al));
}

function calcMACD(c, f = 12, sl = 26, sig = 9) {
  const ef = calcEMA(c, f), es = calcEMA(c, sl);
  const macd = ef.map((v, i) => v - es[i]);
  const signal = calcEMA(macd, sig);
  return { macd, signal, hist: macd.map((v, i) => v - signal[i]) };
}

function calcBB(c, p = 20, m = 2) {
  return c.map((_, i) => {
    if (i < p - 1) return null;
    const sl = c.slice(i - p + 1, i + 1);
    const mid = sl.reduce((a, b) => a + b, 0) / p;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - mid) ** 2, 0) / p);
    return { mid, upper: mid + m * std, lower: mid - m * std };
  });
}

function calcStoch(candles, kp = 14, dp = 3) {
  const k = candles.map((_, i) => {
    if (i < kp - 1) return 50;
    const sl = candles.slice(i - kp + 1, i + 1);
    const hi = Math.max(...sl.map(c => c.h)), lo = Math.min(...sl.map(c => c.l));
    return hi === lo ? 50 : ((candles[i].c - lo) / (hi - lo)) * 100;
  });
  return { k, d: calcEMA(k, dp) };
}

function calcATR(candles, p = 14) {
  if (candles.length < p + 1) return 0;
  const trs = candles.map((c, i) => i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c)));
  let atr = trs.slice(1, p + 1).reduce((a, b) => a + b, 0) / p;
  for (let i = p + 1; i < trs.length; i++) atr = (atr * (p - 1) + trs[i]) / p;
  return atr;
}

function calcVWAP(candles, p = 20) {
  const r = candles.slice(-p);
  let pv = 0, v = 0;
  r.forEach(c => {
    const tp = (c.h + c.l + c.c) / 3;
    pv += tp * c.v;
    v += c.v;
  });
  return v ? pv / v : candles[candles.length - 1]?.c || 0;
}

function calcADX(candles, p = 14) {
  if (candles.length < p + 2) return { adx: 0, plus: 0, minus: 0 };
  const trs = [], pdm = [], mdm = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], pr = candles[i - 1];
    const up = c.h - pr.h, down = pr.l - c.l;
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - pr.c), Math.abs(c.l - pr.c)));
    pdm.push(up > down && up > 0 ? up : 0);
    mdm.push(down > up && down > 0 ? down : 0);
  }
  let tr = trs.slice(0, p).reduce((a, b) => a + b, 0);
  let plus = pdm.slice(0, p).reduce((a, b) => a + b, 0);
  let minus = mdm.slice(0, p).reduce((a, b) => a + b, 0);
  const dx = [];
  for (let i = p; i < trs.length; i++) {
    tr = tr - tr / p + trs[i];
    plus = plus - plus / p + pdm[i];
    minus = minus - minus / p + mdm[i];
    const pdi = tr ? 100 * (plus / tr) : 0, mdi = tr ? 100 * (minus / tr) : 0;
    dx.push((pdi + mdi) ? 100 * Math.abs(pdi - mdi) / (pdi + mdi) : 0);
  }
  const adx = dx.length ? dx.slice(-p).reduce((a, b) => a + b, 0) / Math.min(p, dx.length) : 0;
  return { adx, plus: tr ? 100 * (plus / tr) : 0, minus: tr ? 100 * (minus / tr) : 0 };
}

function calcCCI(candles, p = 20) {
  if (candles.length < p) return 0;
  const tps = candles.slice(-p).map(c => (c.h + c.l + c.c) / 3);
  const ma = tps.reduce((a, b) => a + b, 0) / p;
  const md = tps.reduce((a, b) => a + Math.abs(b - ma), 0) / p;
  return md ? (tps[tps.length - 1] - ma) / (0.015 * md) : 0;
}

function calcMFI(candles, p = 14) {
  if (candles.length < p + 1) return 50;
  let pos = 0, neg = 0;
  for (let i = candles.length - p; i < candles.length; i++) {
    const tp = (candles[i].h + candles[i].l + candles[i].c) / 3;
    const pp = (candles[i - 1].h + candles[i - 1].l + candles[i - 1].c) / 3;
    const mf = tp * candles[i].v;
    if (tp > pp) pos += mf;
    else if (tp < pp) neg += mf;
  }
  return neg === 0 ? 100 : 100 - (100 / (1 + pos / neg));
}

function calcDonchian(candles, p = 20) {
  if (candles.length < p + 1) return { hi: 0, lo: 0, mid: 0 };
  const r = candles.slice(-p - 1, -1);
  const hi = Math.max(...r.map(c => c.h)), lo = Math.min(...r.map(c => c.l));
  return { hi, lo, mid: (hi + lo) / 2 };
}

function detectOB(candles) {
  if (candles.length < 8) return null;
  const r = candles.slice(-25);
  for (let i = r.length - 1; i >= 4; i--) {
    let run = 0, j = i;
    while (j >= 0 && r[j].c > r[j].o) { run++; j--; }
    if (run >= 3 && j >= 0 && r[j].c < r[j].o) return { type: 'bull', hi: r[j].h, lo: r[j].l };
    run = 0;
    j = i;
    while (j >= 0 && r[j].c < r[j].o) { run++; j--; }
    if (run >= 3 && j >= 0 && r[j].c > r[j].o) return { type: 'bear', hi: r[j].h, lo: r[j].l };
  }
  return null;
}

function detectPattern(candles) {
  if (candles.length < 2) return null;
  const c = candles[candles.length - 1], p = candles[candles.length - 2];
  const cB = Math.abs(c.c - c.o), pB = Math.abs(p.c - p.o);
  const cU = c.c > c.o, pU = p.c > p.o;
  const cLo = Math.min(c.o, c.c) - c.l, cHi = c.h - Math.max(c.o, c.c);
  if (cU && !pU && c.c >= p.o && c.o <= p.c && cB > pB * 0.8) return 'BULL_ENG';
  if (!cU && pU && c.c <= p.o && c.o >= p.c && cB > pB * 0.8) return 'BEAR_ENG';
  if (cLo > cB * 1.8 && cHi < cB * 0.6) return 'HAMMER';
  if (cHi > cB * 1.8 && cLo < cB * 0.6) return 'SHOOT';
  return null;
}

function trendStr(candles) {
  if (candles.length < 12) return 'NEUTRAL';
  const r = candles.slice(-12);
  const h1 = Math.max(...r.slice(0, 6).map(c => c.h)), h2 = Math.max(...r.slice(6).map(c => c.h));
  const l1 = Math.min(...r.slice(0, 6).map(c => c.l)), l2 = Math.min(...r.slice(6).map(c => c.l));
  if (h2 > h1 && l2 > l1) return 'UPTREND';
  if (h2 < h1 && l2 < l1) return 'DOWNTREND';
  return 'NEUTRAL';
}

function detectSignal(candles) {
  if (candles.length < 55) return { type: 'NEUTRAL', score: 0, total: 20, indicators: [] };
  const closes = candles.map(c => c.c);
  const e9 = calcEMA(closes, 9), e21 = calcEMA(closes, 21), e50 = calcEMA(closes, 50);
  const rsi = calcRSI(closes, 14);
  const { macd, signal: ms, hist } = calcMACD(closes);
  const bb = calcBB(closes, 20, 2);
  const { k: sk, d: sd } = calcStoch(candles, 14, 3);
  const pat = detectPattern(candles);
  const tr = trendStr(candles);
  const ob = detectOB(candles);
  const vwap = calcVWAP(candles, 20);
  const adx = calcADX(candles, 14);
  const cci = calcCCI(candles, 20);
  const mfi = calcMFI(candles, 14);
  const mfiPrev = calcMFI(candles.slice(0, -1), 14);
  const don = calcDonchian(candles, 20);
  const E9 = e9[e9.length - 1], E21 = e21[e21.length - 1], E50 = e50[e50.length - 1];
  const pr = closes[closes.length - 1], prP = closes[closes.length - 2];
  const bbL = bb[bb.length - 1];
  const K = sk[sk.length - 1], D = sd[sd.length - 1], Kp = sk[sk.length - 2], Dp = sd[sd.length - 2];
  const mN = macd[macd.length - 1], sN = ms[ms.length - 1], hN = hist[hist.length - 1], hP = hist[hist.length - 2];
  const obIn = ob && pr >= ob.lo && pr <= ob.hi;

  const I = [];
  const eBull = E9 > E21 && E21 > E50, eBear = E9 < E21 && E21 < E50;
  I.push({ name: 'EMA', bull: eBull ? 2 : 0, bear: eBear ? 2 : 0, pts: 2 });
  const rBull = rsi > 55 && rsi < 80, rBear = rsi < 45 && rsi > 20;
  I.push({ name: 'RSI', bull: rBull ? 2 : 0, bear: rBear ? 2 : 0, pts: 2 });
  const pAb = pr > E9 && pr > E21 && pr > E50, pBl = pr < E9 && pr < E21 && pr < E50;
  I.push({ name: 'Price', bull: pAb ? 1 : 0, bear: pBl ? 1 : 0, pts: 1 });
  const mBull = mN > sN && hN > hP, mBear = mN < sN && hN < hP;
  I.push({ name: 'MACD', bull: mBull ? 2 : 0, bear: mBear ? 2 : 0, pts: 2 });
  const vols = candles.map(c => c.v), avgV = vols.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const vAb = vols[vols.length - 1] > avgV;
  I.push({ name: 'Volume', bull: vAb && pr >= prP ? 1 : 0, bear: vAb && pr < prP ? 1 : 0, pts: 1 });
  I.push({ name: 'BB', bull: bbL && pr > bbL.mid ? 1 : 0, bear: bbL && pr < bbL.mid ? 1 : 0, pts: 1 });
  I.push({ name: 'Stoch', bull: K > D && Kp <= Dp && K < 80 ? 1 : 0, bear: K < D && Kp >= Dp && K > 20 ? 1 : 0, pts: 1 });
  I.push({ name: 'Pattern', bull: pat === 'BULL_ENG' || pat === 'HAMMER' ? 1 : 0, bear: pat === 'BEAR_ENG' || pat === 'SHOOT' ? 1 : 0, pts: 1 });
  I.push({ name: 'Trend', bull: tr === 'UPTREND' ? 1 : 0, bear: tr === 'DOWNTREND' ? 1 : 0, pts: 1 });
  I.push({ name: 'OB Zone', bull: ob && ob.type === 'bull' && obIn ? 2 : 0, bear: ob && ob.type === 'bear' && obIn ? 2 : 0, pts: 2 });
  I.push({ name: 'VWAP', bull: pr > vwap && vwap > E21 ? 1 : 0, bear: pr < vwap && vwap < E21 ? 1 : 0, pts: 1 });
  I.push({ name: 'ADX', bull: adx.adx > 20 && adx.plus > adx.minus ? 2 : 0, bear: adx.adx > 20 && adx.minus > adx.plus ? 2 : 0, pts: 2 });
  I.push({ name: 'CCI', bull: cci > 100 ? 1 : 0, bear: cci < -100 ? 1 : 0, pts: 1 });
  I.push({ name: 'MFI', bull: mfi > 50 && mfi < 85 && mfi > mfiPrev ? 1 : 0, bear: mfi < 50 && mfi > 15 && mfi < mfiPrev ? 1 : 0, pts: 1 });
  I.push({ name: 'Donch', bull: pr > don.hi ? 1 : 0, bear: pr < don.lo ? 1 : 0, pts: 1 });

  const bullTotal = I.reduce((s, i) => s + i.bull, 0);
  const bearTotal = I.reduce((s, i) => s + i.bear, 0);
  let type = 'NEUTRAL', score = 0;
  if (bullTotal >= 6 && bullTotal > bearTotal) {
    type = 'LONG';
    score = bullTotal;
  } else if (bearTotal >= 6 && bearTotal > bullTotal) {
    type = 'SHORT';
    score = bearTotal;
  }
  const strength = score >= 17 ? 'Very Strong' : score >= 13 ? 'Strong' : score >= 9 ? 'Moderate' : score >= 6 ? 'Weak' : 'None';
  return { type, score, total: 20, bullTotal, bearTotal, strength, indicators: I, rsi, atr: calcATR(candles, 14) };
}

function pct(a, b) {
  return b ? ((a - b) / b) * 100 : 0;
}

function flowStats(candles, lookback = 5) {
  const recent = candles.slice(-lookback);
  const prev = candles.slice(-lookback * 2, -lookback);
  const sum = (arr, key) => arr.reduce((s, c) => s + Number(c[key] || 0), 0);
  const vol = sum(recent, 'v');
  const buy = sum(recent, 'tb');
  const prevVol = sum(prev, 'v');
  const prevBuy = sum(prev, 'tb');
  const buyRatio = vol ? buy / vol : 0.5;
  const prevBuyRatio = prevVol ? prevBuy / prevVol : 0.5;
  const sellRatio = 1 - buyRatio;
  const avg20 = candles.slice(-25, -5).reduce((s, c) => s + Number(c.v || 0), 0) / Math.max(1, Math.min(20, candles.length - 5));
  return {
    buyRatio,
    sellRatio,
    buyRatioChange: buyRatio - prevBuyRatio,
    volumeChangePct: avg20 ? ((vol / lookback - avg20) / avg20) * 100 : 0
  };
}

function findSignalOrigin(candles, type, minScore) {
  const start = Math.max(55, candles.length - 18);
  let origin = null;
  for (let i = start; i < candles.length; i++) {
    const sig = detectSignal(candles.slice(0, i + 1));
    const score = sig.type === 'LONG' ? sig.bullTotal : sig.type === 'SHORT' ? sig.bearTotal : 0;
    if (sig.type === type && score >= minScore) {
      origin = { idx: i, price: candles[i].c, time: candles[i].t, score };
      break;
    }
  }
  const last = candles[candles.length - 1];
  return origin || { idx: candles.length - 1, price: last?.c || 0, time: last?.t || 0, score: 0 };
}

function timingForCandles(candles, type, minScore) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 4] || candles[candles.length - 2] || last;
  const origin = findSignalOrigin(candles, type, minScore);
  const flow = flowStats(candles, 5);
  const currentPrice = last?.c || 0;
  const rawMovePct = pct(currentPrice, origin.price);
  const directionalMovePct = type === 'LONG' ? rawMovePct : -rawMovePct;
  const recentMovePct = type === 'LONG' ? pct(currentPrice, prev?.c || currentPrice) : -pct(currentPrice, prev?.c || currentPrice);
  const ageCandles = Math.max(0, candles.length - 1 - origin.idx);
  const flowAligned = type === 'LONG' ? flow.buyRatio >= CFG.minFlowBias : flow.sellRatio >= CFG.minFlowBias;
  const lateByDrift = directionalMovePct > CFG.maxEntryDriftPct;
  const stale = ageCandles > CFG.maxSignalAgeCandles && Math.abs(recentMovePct) < 0.12;
  return {
    startPrice: origin.price,
    currentPrice,
    startTime: origin.time,
    ageCandles,
    rawMovePct,
    directionalMovePct,
    recentMovePct,
    buyRatio: flow.buyRatio,
    sellRatio: flow.sellRatio,
    buyRatioChange: flow.buyRatioChange,
    volumeChangePct: flow.volumeChangePct,
    flowAligned,
    lateByDrift,
    stale,
    ok: flowAligned && !lateByDrift && !stale
  };
}

async function attachTimingContext(hit, mainCandles) {
  const fastCandles = CFG.timingFastTf === CFG.tf ? mainCandles : await fetchCandles(hit.sym, CFG.timingFastTf, 160);
  const slowCandles = CFG.timingSlowTf === CFG.tf ? mainCandles : await fetchCandles(hit.sym, CFG.timingSlowTf, 160);
  const main = timingForCandles(mainCandles, hit.type, CFG.minScore);
  const fast = timingForCandles(fastCandles, hit.type, CFG.minScore);
  const slow = timingForCandles(slowCandles, hit.type, Math.max(6, CFG.minScore - 2));
  const guardReasons = [];
  if (fast.lateByDrift) guardReasons.push(`${CFG.timingFastTf} drift ${fast.directionalMovePct.toFixed(2)}% > ${CFG.maxEntryDriftPct}%`);
  if (!fast.flowAligned) guardReasons.push(`${CFG.timingFastTf} flow not aligned buy ${(fast.buyRatio * 100).toFixed(0)}% sell ${(fast.sellRatio * 100).toFixed(0)}%`);
  if (slow.lateByDrift) guardReasons.push(`${CFG.timingSlowTf} drift ${slow.directionalMovePct.toFixed(2)}% > ${CFG.maxEntryDriftPct}%`);
  if (!slow.flowAligned) guardReasons.push(`${CFG.timingSlowTf} flow not aligned buy ${(slow.buyRatio * 100).toFixed(0)}% sell ${(slow.sellRatio * 100).toFixed(0)}%`);
  if (fast.stale) guardReasons.push(`${CFG.timingFastTf} signal stale ${fast.ageCandles} candles`);
  hit.timing = {
    main,
    fast,
    slow,
    guardApproved: !guardReasons.length,
    guardReasons
  };
  return hit;
}

function riskReward(entry, stop, target, side) {
  const risk = Math.abs(entry - stop);
  const reward = side === 'LONG' ? target - entry : entry - target;
  return risk > 0 ? reward / risk : 0;
}

function validatePredictionLevels(hit) {
  if (!hit.ai || hit.ai.skipped) return;
  const entry = Number(hit.ai.entry || hit.price);
  const sl = Number(hit.ai.stop_loss || 0);
  const tp = Number(hit.ai.take_profit_2 || hit.ai.take_profit_1 || 0);
  const reasons = [];
  if (!entry || !sl || !tp) reasons.push('missing entry/sl/tp');
  if (hit.type === 'LONG') {
    if (sl >= entry) reasons.push('LONG SL must be below entry');
    if (tp <= entry) reasons.push('LONG TP must be above entry');
  } else if (hit.type === 'SHORT') {
    if (sl <= entry) reasons.push('SHORT SL must be above entry');
    if (tp >= entry) reasons.push('SHORT TP must be below entry');
  }
  const rr = riskReward(entry, sl, tp, hit.type);
  if (rr < CFG.minRiskReward) reasons.push(`RR ${rr.toFixed(2)} < ${CFG.minRiskReward}`);
  hit.ai.rr = rr;
  if (reasons.length) {
    hit.ai.approved = false;
    hit.ai.reason = `${hit.ai.reason || ''} | level guard: ${reasons.join(', ')}`.trim();
    hit.ai.levelGuardReasons = reasons;
  }
}

function hitLine(hit) {
  const ai = hit.ai ? ` AI:${hit.ai.approved ? 'OK' : 'NO'} ${hit.ai.confidence || '-'}/10` : '';
  const timing = hit.timing ? ` Drift:${hit.timing.fast.directionalMovePct.toFixed(2)}% Flow:${(hit.timing.fast.buyRatio * 100).toFixed(0)}/${(hit.timing.fast.sellRatio * 100).toFixed(0)}` : '';
  return `${hit.type.padEnd(5)} ${hit.sym.padEnd(14)} ${fP(hit.price).padStart(12)} ${String(hit.score + '/20').padEnd(6)} ${hit.strength.padEnd(11)} [${hit.cat}]${timing}${ai}`;
}

function aiEnabled() {
  return CFG.aiProvider === 'openai' && !!process.env.OPENAI_API_KEY && CFG.aiMode !== 'off' && CFG.aiMode !== 'none';
}

function activeIndicators(hit) {
  return (hit.indicators || [])
    .filter(ind => hit.type === 'LONG' ? ind.bull > 0 : ind.bear > 0)
    .map(ind => `${ind.name}:${hit.type === 'LONG' ? ind.bull : ind.bear}/${ind.pts}`)
    .join(', ');
}

function buildAIDecisionPrompt(hit, review = false) {
  return `You are a strict crypto futures risk manager. Decide if this Binance Futures signal is allowed.

Return ONLY valid JSON:
{"approved":true,"confidence":1-10,"side":"LONG|SHORT|NEUTRAL","reason":"short reason","entry":number,"stop_loss":number,"take_profit_1":number,"take_profit_2":number,"take_profit_3":number,"risk_notes":"short risk note"}

Rules:
- Approve only if side matches the signal.
- Confidence must reflect signal quality, not profit desire.
- Always provide stop_loss and take_profit levels.
- Reject if risk/reward is poor, trend is unclear, or signal is overextended.
- This is ${review ? 'a second high-score review' : 'the first AI confirmation'}.

Signal:
Symbol: ${hit.sym}
Category: ${hit.cat}
Timeframe: ${CFG.tf}
Side: ${hit.type}
Price: ${hit.price}
Score: ${hit.score}/20
Strength: ${hit.strength}
RSI: ${hit.rsi?.toFixed?.(1) || '?'}
ATR: ${hit.atr || '?'}
Active indicators: ${activeIndicators(hit) || 'none'}
Timing:
- ${CFG.timingFastTf} signal start: ${hit.timing?.fast?.startPrice || '?'} -> now ${hit.timing?.fast?.currentPrice || '?'} | directional drift ${hit.timing?.fast?.directionalMovePct?.toFixed?.(2) || '?'}% | age ${hit.timing?.fast?.ageCandles ?? '?'} candles
- ${CFG.timingFastTf} buy/sell flow: buy ${(Number(hit.timing?.fast?.buyRatio || 0.5) * 100).toFixed(1)}% / sell ${(Number(hit.timing?.fast?.sellRatio || 0.5) * 100).toFixed(1)}% | volume change ${hit.timing?.fast?.volumeChangePct?.toFixed?.(1) || '?'}%
- ${CFG.timingSlowTf} signal start: ${hit.timing?.slow?.startPrice || '?'} -> now ${hit.timing?.slow?.currentPrice || '?'} | directional drift ${hit.timing?.slow?.directionalMovePct?.toFixed?.(2) || '?'}% | age ${hit.timing?.slow?.ageCandles ?? '?'} candles
- ${CFG.timingSlowTf} buy/sell flow: buy ${(Number(hit.timing?.slow?.buyRatio || 0.5) * 100).toFixed(1)}% / sell ${(Number(hit.timing?.slow?.sellRatio || 0.5) * 100).toFixed(1)}% | volume change ${hit.timing?.slow?.volumeChangePct?.toFixed?.(1) || '?'}%
- Timing guard: ${hit.timing?.guardApproved ? 'PASS' : 'FAIL'} ${hit.timing?.guardReasons?.join('; ') || ''}
Max USDT per trade: ${CFG.maxUsdtPerTrade}
Max leverage: ${CFG.maxLeverage}
Minimum RR using TP2: ${CFG.minRiskReward}`;
}

async function callOpenAIDecision(hit, model, review = false) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      instructions: 'Return only valid JSON. No markdown fences. No extra text.',
      input: buildAIDecisionPrompt(hit, review),
      max_output_tokens: 700
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 180)}`);
  const data = JSON.parse(text);
  const output = data.output_text || (data.output || []).flatMap(o => o.content || []).map(c => c.text || '').join('');
  const parsed = JSON.parse(output.replace(/```json|```/g, '').trim());
  parsed.model = model;
  return parsed;
}

async function applyAIConfirm(hit) {
  if (CFG.timingGuard && hit.timing && !hit.timing.guardApproved) {
    hit.ai = { approved: false, skipped: true, confidence: 0, reason: `Timing guard failed: ${hit.timing.guardReasons.join('; ')}` };
    return hit;
  }
  if (!aiEnabled() || hit.score < CFG.aiOnlyWhenScoreGte) {
    hit.ai = { approved: true, skipped: true, confidence: null, reason: aiEnabled() ? 'Below AI threshold' : 'AI disabled' };
    return hit;
  }
  try {
    const first = await callOpenAIDecision(hit, CFG.openaiModel, false);
    let approved = first.approved === true && first.side === hit.type && Number(first.confidence || 0) >= CFG.aiMinConfidence;
    const decisions = [first];
    if (approved && hit.score >= CFG.aiReviewWhenScoreGte && CFG.openaiReviewModel) {
      const review = await callOpenAIDecision(hit, CFG.openaiReviewModel, true);
      decisions.push(review);
      approved = review.approved === true && review.side === hit.type && Number(review.confidence || 0) >= CFG.aiMinConfidence;
    }
    hit.ai = {
      approved,
      confidence: Number(decisions[decisions.length - 1].confidence || 0),
      side: decisions[decisions.length - 1].side || 'NEUTRAL',
      reason: decisions.map(d => `${d.model}: ${d.reason || ''}`).join(' | '),
      entry: Number(decisions[decisions.length - 1].entry || hit.price),
      stop_loss: Number(decisions[decisions.length - 1].stop_loss || 0),
      take_profit_1: Number(decisions[decisions.length - 1].take_profit_1 || 0),
      take_profit_2: Number(decisions[decisions.length - 1].take_profit_2 || 0),
      take_profit_3: Number(decisions[decisions.length - 1].take_profit_3 || 0),
      risk_notes: decisions[decisions.length - 1].risk_notes || '',
      decisions
    };
  } catch (err) {
    hit.ai = { approved: !CFG.requireAiConfirm, error: err.message, confidence: 0, reason: 'AI failed' };
    bot.lastError = `AI confirm error: ${err.message}`;
  }
  validatePredictionLevels(hit);
  return hit;
}

async function appendPaperTrade(hit) {
  if (CFG.aiMode !== 'paper_trade') return;
  const trade = {
    ts: Date.now(),
    time: new Date().toISOString(),
    symbol: hit.sym,
    category: hit.cat,
    timeframe: CFG.tf,
    side: hit.type,
    entry: hit.ai?.entry || hit.price,
    stop_loss: hit.ai?.stop_loss || null,
    take_profit_1: hit.ai?.take_profit_1 || null,
    take_profit_2: hit.ai?.take_profit_2 || null,
    take_profit_3: hit.ai?.take_profit_3 || null,
    score: hit.score,
    strength: hit.strength,
    timing: hit.timing || null,
    ai: hit.ai || null,
    rr: hit.ai?.rr || null,
    status: 'OPEN_PAPER'
  };
  await fs.appendFile(PAPER_PATH, JSON.stringify(trade) + '\n');
  bot.totalPaperTrades++;
  if (CFG.obsidianJournalDir) await appendObsidianJournal(trade);
}

async function appendObsidianJournal(trade) {
  const dir = path.resolve(CFG.obsidianJournalDir);
  const day = new Date(trade.ts).toISOString().slice(0, 10);
  const file = path.join(dir, `trading-journal-${day}.md`);
  const md = [
    `\n## ${trade.symbol} ${trade.side} ${trade.time}`,
    `- Mode: paper_trade`,
    `- Timeframe: ${trade.timeframe}`,
    `- Entry: ${trade.entry}`,
    `- SL: ${trade.stop_loss}`,
    `- TP1/TP2/TP3: ${trade.take_profit_1} / ${trade.take_profit_2} / ${trade.take_profit_3}`,
    `- Score: ${trade.score}/20 ${trade.strength}`,
    `- AI: ${trade.ai?.confidence || '-'}/10 ${trade.ai?.approved ? 'approved' : 'rejected'}`,
    `- Reason: ${trade.ai?.reason || '-'}`,
    ''
  ].join('\n');
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(file, md);
}

async function readPaperTrades(limit = 200) {
  try {
    const raw = await fs.readFile(PAPER_PATH, 'utf8');
    return raw.trim().split('\n').filter(Boolean).slice(-limit).reverse().map(line => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return null;
      }
    }).filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function historyStats(trades) {
  const open = trades.filter(t => t.status === 'OPEN_PAPER').length;
  const closed = trades.length - open;
  const long = trades.filter(t => t.side === 'LONG').length;
  const short = trades.filter(t => t.side === 'SHORT').length;
  const avgScore = trades.length ? trades.reduce((s, t) => s + Number(t.score || 0), 0) / trades.length : 0;
  const avgAi = trades.filter(t => t.ai && Number.isFinite(Number(t.ai.confidence)));
  const avgConfidence = avgAi.length ? avgAi.reduce((s, t) => s + Number(t.ai.confidence || 0), 0) / avgAi.length : 0;
  return { total: trades.length, open, closed, long, short, avgScore, avgConfidence };
}

function buildDiscordMessage(hits, sendable) {
  const lines = sendable.slice(0, 20).map(hitLine);
  return [
    'DISCORD QUERY ALERT - ALL COINS / ALL CHAINS',
    `TF: ${CFG.tf} | Min score: ${CFG.minScore}/20 | Found: ${hits.length} | Sent: ${sendable.length}`,
    `Time: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} Asia/Bangkok`,
    '',
    ...lines
  ].join('\n');
}

async function sendDiscord(msg) {
  if (CFG.dryRun) {
    console.log('\n[DRY_RUN] Discord message:\n' + msg + '\n');
    return;
  }
  const webhook = await readWebhook();
  const content = '```text\n' + msg.slice(0, 1800) + '\n```';
  await fetchJson(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'Binance Futures Alert', content })
  });
}

async function scanOnce(manual = false) {
  if (bot.scanning) return bot.lastHits;
  bot.scanning = true;
  bot.lastError = '';
  bot.lastScanAt = Date.now();
  bot.nextScanAt = bot.lastScanAt + CFG.scanMs;
  bot.totalScans++;
  const hits = [];
  try {
    for (const coin of COINS) {
      try {
        const candles = await fetchCandles(coin.sym);
        const sig = detectSignal(candles);
        const score = sig.type === 'LONG' ? sig.bullTotal : sig.type === 'SHORT' ? sig.bearTotal : 0;
        const price = candles[candles.length - 1]?.c || 0;
        if (sig.type !== 'NEUTRAL' && score >= CFG.minScore) {
          const hit = {
            sym: coin.sym,
            label: coin.label,
            cat: coin.cat,
            type: sig.type,
            score,
            strength: sig.strength,
            price,
            rsi: sig.rsi,
            atr: sig.atr,
            indicators: sig.indicators,
            time: Date.now()
          };
          try {
            await attachTimingContext(hit, candles);
          } catch (err) {
            hit.timing = { guardApproved: false, guardReasons: [`timing context error: ${err.message}`] };
          }
          hits.push(hit);
        }
        await sleep(80);
      } catch (err) {
        console.warn(`[scan] ${coin.sym}: ${err.message}`);
      }
    }
    hits.sort((a, b) => b.score - a.score);
    const now = Date.now();
    let sendable = manual ? hits : hits.filter(hit => {
      const key = `${hit.sym}:${hit.type}`;
      if (now - (bot.lastSent[key] || 0) < CFG.dedupeMs) return false;
      bot.lastSent[key] = now;
      return true;
    });
    const beforeAiCount = sendable.length;
    if (sendable.length) {
      for (const hit of sendable) await applyAIConfirm(hit);
      sendable = sendable.filter(hit => hit.ai?.approved !== false);
    }
    bot.lastHits = hits;
    if (sendable.length) {
      for (const hit of sendable) await appendPaperTrade(hit);
      const msg = buildDiscordMessage(hits, sendable);
      await sendDiscord(msg);
      bot.lastMessage = msg;
      bot.totalAlerts += sendable.length;
      await writeState();
    } else {
      bot.lastMessage = beforeAiCount && aiEnabled()
        ? `Found ${hits.length}; AI rejected ${beforeAiCount} candidate(s).`
        : hits.length ? `Found ${hits.length}, but all are inside dedupe window.` : `No match >= ${CFG.minScore}/20 on ${CFG.tf}.`;
    }
    return hits;
  } catch (err) {
    bot.lastError = err.message;
    throw err;
  } finally {
    bot.scanning = false;
  }
}

function json(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function htmlShell(title, body, refresh = false) {
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${refresh ? '<meta http-equiv="refresh" content="20">' : ''}
<title>${title}</title>
<style>
:root{color-scheme:dark;--bg:#0f141d;--panel:#171d28;--line:#283244;--text:#eef3ff;--muted:#8f9bb0;--green:#26a69a;--red:#ef5350;--yellow:#f0b90b;--blue:#4ca3ff}
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:var(--bg);color:var(--text)}
main{width:min(1120px,100%);margin:0 auto;padding:20px}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}
h1{margin:0 0 8px;font-size:26px}h2{margin-top:22px}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}
.box{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}.k{color:var(--muted);font-size:12px}.v{font-size:20px;font-weight:700;margin-top:4px}
.ok{color:var(--green)}.bad{color:var(--red)}.blue{color:var(--blue)}button,.btn{display:inline-flex;align-items:center;justify-content:center;background:var(--yellow);border:0;border-radius:6px;padding:10px 14px;font-weight:700;color:#121212;cursor:pointer;text-decoration:none}
.btn.secondary{background:#273246;color:var(--text);border:1px solid var(--line)}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line);font-size:14px;vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase}.long td:first-child{color:var(--green);font-weight:700}.short td:first-child{color:var(--red);font-weight:700}
pre{white-space:pre-wrap;background:#0b1018;border:1px solid var(--line);border-radius:8px;padding:12px;overflow:auto}.actions{display:flex;gap:8px;flex-wrap:wrap}
@media(max-width:720px){main{padding:14px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}th:nth-child(3),td:nth-child(3),th:nth-child(8),td:nth-child(8){display:none}}
</style>
</head>
<body><main>${body}</main></body></html>`;
}

function page() {
  const rows = bot.lastHits.slice(0, 30).map(h => `
    <tr class="${h.type.toLowerCase()}">
      <td>${h.type}</td><td>${h.sym}</td><td>${h.cat}</td><td>${fP(h.price)}</td><td>${h.score}/20</td><td>${h.strength}</td><td>${h.timing ? `${h.timing.fast.directionalMovePct.toFixed(2)}%` : '-'}</td><td>${h.timing ? `${(h.timing.fast.buyRatio * 100).toFixed(0)}/${(h.timing.fast.sellRatio * 100).toFixed(0)}` : '-'}</td><td>${h.ai ? `${h.ai.approved ? 'OK' : 'NO'} ${h.ai.confidence || '-'}/10` : '-'}</td>
    </tr>`).join('');
  const scanText = bot.lastScanAt ? new Date(bot.lastScanAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';
  const nextText = bot.nextScanAt ? new Date(bot.nextScanAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';
  return htmlShell('Binance Alert Bot', `
  <div class="top">
    <div>
      <h1>Binance Discord Alert Bot</h1>
      <div class="muted">สแกนทุกเหรียญทุก chain จาก watchlist เดิม, ยืนยันด้วย AI ตาม env, และแจ้งเข้า Discord</div>
    </div>
    <div class="actions">
      <a class="btn secondary" href="/history">History</a>
      <button onclick="fetch('/scan',{method:'POST'}).then(()=>location.reload())">Scan Now</button>
    </div>
  </div>
  <section class="grid">
    <div class="box"><div class="k">Status</div><div class="v ${bot.lastError ? 'bad' : 'ok'}">${bot.scanning ? 'Scanning' : bot.running ? 'Running' : 'Stopped'}</div></div>
    <div class="box"><div class="k">Timeframe</div><div class="v">${CFG.tf}</div></div>
    <div class="box"><div class="k">Min Score</div><div class="v">${CFG.minScore}/20</div></div>
    <div class="box"><div class="k">Matches</div><div class="v">${bot.lastHits.length}</div></div>
    <div class="box"><div class="k">AI Mode</div><div class="v">${CFG.aiProvider}:${CFG.aiMode}</div></div>
    <div class="box"><div class="k">AI Model</div><div class="v">${CFG.openaiModel}</div></div>
    <div class="box"><div class="k">Paper Trades</div><div class="v">${bot.totalPaperTrades}</div></div>
    <div class="box"><div class="k">Auto Trade</div><div class="v ${CFG.autoTrade ? 'bad' : 'ok'}">${CFG.autoTrade ? 'Requested' : 'Off'}</div></div>
    <div class="box"><div class="k">Last Scan</div><div class="v">${scanText}</div></div>
    <div class="box"><div class="k">Next Scan</div><div class="v">${nextText}</div></div>
    <div class="box"><div class="k">Total Scans</div><div class="v">${bot.totalScans}</div></div>
    <div class="box"><div class="k">Total Alerts</div><div class="v">${bot.totalAlerts}</div></div>
  </section>
  ${bot.lastError ? `<div class="box bad">Error: ${bot.lastError}</div>` : ''}
  <h2>Latest Matches</h2>
  <table><thead><tr><th>Side</th><th>Symbol</th><th>Category</th><th>Price</th><th>Score</th><th>Strength</th><th>Drift</th><th>Buy/Sell</th><th>AI</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted">ยังไม่มีสัญญาณที่ผ่านเกณฑ์</td></tr>'}</tbody></table>
  <h2>Last Message</h2>
  <pre>${bot.lastMessage || '-'}</pre>
`, true);
}

async function historyPage() {
  const trades = await readPaperTrades(500);
  const stats = historyStats(trades);
  const rows = trades.map(t => {
    const time = t.ts ? new Date(t.ts).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : t.time || '-';
    const ai = t.ai ? `${t.ai.approved ? 'OK' : 'NO'} ${t.ai.confidence || '-'}/10` : '-';
    const drift = t.timing?.fast ? `${Number(t.timing.fast.directionalMovePct || 0).toFixed(2)}%` : '-';
    const flow = t.timing?.fast ? `${(Number(t.timing.fast.buyRatio || 0) * 100).toFixed(0)}/${(Number(t.timing.fast.sellRatio || 0) * 100).toFixed(0)}` : '-';
    return `<tr class="${String(t.side || '').toLowerCase()}">
      <td>${t.side || '-'}</td>
      <td>${t.symbol || '-'}</td>
      <td>${t.category || '-'}</td>
      <td>${time}</td>
      <td>${fP(Number(t.entry))}</td>
      <td>${fP(Number(t.stop_loss))}</td>
      <td>${fP(Number(t.take_profit_1))} / ${fP(Number(t.take_profit_2))} / ${fP(Number(t.take_profit_3))}</td>
      <td>${drift}</td>
      <td>${flow}</td>
      <td>${t.score || '-'}/20</td>
      <td>${ai}</td>
      <td>${t.status || '-'}</td>
    </tr>`;
  }).join('');
  return htmlShell('Paper Trade History', `
    <div class="top">
      <div>
        <h1>Paper Trade History</h1>
        <div class="muted">อ่านจาก .paper-trades.jsonl เฉพาะไม้ที่ผ่าน AI/rule และถูกบันทึกในโหมด paper_trade</div>
      </div>
      <div class="actions">
        <a class="btn secondary" href="/">Status</a>
        <a class="btn" href="/history.json">JSON</a>
      </div>
    </div>
    <section class="grid">
      <div class="box"><div class="k">Total</div><div class="v">${stats.total}</div></div>
      <div class="box"><div class="k">Open Paper</div><div class="v">${stats.open}</div></div>
      <div class="box"><div class="k">Long / Short</div><div class="v">${stats.long} / ${stats.short}</div></div>
      <div class="box"><div class="k">Avg Score</div><div class="v">${stats.avgScore.toFixed(1)}/20</div></div>
      <div class="box"><div class="k">Avg AI</div><div class="v">${stats.avgConfidence.toFixed(1)}/10</div></div>
      <div class="box"><div class="k">Mode</div><div class="v">${CFG.aiMode}</div></div>
      <div class="box"><div class="k">Model</div><div class="v">${CFG.openaiModel}</div></div>
      <div class="box"><div class="k">Review</div><div class="v">${CFG.openaiReviewModel}</div></div>
    </section>
    <h2>Trades</h2>
    <table>
      <thead><tr><th>Side</th><th>Symbol</th><th>Cat</th><th>Time</th><th>Entry</th><th>SL</th><th>TP1/2/3</th><th>Drift</th><th>Buy/Sell</th><th>Score</th><th>AI</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="12" class="muted">ยังไม่มี paper trade history</td></tr>'}</tbody>
    </table>
  `, true);
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === '/health') return json(res, 200, { ok: !bot.lastError, scanning: bot.scanning, lastError: bot.lastError });
      if (req.url === '/status') return json(res, 200, { cfg: CFG, bot: { ...bot, lastSent: undefined } });
      if (req.url === '/history.json') {
        const trades = await readPaperTrades(500);
        return json(res, 200, { stats: historyStats(trades), trades });
      }
      if (req.url === '/history') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(await historyPage());
        return;
      }
      if (req.url === '/scan' && req.method === 'POST') {
        scanOnce(true).catch(err => console.error('[manual scan]', err));
        return json(res, 202, { ok: true, scanning: true });
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(page());
    } catch (err) {
      json(res, 500, { ok: false, error: err.message });
    }
  });
  server.listen(CFG.port, '0.0.0.0', () => {
    console.log(`Alert status server: http://localhost:${CFG.port}`);
  });
}

async function main() {
  await readState();
  try {
    if (!CFG.dryRun) await readWebhook();
  } catch (err) {
    bot.lastError = err.message;
    console.error(err.message);
  }
  if (CFG.once) {
    await scanOnce(true);
    return;
  }
  bot.running = true;
  startServer();
  scanOnce(false).catch(err => console.error('[scan]', err));
  setInterval(() => scanOnce(false).catch(err => console.error('[scan]', err)), CFG.scanMs);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
