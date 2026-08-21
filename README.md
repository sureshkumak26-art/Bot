# Anime Cloud Invoice Bot

Professional Discord invoice generator for Anime Cloud.

## Features
- `/invoice` slash command
- Customer name, item names, prices and service time
- Optional uploaded image
- Generates a polished PNG invoice
- Generates a matching A4 PDF invoice
- PAID/PENDING status
- Automatic invoice number and INR total

## Install
```bash
npm install
cp .env.example .env
# Put your Discord bot token in .env
npm start
```

## Command
```text
/invoice customer:Customer items:Anime VPS=750, Domain biharepoxyflooring.com=1200 time:30 Days status:PAID
```

The bot registers the slash command globally when it starts. Keep the bot token only in `.env` or your hosting provider's secret environment variables; never commit it to GitHub.
