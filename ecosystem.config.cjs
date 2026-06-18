module.exports = {
  apps: [
    {
      name: 'binance-discord-alert',
      script: './alert-bot.js',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        ALERT_TF: '5m',
        ALERT_MIN_SCORE: '14',
        ALERT_SCAN_MS: '60000',
        ALERT_DEDUPE_MS: '600000',
        ALERT_PORT: '8787',
        AI_PROVIDER: 'none',
        AI_MODE: 'alert_only',
        OPENAI_MODEL: 'gpt-5.4-mini',
        OPENAI_REVIEW_MODEL: 'gpt-5.5',
        AI_MIN_CONFIDENCE: '7',
        AI_ONLY_WHEN_SCORE_GTE: '14',
        AI_REVIEW_WHEN_SCORE_GTE: '16',
        REQUIRE_AI_CONFIRM: 'true',
        AUTO_TRADE: 'false',
        MAX_USDT_PER_TRADE: '5',
        MAX_LEVERAGE: '5',
        MAX_DAILY_TRADES: '3',
        MAX_DAILY_LOSS_USDT: '10',
        TIMING_GUARD: 'true',
        TIMING_FAST_TF: '5m',
        TIMING_SLOW_TF: '15m',
        MAX_ENTRY_DRIFT_PCT: '0.7',
        MAX_SIGNAL_AGE_CANDLES: '8',
        MIN_FLOW_BIAS: '0.52',
        MIN_RISK_REWARD: '2'
      }
    }
  ]
};
