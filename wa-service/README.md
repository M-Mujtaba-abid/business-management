# wa-service: WhatsApp order messages

A small Go service, built on [whatsmeow](https://github.com/tulir/whatsmeow), that sends WhatsApp messages to customers for the Business Manager app.

| When | Customer gets |
|---|---|
| Order added as **Packing** (or moved to Packing) | Order details and a request to reply **1** to confirm or **2** to cancel |
| Customer replies 1 / 2 | A thank-you. The order shows **Customer confirmed** or **Customer cancelled** on the website. |
| Status → **Dispatched** | "Your order is on its way, 2–3 days" plus the tracking number |
| Status → **Delivered** | "Delivered, please leave a review" (plus the `REVIEW_URL` link, if set) |

Each message is sent **once per order**. Moving a status back and forth does not send it again. A customer's cancel reply does **not** change the order status by itself; you decide what to do with it.

> **Why "reply 1 / 2" and not buttons?** whatsmeow is an *unofficial* WhatsApp client. WhatsApp no longer shows button messages from unofficial clients reliably, so plain text replies are used. A customer can also swipe-reply on the confirm message, or type `2 #1045` to choose a specific order.

## How it fits together

```
Next.js app (Vercel)  ── POST /send ──────────────►  wa-service (VPS, Docker)  ──► WhatsApp
        ▲                                                  │
        └──── POST /api/whatsapp/webhook (signed) ◄────────┘   sent / failed / customer replies
```

- The app saves every message in the `WhatsAppMessage` table first. A WhatsApp problem never blocks saving an order. The message shows **failed** on the order, with a **Resend** button.
- wa-service sends messages one by one, with a random 3–7 second gap and a "typing…" indicator, so the number does not look like a spam bot.

## What you need

1. **A separate WhatsApp number** for the business, ideally on the WhatsApp Business app. It stays on a phone; wa-service links to it as a "Linked device". If that phone is offline for about 14 days, the link drops and you scan again.
2. **A small always-on server** with Docker (512 MB–1 GB RAM is enough): Hetzner, DigitalOcean, Contabo, or similar. It **cannot** run on Vercel, because it needs a permanent connection.
3. **HTTPS** in front of it, for example Caddy with a subdomain like `wa.yourdomain.com`.

## Setup

### 1. Secrets
Generate two random secrets:
```bash
openssl rand -hex 32   # → WA_API_SECRET
openssl rand -hex 32   # → WA_WEBHOOK_SECRET
```

### 2. Run wa-service on the server
```bash
cd wa-service
cp .env.example .env      # fill in both secrets and WA_WEBHOOK_URL=https://<your-app>/api/whatsapp/webhook
docker compose up -d --build
docker compose logs -f    # should say "wa-service listening" and "New pairing QR code available"
```

HTTPS with Caddy (`/etc/caddy/Caddyfile`):
```
wa.yourdomain.com {
    reverse_proxy 127.0.0.1:8080
}
```

### 3. Configure the Next.js app (Vercel → Settings → Environment Variables, and `.env` locally)
```
WA_SERVICE_URL=https://wa.yourdomain.com
WA_API_SECRET=<same as wa-service>
WA_WEBHOOK_SECRET=<same as wa-service>
REVIEW_URL=https://g.page/r/your-google-review-link   # optional
BUSINESS_NAME=Your Shop Name                          # optional, signs each message
```

### 4. Update the database
```bash
npx prisma migrate deploy
```

### 5. Link the WhatsApp number
In the app, open **Settings → WhatsApp order messages**. On the business phone, go to WhatsApp → Settings → **Linked devices** → **Link a device** and scan the QR. The status turns **Connected**.

## Day to day

- **Orders list:** each order shows the customer's reply (Awaiting reply / Customer confirmed / **Customer cancelled**) and the state of the latest message. Click **Resend** on a failed message.
- **Filters → "Customer cancelled (WhatsApp)"** lists every order a customer cancelled.
- **Changing the wording:** edit `buildMessage()` in `lib/whatsapp.ts`.
- **Unlinking:** use Settings → Unlink, or remove the device from the phone. The service then shows a new QR by itself.

## Testing locally
1. `docker compose up --build` in `wa-service/`, with `WA_WEBHOOK_URL` pointing at a tunnel to your dev app (for example `cloudflared tunnel --url http://localhost:3000`, then `https://<tunnel>/api/whatsapp/webhook`).
2. In the app's `.env`, set `WA_SERVICE_URL=http://localhost:8080` plus the two secrets, then run `npm run dev`.
3. Scan the QR. Add an order with **your own second number**, and reply `1`, then `2`. Move the order to Dispatched, then Delivered.

Go tests: `go test ./...` (or with Docker: `docker run --rm -v "$PWD:/src" -w /src golang:1.27-bookworm go test ./...`).

## Staying safe from bans
What this setup already does:
- **Different text every time.** Each message has several wordings on the WhatsApp page (one picked at random, never the same twice in a row), and `{a|b|c}` choices inside them. Every message also carries the customer's own name, order and products.
- **Slow sending.** A random 20–60 s gap between any two messages (`WA_MIN_GAP_SECONDS` / `WA_MAX_GAP_SECONDS`).
- **Night pause.** Automatic order messages wait between `WA_QUIET_START` and `WA_QUIET_END` (22 → 9 on `WA_TIMEZONE`), then go out in the morning. The order shows "… at 9:00 am".
- **Daily limit.** Automatic messages reach at most `WA_DAILY_NEW_CHATS` different customers a day (150); the rest wait for the next morning.
- Replies to a customer (the thank-you after 1 / 2) and bills you send by hand go out any time.
- **STOP.** A customer who replies `STOP` gets no more automatic messages (`START` allows them again; the chat window also has an "Allow again" button).
- **No links to strangers.** The review link only goes to customers who have written to us before.
- Waiting messages are kept in `/data/queue.json`, so a restart loses none.

What you should do:
- Only message customers who actually placed an order (this service never sends anything else).
- Keep the gaps, and don't lower them below a few seconds.
- Keep the WhatsApp Business profile complete (name, logo, address) and use the phone for normal chats too.
- Use a number that has been in normal use for a while, not a brand-new SIM that starts sending on day one.
- This is unofficial. If the business grows big, move to the official WhatsApp Cloud API.

## Endpoints (all need `Authorization: Bearer <WA_API_SECRET>`, except `/healthz`)

| Method | Path | |
|---|---|---|
| POST | `/send` | `{refId, phone: "923001234567", text}` → 202 queued |
| GET | `/status` | `{connected, loggedIn, phone, hasQR, queue}` |
| GET | `/qr` | pairing QR PNG (404 when linked) |
| POST | `/logout` | unlink the number |
| GET | `/healthz` | liveness |

Webhook events are signed with `X-WA-Signature: sha256=<hmac>`:
`{type:"sent", refId, messageId}`, `{type:"failed", refId, error}`, `{type:"message", from, text, quotedId, messageId}`.
