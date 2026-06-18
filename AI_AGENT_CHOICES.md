# AI Agent Choices for Binance Alert Bot

## Current System

ระบบที่มีตอนนี้:

- `index.html` มี AI prediction อยู่แล้ว รองรับ OpenAI และ Anthropic ฝั่งหน้าเว็บ
- `alert-bot.js` รันบน Render ได้ สแกนทุกเหรียญทุก category แล้วส่ง Discord
- `alert-bot.js` ยังไม่ให้ AI กด order และยังไม่ยิง Binance order จริง
- Auto trade ใน `index.html` มี logic ยิง Binance Futures order แล้ว แต่ทำงานเมื่อเปิดหน้าเว็บ

เป้าหมายที่เหมาะ:

```text
Binance market data
-> Rule scanner 15 indicators
-> AI advisor วิเคราะห์ซ้ำ
-> Risk guard ตรวจความเสี่ยง
-> Discord alert / Paper trade
-> Live trade เฉพาะเมื่อเปิดโหมดจริง
```

## Guardrail ที่ควรใช้กับของเรา

ก่อนให้ AI อนุมัติไม้ ต้องผ่านทุกข้อ:

```text
Signal score >= 14/20
AI confidence >= 7/10
AI side ต้องตรงกับ indicator side
ต้องมี SL และ TP เสมอ
Risk per trade ไม่เกินค่าที่ตั้งไว้
Leverage ไม่เกินค่าที่ตั้งไว้
ไม่เปิดซ้ำ symbol เดิมถ้ามี position/order อยู่
ไม่เทรดช่วง cooldown
ไม่เทรดถ้า ATR/volatility ผิดปกติ
ไม่เทรดถ้า Binance precision/min notional ไม่ผ่าน
```

โหมดที่ควรแบ่ง:

```text
AI_ALERT_ONLY     = แจ้ง Discord เท่านั้น
AI_CONFIRM_ORDER  = AI ผ่านแล้วค่อยเตรียม order แต่ยังไม่ยิงจริง
AI_PAPER_TRADE    = จำลอง order + บันทึกผล
AI_LIVE_TRADE     = ยิง order จริง
```

ค่าเริ่มต้นควรเป็น:

```text
AI_MODE=alert_only
AUTO_TRADE=false
REQUIRE_AI_CONFIRM=true
MAX_USDT_PER_TRADE=5
MAX_LEVERAGE=5
```

## Choice A: OpenAI GPT-5.4 mini

เหมาะสุดสำหรับเริ่มใช้งานจริงกับ Render

ข้อดี:

- เร็วและราคาคุมง่ายกว่า flagship
- เหมาะกับงานตัดสินใจซ้ำๆ จากข้อมูล structured เช่น indicator score, ATR, RSI, SL/TP
- ต่อกับระบบเดิมง่าย เพราะ `index.html` มี OpenAI Responses API อยู่แล้ว
- เหมาะกับ alert ทุก 1 นาที เพราะไม่ควรใช้ model แพงกับทุกเหรียญทุก scan

ใช้เมื่อ:

```text
ต้องการ AI เป็นตัวกรองสัญญาณก่อนส่ง Discord / paper trade / live trade
```

ค่าแนะนำ:

```text
AI_PROVIDER=openai
OPENAI_MODEL=gpt-5.4-mini
AI_MIN_CONFIDENCE=7
AI_MODE=alert_only
```

คำแนะนำ: เลือกตัวนี้เป็น default

## Choice B: OpenAI GPT-5.5

เหมาะเป็นตัวตรวจไม้ใหญ่ หรือ final approval

ข้อดี:

- reasoning ดีกว่า เหมาะกับเคสซับซ้อน
- ใช้ตรวจสัญญาณที่คะแนนสูงมากก่อนเปิดไม้จริงได้

ข้อเสีย:

- แพงกว่า ไม่ควรเรียกทุกเหรียญทุก scan

ใช้เมื่อ:

```text
Rule scanner เจอ score >= 16/20
และต้องการให้ AI ช่วย veto ก่อน live trade
```

ค่าแนะนำ:

```text
AI_PROVIDER=openai
OPENAI_MODEL=gpt-5.5
AI_MIN_CONFIDENCE=8
AI_ONLY_WHEN_SCORE_GTE=16
```

คำแนะนำ: ใช้เป็น second opinion ไม่ใช่ default scanner

## Choice C: Claude Sonnet

เหมาะกับ reasoning / อธิบายเหตุผล / trading journal

ข้อดี:

- วิเคราะห์เป็นเหตุผลยาวๆ ดี
- เหมาะกับบันทึกเข้า Obsidian ว่าทำไมเข้าไม้

ข้อเสีย:

- ต้องเพิ่ม provider ใน `alert-bot.js`
- ถ้าใช้ทุก scan ต้นทุนอาจสูง

ใช้เมื่อ:

```text
ต้องการ AI เขียน trade journal และอธิบายเหตุผลแบบอ่านง่าย
```

ค่าแนะนำ:

```text
AI_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-sonnet-4-6
AI_MODE=alert_only
```

คำแนะนำ: เหมาะเป็น journal/explainer มากกว่าตัวกด order

## Choice D: Hermes / Local Model

เหมาะกับ privacy และการทดลองบนเครื่องตัวเอง

ข้อดี:

