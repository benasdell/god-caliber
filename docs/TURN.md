# Metered.ca TURN Relay Configuration Guide

> **Project**: God-Caliber (`delightful-franklin`)  
> **Purpose**: Instructions for configuring your personal Metered.ca TURN credentials for WebRTC WAN & Symmetric NAT fallback relay.

---

## How to Add Your Metered.ca Credentials

Whenever you want to activate your personal Metered.ca account (500 MB/month free tier) for TURN relay fallback:

1. **Create a local `.env.local` file** in the project root (`delightful-franklin/.env.local`). Note that `.env.local` is ignored by Git to protect your credentials.
2. **Paste your account details** from Metered.ca:
   ```env
   VITE_TURN_URL=turn:global.relay.metered.ca:80
   VITE_TURN_USERNAME=your_metered_username
   VITE_TURN_CREDENTIAL=your_metered_credential
   ```

   *For TLS / TURNS fallback over port 443 (TCP)*:
   ```env
   VITE_TURN_URL=turn:global.relay.metered.ca:80,turns:global.relay.metered.ca:443?transport=tcp
   ```

3. **Restart the dev server**:
   When you run `npm run dev` or `npm run dev:tunnel`, Vite will automatically load your credentials into `NetworkManager` at runtime!

---

## How it Works Under the Hood

[`NetworkManager.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/multiplayer/NetworkManager.js) reads these environment variables dynamically:

```javascript
if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURN_URL) {
  const turnRaw = import.meta.env.VITE_TURN_URL.trim();
  const turnUrls = turnRaw.includes(',') ? turnRaw.split(',').map(s => s.trim()).filter(Boolean) : turnRaw;
  const turnConfig = { urls: turnUrls };
  if (import.meta.env.VITE_TURN_USERNAME) turnConfig.username = import.meta.env.VITE_TURN_USERNAME;
  if (import.meta.env.VITE_TURN_CREDENTIAL) turnConfig.credential = import.meta.env.VITE_TURN_CREDENTIAL;
  servers.push(turnConfig);
}
```

If `VITE_TURN_URL` is omitted, the game automatically falls back to public STUN servers (`stun.l.google.com`, `stun.cloudflare.com`, `openrelay.metered.ca`).
