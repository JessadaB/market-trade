# Binance Discord Alert Server

รัน alert ได้ตลอดโดยไม่ต้องเปิด `index.html` ค้างไว้ เพราะ `alert-bot.js` ทำงานฝั่ง server:

- อ่าน Discord webhook จาก `DISCORD_WEBHOOK` หรือ `URLBot.txt`
- สแกนทุกเหรียญทุก category/chain ใน watchlist
- ยืนยันสัญญาณด้วย OpenAI ได้เมื่อเปิด `AI_PROVIDER=openai`
- ตรวจ timing 5m/15m ก่อนเข้าไม้: signal start, current price, drift, buy/sell flow
- บันทึก paper trade เป็น `.paper-trades.jsonl` ได้เมื่อใช้ `AI_MODE=paper_trade`
- ยิง Discord เมื่อ score ผ่านเกณฑ์
- เปิดหน้า status ที่ `http://localhost:8787`

## ทดสอบแบบไม่ยิง Discord

```bash
DRY_RUN=1 node alert-bot.js --once
```

## รันจริงบนเครื่อง

```bash
node alert-bot.js
```

เปิดดูสถานะ:

```text
http://localhost:8787
```

เปิดดู paper trade history:

```text
http://localhost:8787/history
```

ดึงข้อมูล history แบบ JSON:

```text
http://localhost:8787/history.json
```

## รันค้างด้วย PM2

ติดตั้ง PM2:

```bash
npm install -g pm2
```

เริ่ม bot:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

ดู log:

```bash
pm2 logs binance-discord-alert
```

หยุด:

```bash
pm2 stop binance-discord-alert
```

## ตั้งค่าด้วย environment

```bash
DISCORD_WEBHOOK="https://discord.com/api/webhooks/..." ALERT_TF=15m ALERT_MIN_SCORE=15 ALERT_PORT=8787 node alert-bot.js
```

ค่า default:

- `ALERT_TF=5m`
- `ALERT_MIN_SCORE=14`
- `ALERT_SCAN_MS=60000`
- `ALERT_DEDUPE_MS=600000`
- `ALERT_PORT=8787`
- `DISCORD_WEBHOOK=` ใช้แทน `URLBot.txt` เวลารันบน cloud
- `AI_PROVIDER=none`
- `AI_MODE=alert_only`
- `OPENAI_MODEL=gpt-5.4-mini`
- `OPENAI_REVIEW_MODEL=gpt-5.5`
- `AI_MIN_CONFIDENCE=7`
- `AI_ONLY_WHEN_SCORE_GTE=14`
- `AI_REVIEW_WHEN_SCORE_GTE=16`
- `REQUIRE_AI_CONFIRM=true`
- `AUTO_TRADE=false`
- `MAX_USDT_PER_TRADE=5`
- `MAX_LEVERAGE=5`
- `TIMING_GUARD=true`
- `TIMING_FAST_TF=5m`
- `TIMING_SLOW_TF=15m`
- `MAX_ENTRY_DRIFT_PCT=0.7`
- `MAX_SIGNAL_AGE_CANDLES=8`
- `MIN_FLOW_BIAS=0.52`
- `MIN_RISK_REWARD=2`

## เปิด Phase 2: GPT-5.4 mini confirm

ตั้งค่าใน Render Environment:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5.4-mini
AI_MODE=alert_only
AI_MIN_CONFIDENCE=7
AI_ONLY_WHEN_SCORE_GTE=14
REQUIRE_AI_CONFIRM=true
TIMING_GUARD=true
TIMING_FAST_TF=5m
TIMING_SLOW_TF=15m
MAX_ENTRY_DRIFT_PCT=0.7
MIN_FLOW_BIAS=0.52
MIN_RISK_REWARD=2
```

ระบบจะเรียก AI เฉพาะ signal ที่ผ่าน rule และกำลังจะส่ง Discord เท่านั้น
เพื่อลดค่าใช้จ่าย API.

Timing guard จะ reject สัญญาณก่อนถึง AI ถ้า:

```text
ราคาปัจจุบันห่างจากจุดเริ่มสัญญาณมากกว่า MAX_ENTRY_DRIFT_PCT
buy/sell flow ใน 5m หรือ 15m ไม่เข้าทางฝั่ง LONG/SHORT
สัญญาณเก่าเกิน MAX_SIGNAL_AGE_CANDLES และแรงราคาเริ่มนิ่ง
AI ให้ TP/SL แล้ว RR ต่ำกว่า MIN_RISK_REWARD
```

## เปิด Phase 3: Paper trade journal

```text
AI_MODE=paper_trade
```

เมื่อ signal ผ่าน AI แล้ว bot จะบันทึก paper trade ลง:

```text
.paper-trades.jsonl
```

และเปิดดูได้ที่:

```text
/history
```

ถ้าต้องการให้เขียนเข้า Obsidian vault ให้ตั้ง:

```text
OBSIDIAN_JOURNAL_DIR=/path/to/ObsidianVault/Trading
```

บน Render แนะนำใช้ `.paper-trades.jsonl` เป็น log ชั่วคราวก่อน เพราะ filesystem
ของ service อาจไม่เหมาะกับการเก็บข้อมูลถาวรระยะยาว.

## Phase 4: GPT-5.5 second review

เมื่อ signal score >= 16 ระบบจะเรียก model review ซ้ำถ้าตั้งค่าไว้:

```text
OPENAI_REVIEW_MODEL=gpt-5.5
AI_REVIEW_WHEN_SCORE_GTE=16
```

## Phase 5: Live trade

ตอนนี้ `alert-bot.js` ยังไม่ยิง Binance order จริง ถึงตั้ง `AUTO_TRADE=true`
ก็จะเป็นแค่สถานะเตือนในหน้า dashboard เท่านั้น.

ควรเปิด live trade หลัง paper trade ผ่านแล้ว และต้องเพิ่ม Binance API guard
แยกต่างหากก่อน.

## เปิดให้ดูจากข้างนอก

ถ้ารันบน VPS:

1. เปิด firewall port `8787` หรือใช้ reverse proxy เช่น Caddy/Nginx
2. ชี้ domain/subdomain มาที่ IP ของ VPS
3. ให้ reverse proxy ทำ HTTPS แล้ว proxy เข้า `127.0.0.1:8787`

ตัวอย่าง Caddyfile:

```text
alerts.your-domain.com {
  reverse_proxy 127.0.0.1:8787
}
```

หมายเหตุ: อย่า public ไฟล์ `URLBot.txt` และอย่าเอา webhook ไปใส่ในหน้าเว็บฝั่ง client
เพราะใครเห็น URL จะยิงข้อความเข้า Discord ได้.
