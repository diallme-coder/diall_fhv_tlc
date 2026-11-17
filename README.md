# FHV Driver Alerts

Unofficial web app for NYC TLC for-hire drivers. A driver signs in by email, enters their license number and name, connects Telegram, and gets:

- an alert **30 days before** the license expires
- an alert if the license **drops off the TLC active drivers list** (can mean suspension, non-renewal, or another change; the dataset does not say which)
- an alert if it comes back

Data source: [FHV Active Drivers](https://data.cityofnewyork.us/d/xjfq-wh2d), queried live. Only drivers who sign up are stored; the full list is never copied.

## How it works

| Piece | File |
|---|---|
| Web page (login, claim license, connect Telegram) | `public/index.html` |
| Database tables | `supabase/schema.sql` |
| Claim a license (email login + license/name match) | `api/claim.js` |
| Dashboard data, delete account | `api/me.js` |
| Telegram bot webhook (`/start`, `/status`, `/stop`) | `api/telegram.js` |
| Daily check, 8:30 PM ET | `api/cron.js` + `lib/check.js` |

Safeguards in the daily check: it skips the whole run if the TLC feed is stale, under 1,000 rows, or more than 10% smaller than last time, and it only sends a removal alert after the license is missing on **two** consecutive healthy runs.

## Deploy

1. **GitHub**: create a repo and push this folder.
2. **Supabase**: use a project, run `supabase/schema.sql` in the SQL editor. Under Authentication > URL Configuration, set Site URL to your Vercel URL (and add it to Redirect URLs).
3. **Telegram**: in @BotFather run `/newbot` (make a new bot for drivers, separate from your channel bot). Note the token and username.
4. **Vercel**: import the GitHub repo (no build settings needed) and add these environment variables:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_ANON_KEY` | anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key (secret, server only) |
   | `TELEGRAM_BOT_TOKEN` | from BotFather |
   | `TELEGRAM_BOT_USERNAME` | bot username without `@` |
   | `TELEGRAM_WEBHOOK_SECRET` | any long random string |
   | `CRON_SECRET` | any long random string (Vercel sends it to the cron) |
   | `SOCRATA_APP_TOKEN` | optional, free from NYC Open Data, avoids rate limits |

5. **Point Telegram at the bot endpoint** (once, after the first deploy):

   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     --data-urlencode "url=https://<your-app>.vercel.app/api/telegram" \
     --data-urlencode "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

6. **Test the job**: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>.vercel.app/api/cron` returns a JSON summary.

Run tests locally with `npm test` (Node 20+, no dependencies).

## Known limits

- **Identity check is weak.** License number and name are both public, so someone could subscribe to another driver's license. They would only receive that driver's public status changes. Attempts are rate-limited (5 failures per hour per account). Stronger proof would need contact details from the TLC.
- **"Suspension" is inferred.** The dataset lists only drivers in good standing, so a suspension looks the same as an expired license. Alert wording says so.
- **Data can lag.** The TLC refreshes the dataset daily; alerts follow that.
- Not affiliated with the TLC. Keep the disclaimer on the page.
