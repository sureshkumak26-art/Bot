# ☁️ Anime Cloud Bot

Production Discord.js v14 bot for Anime Cloud hosting operations, customer support, moderation and professional invoices.

## Features
- Slash commands with automatic global registration
- `/help`, `/ping`, `/plans`, `/status`, `/profile`
- Hosting order tracking with persistent JSON database
- Coupon creation and redemption
- Support ticket creation with close button
- Moderation: `/warn` and `/purge`
- Admin tools: statistics, broadcasts and coupon management
- Professional Anime Cloud PNG + A4 PDF invoice generation
- Multiple invoice items and INR totals
- PAID/PENDING invoice status
- No secrets stored in source code

## Install
```bash
npm install
cp .env.example .env
# Put your Discord bot token in .env
npm start
```

## Main commands
```text
/help
/plans
/status
/order plan:Starter note:Need VPS
/coupon code:ANIME26
/ticket
/invoice customer:Customer items:Anime VPS=750, Domain=1200 time:30 Days status:PAID
/warn user:@member reason:Rule violation
/purge amount:20
/admin stats
/admin broadcast message:Maintenance tonight
/admin coupon code:ANIME26 percent:10
```

## Required Discord permissions
Invite the bot with the `bot` and `applications.commands` scopes. For the full feature set, give it permission to manage messages, moderate members, manage channels, view channels and send messages.

Keep `DISCORD_TOKEN` only in `.env` or your hosting provider's secret environment variables. Never commit a real token to GitHub.

## Data
Runtime data is stored in `data/database.json`. Back up this file if you need to preserve orders, tickets, warnings and coupons.