- ไม่ส่งข้อมูลไป provider นอก
- ค่า inference อาจถูก ถ้ามีเครื่องแรง
- ใช้กับ Obsidian/local memory ได้ดี

ข้อเสีย:

- Render ใช้ local model ไม่เหมาะ เพราะต้องมี GPU/RAM
- คุณภาพและความนิ่งในการตัดสินใจมักสู้ model hosted ไม่ได้
- ไม่ควรให้เป็นตัวอนุมัติ live trade คนเดียว

ใช้เมื่อ:

```text
ต้องการ local advisor / สรุป journal / ทดลอง strategy
```

ค่าแนะนำ:

```text
AI_PROVIDER=ollama
OLLAMA_MODEL=hermes3
AI_MODE=alert_only
```

คำแนะนำ: ใช้เป็น assistant/local memory ได้ แต่ไม่แนะนำเป็น live order gate

## Choice E: No AI, Rule Only

เหมาะสุดถ้าเน้นความนิ่งและ debug ง่าย

ข้อดี:

- deterministic
- ถูกสุด
- ไม่มี hallucination
- เหมาะกับระบบ alert ที่ต้องรัน 24/7

ข้อเสีย:

- ไม่ช่วยตีความบริบท
- อาจแจ้งสัญญาณเยอะเกิน

ใช้เมื่อ:

```text
ยังอยู่ช่วง test alert / paper trade
```

ค่าแนะนำ:

```text
AI_PROVIDER=none
AI_MODE=alert_only
```

คำแนะนำ: ใช้เป็น baseline เสมอ ต่อให้เพิ่ม AI แล้วก็ไม่ควรทิ้ง rule scanner

## Recommendation

เลือกแบบนี้:

```text
Phase 1: Rule Only + Discord
Phase 2: GPT-5.4 mini เป็น AI advisor
Phase 3: Paper trade พร้อมบันทึก journal
Phase 4: GPT-5.5 ตรวจเฉพาะไม้ score สูง ก่อน live trade
Phase 5: Live trade แบบจำกัดวงเงิน
```

ค่าที่แนะนำสำหรับเริ่ม:

```text
AI_PROVIDER=openai
OPENAI_MODEL=gpt-5.4-mini
AI_MODE=alert_only
AI_MIN_CONFIDENCE=7
AI_ONLY_WHEN_SCORE_GTE=14
REQUIRE_AI_CONFIRM=true
AUTO_TRADE=false
MAX_USDT_PER_TRADE=5
MAX_LEVERAGE=5
```

ถ้าจะเปิด live trade จริง:

```text
AI_MODE=live_trade
AUTO_TRADE=true
AI_MIN_CONFIDENCE=8
AI_ONLY_WHEN_SCORE_GTE=16
MAX_USDT_PER_TRADE=5
MAX_DAILY_TRADES=3
MAX_DAILY_LOSS_USDT=10
```

## Final Pick

ถ้าต้องเลือกตัวเดียว:

```text
OpenAI GPT-5.4 mini
```

เหตุผล:

- เหมาะกับระบบ Render ที่ต้องเรียกซ้ำ
- คุมต้นทุนได้
- ต่อกับโค้ดเดิมง่ายสุด
- ใช้ structured JSON decision ได้ดี
- พอสำหรับเป็น AI filter ก่อนส่ง Discord หรือ paper trade

ถ้าเป็นไม้จริง ใช้:

```text
Rule scanner -> GPT-5.4 mini -> risk guard -> Discord/paper
```

ยังไม่ควรให้:

```text
AI -> Binance order โดยตรง
```

ต้องให้ `risk guard` เป็นคนตัดสินสุดท้ายเสมอ.

## Selected Setup Applied

ระบบถูกปรับให้ใช้ flow นี้แล้ว:

```text
Phase 1: Rule scanner + Discord
Phase 2: Timing guard 5m/15m + GPT-5.4 mini confirm เฉพาะ signal score >= 14
Phase 3: Paper trade + .paper-trades.jsonl / optional Obsidian journal
Phase 4: GPT-5.5 second review เฉพาะ signal score >= 16
Phase 5: Live trade ยังล็อกไว้ ไม่ยิงเงินจริงจาก alert-bot.js
```

เปิดใช้งานบน Render ด้วย env:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5.4-mini
OPENAI_REVIEW_MODEL=gpt-5.5
AI_MODE=alert_only
AI_MIN_CONFIDENCE=7
AI_ONLY_WHEN_SCORE_GTE=14
AI_REVIEW_WHEN_SCORE_GTE=16
REQUIRE_AI_CONFIRM=true
TIMING_GUARD=true
TIMING_FAST_TF=5m
TIMING_SLOW_TF=15m
MAX_ENTRY_DRIFT_PCT=0.7
MAX_SIGNAL_AGE_CANDLES=8
MIN_FLOW_BIAS=0.52
MIN_RISK_REWARD=2
AUTO_TRADE=false
```

ถ้าจะทดสอบ paper trade:

```text
AI_MODE=paper_trade
```

AI/timing จะดูเพิ่ม:

```text
จุดเริ่ม signal เทียบราคาปัจจุบัน
drift ว่าเข้าช้าเกินไปไหม
buy/sell flow จาก taker buy volume 5m และ 15m
volume change ช่วงล่าสุด
TP/SL จาก AI ต้องอยู่ถูกฝั่ง
RR จาก TP2 ต้อง >= 1:2
```
