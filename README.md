# Discord CTA Bot

CTA attendance bot with points, leaderboard, and Senate tools.

## Setup
1. Create a Discord application and bot.
2. Copy `.env.example` to `.env` and fill values.
3. Install dependencies:
   - `npm install`
4. Register commands:
   - `npm run register`
5. Start the bot:
   - `npm run start`

## Commands
- `/cta <event> [duration]`
- `/list_events`
- `/set_event <event> <points>` (Senate)
- `/register <IGN> <CLASS>`
- `/points` or `/points scope:all`
- `/leaderboard`
- `/reset_points <user|all>` (Senate)
- `/export_points` (Senate)
- `/audit_log` (Senate)
