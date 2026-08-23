# ☁️ Anime Cloud Bot v4

Professional Discord.js v14 hosting, orders, payments, customer DMs and community automation bot.

## Included
- ⚡ Instant guild slash commands
- 💳 Dynamic UPI QR payment flow with manual transaction verification
- 📦 Orders linked to customizable VPS plans
- 📋 Dedicated order channel with every new order and status updates
- 🧾 High-level PNG + A4 PDF invoices
- 🎫 Interactive ticket panel + private support channels
- 📢 Announcement system
- 👋 Welcome system
- 💬 Staff-to-customer DM command
- 🎟️ Coupon system
- 🛡️ Warn + purge moderation
- 📊 Admin statistics and order dashboard
- ⚙️ Add/edit/delete custom hosting plans
- 🔔 Automatic customer DMs for order creation, payment submission and payment result

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
ORDER_CHANNEL_ID=your_order_channel_id
```

`ORDER_CHANNEL_ID` is optional. You can configure it later with `/order-channel setup`.

## Order system
```text
/order plan:Starter
/orders
/order-channel setup channel:#orders
/order-channel disable
/panel orders
```

Every new order is persisted in `data/database.json` and posted to the configured order channel. When payment status changes, the order message is updated automatically.

## Customer DM
```text
/dm user:@customer message:Your VPS order is ready.
```

The `/dm` command requires Manage Server permission and sends only to the selected Discord user. The bot also automatically DMs customers when an order is created, payment is submitted, and payment is approved/rejected.

## Payment flow
1. `/order plan:Starter`
2. `/pay order_id:ORDER_ID` → dynamic QR for the exact INR amount
3. Complete the UPI payment
4. `/pay order_id:ORDER_ID transaction_id:UPI_TRANSACTION_ID`
5. Staff approves with `/admin payment payment_id:PAY_ID action:approve`
6. The order becomes PAID, the order dashboard updates, and a professional invoice is generated and sent to the customer.

This is a **UPI QR + manual verification** system; it does not claim automatic bank/payment-provider verification.

## Panels
```text
/panel payment
/panel ticket
/panel plans
/panel orders
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
