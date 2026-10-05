# Anime Cloud Earn Bot

Discord.js v14 + MongoDB earning bot with verification, message points, VC points, daily rewards, leaderboard, wallet cap, withdrawals and admin point controls.

## Setup
1. Install Node.js 20+ and MongoDB.
2. Copy `.env.example` to `.env` and fill in the values.
3. Run `npm install` then `npm start`.

## Important settings
- `WALLET_MAX=15000` caps the wallet at ₹15,000.
- `POINTS_PER_MESSAGE=1` gives 1 point per eligible message after the cooldown.
- `MESSAGE_COOLDOWN_SECONDS=30` prevents message spam farming.
- `POINTS_PER_VC_INTERVAL=5` gives 5 points every VC interval.
- `VC_MINUTES_REQUIRED=5` requires 5 minutes before the first VC reward.
- `POINTS_PER_RUPEE=100` means 100 points = ₹1 wallet credit. This starter version does not automatically convert points to wallet; add your payout policy before enabling real-money withdrawals.

## Verification
Set `VERIFIED_ROLE_ID` to your server's verified role. Users run `/verify` before earning.

## Anime Cloud link
Put your real Discord invite in `ANIME_CLOUD_DISCORD_INVITE`. The bot uses it in verification, balance, referral and reward messages.

## Production notes
Before using real-money payouts, add a proper withdrawal collection, admin approve/reject workflow, immutable transaction ledger, payout provider integration, rate limits, fraud detection, and audit logs. Do not trust client-side balances.
