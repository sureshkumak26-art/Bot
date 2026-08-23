# ☁️ Anime Cloud Bot v3

Professional Discord.js v14 hosting and community automation bot.

## Included
- ⚡ Instant guild slash commands
- 💳 Dynamic UPI QR payment flow with manual transaction verification
- 📦 Orders linked to customizable VPS plans
- 🧾 High-level PNG + A4 PDF invoices
- 🎫 Interactive ticket panel + private support channels
- 📢 Announcement system
- 👋 Welcome system
- 🎟️ Coupon system
- 🛡️ Warn + purge moderation
- 📊 Admin statistics
- ⚙️ Add/edit/delete custom hosting plans

## Setup
```bash
cd /root/Bot
npm install
cp .env.example .env
nano .env
npm run commands
npm start
```

### Environment
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
UPI_ID=your-upi-id@bank
PAYMENT_NAME=Anime Cloud
PAYMENT_LOG_CHANNEL_ID=your_payment_log_channel_id
SUPPORT_ROLE_ID=your_support_role_id
```

## Payment flow
1. `/order plan:Starter`
2. `/pay order_id:ORDER_ID` → dynamic QR for the exact INR amount
3. Complete the UPI payment
4. `/pay order_id:ORDER_ID transaction_id:UPI_TRANSACTION_ID`
5. Staff approves with `/admin payment payment_id:PAY_ID action:approve`
6. The order becomes PAID and a professional invoice is generated and sent to the customer.

This is a **UPI QR + manual verification** system; it does not claim automatic bank/payment-provider verification.

## Panels
```text
/panel payment
/panel ticket
/panel plans
```

## Welcome
```text
/welcome setup channel:#welcome
/welcome disable
```

## Announcement
```text
/announcement title:Maintenance message:Scheduled maintenance tonight channel:#announcements
```

## Customize plans
```text
/admin plan-add name:Ultra ram:16 storage:200 cpu:8 price:399
/admin plan-edit name:Ultra price:449
/admin plan-delete name:Ultra
/admin plan-list
```

## Invoice
```text
/invoice customer:Customer items:Anime VPS=750,Domain=1200 time:30 Days status:PAID
```

Never commit a real Discord token or payment credentials to GitHub. Keep them in `.env` or your host's secret environment variables.
