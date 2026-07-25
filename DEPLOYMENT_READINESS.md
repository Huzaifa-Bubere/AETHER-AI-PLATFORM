# Deployment Readiness Report
## Smart Interview AI — Frontend (Vercel) + Backend (Render)

> Generated: April 14, 2026  
> Verdict: **NOT READY FOR PRODUCTION** — 9 blockers must be fixed first

---

## Quick Summary

| Layer | Status | Blockers |
|---|---|---|
| Frontend (Vercel) | ⚠️ Almost ready | 3 critical, 4 medium |
| Backend (Render) | ❌ Not ready | 6 critical, 5 medium |
| AI Server | ❌ Not deployable on Render | Architecture issue |
| Database | ✅ Atlas ready | 0 |
| Security | ❌ Critical holes | 2 critical |

---

## BLOCKERS — Must fix before deploying

### 1. Auth0 JWT decoded without signature verification (CRITICAL SECURITY)
**File:** `backend/src/middleware/auth.ts` line 45  
**Problem:** When a JWT fails local verification, the code falls back to `jwt.decode(token)` — which does **zero signature verification**. Any attacker can forge an Auth0 token by base64-encoding any payload and it will be accepted.
```ts
// CURRENT — INSECURE
const auth0Decoded = jwt.decode(token) as any;  // no verification!
if (auth0Decoded && auth0Decoded.sub) {
  decoded = { userId: auth0Decoded.sub, email: auth0Decoded.email };
}
```
**Fix:** Either verify Auth0 tokens using `jwks-rsa` + `jsonwebtoken` with Auth0's public key, or remove Auth0 support entirely if it's not being used.

---

### 2. Mock user returned when DB is disconnected (CRITICAL SECURITY)
**File:** `backend/src/middleware/auth.ts` line 70, `backend/src/routes/auth.ts` line 199  
**Problem:** When MongoDB is not connected, the auth middleware creates a mock user from the token payload and lets the request through. In production on Render, if the DB connection drops momentarily, all API endpoints become unauthenticated.
```ts
// CURRENT — DANGEROUS
if (!isMongoConnected) {
  req.user = { userId: decoded.userId, email: 'dev@example.com', role: 'free' };
  next(); // ← lets request through without DB validation
}
```
**Fix:** In production, return 503 Service Unavailable when DB is down. Never bypass auth.

---

### 3. No `vercel.json` — SPA routing will 404 on refresh
**File:** Missing `frontend/vercel.json`  
**Problem:** Vercel serves static files. When a user refreshes `/dashboard` or `/interview-room?id=xxx`, Vercel returns 404 because there's no `dashboard.html` file. React Router only works on the initial load.  
**Fix:** Create `frontend/vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

### 4. No `render.yaml` — Render won't know how to build/start the backend
**File:** Missing `render.yaml` in root  
**Problem:** Without a Render config file, you have to manually configure build commands, start commands, and env vars in the Render dashboard. Any redeployment loses that config.  
**Fix:** Create `render.yaml`:
```yaml
services:
  - type: web
    name: smart-interview-backend
    env: node
    buildCommand: cd backend && npm ci && npm run build
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_ACCESS_SECRET
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      # ... all other env vars
```

---

### 5. Socket.IO CORS hardcodes localhost — will block production connections
**File:** `backend/src/server.ts` line 23  
**Problem:**
```ts
origin: ['http://localhost:5175', 'http://localhost:5174', process.env.FRONTEND_URL].filter(Boolean)
```
The Socket.IO server only allows `localhost` origins plus `FRONTEND_URL`. In production, `FRONTEND_URL` must be set to your Vercel URL (e.g. `https://smart-interview-ai.vercel.app`). If it's not set, Socket.IO will reject all connections from the deployed frontend.  
**Fix:** Ensure `FRONTEND_URL` is set in Render env vars. Also add the Vercel preview URL pattern.

---

### 6. `PYTHON_API_URL` env var inconsistency — AI server calls will fail silently
**File:** `backend/src/routes/interview.ts` lines 910, 1012  
**Problem:** The real-time video/audio analysis routes use `process.env.PYTHON_API_URL` but `backend/.env` defines `PYTHON_AI_SERVER_URL`. The fallback is `'http://localhost:8000'` which is unreachable on Render.
```ts
const pythonServerUrl = process.env.PYTHON_API_URL || 'http://localhost:8000'; // wrong var name
```
**Fix:** Change to `process.env.PYTHON_AI_SERVER_URL` in both places.

---

### 7. AI Server cannot be deployed on Render free/starter tier
**File:** `ai-server/requirements.txt`, `ai-server/Dockerfile`  
**Problem:** The Python AI server requires:
- `mediapipe==0.10.8` — needs OpenCV + system libs (libGL, libSM, etc.)
- `torch==2.1.1` — ~2GB download, exceeds Render free tier memory (512MB)
- `transformers==4.35.2` — another ~1GB
- `spacy` with `en_core_web_sm` model download at build time

Render free tier has 512MB RAM and 0.1 CPU. This server will OOM on startup.  
**Fix options:**
- Deploy AI server on Railway, Fly.io, or a $7/month Render instance with 1GB RAM
- Or strip it down to only Gemini API calls (remove MediaPipe/torch/transformers) since those are the only parts actually called

---

### 8. Frontend Dockerfile runs `npm run dev` in production — wrong
**File:** `frontend/Dockerfile`  
**Problem:**
```dockerfile
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```
This runs the Vite dev server in production. It's slow, unoptimized, and not how Vercel works anyway. Vercel builds the static files and serves them via CDN — it doesn't run a Node process.  
**Fix:** This Dockerfile is irrelevant for Vercel deployment. Vercel reads `vite build` from `package.json` scripts automatically. The Dockerfile only matters if you're self-hosting.

---

### 9. `mongoose` in `frontend/package.json` — will bloat the bundle
**File:** `frontend/package.json`  
**Problem:** `mongoose` is listed as a frontend dependency. It's a Node.js ODM that cannot run in a browser. Vite will try to bundle it, fail, or produce a massive broken chunk.  
**Fix:** Remove `mongoose` from `frontend/package.json`. The frontend never talks to MongoDB directly.

---

## MEDIUM ISSUES — Fix before launch, not blockers

### 10. Hundreds of `console.log` statements in production backend
**Files:** `backend/src/routes/interview.ts`, `backend/src/routes/user.ts`, `backend/src/routes/admin.ts`  
**Problem:** Every interview creation logs the full request body including user data. On Render, these go to stdout and are visible in logs. Sensitive data (user IDs, resume content, question params) leaks into logs.  
**Fix:** Replace all `console.log` with `logger.debug()` or `logger.info()`. The vite.config already drops `console` in frontend builds — do the same for backend.

---

### 11. Hardcoded fallback API key in interview routes
**File:** `backend/src/routes/interview.ts` lines 911, 1013  
```ts
const apiKey = process.env.PYTHON_AI_SERVER_API_KEY || 'smart-interview-ai-python-server-key-2024';
```
**Problem:** If `PYTHON_AI_SERVER_API_KEY` is not set in Render env vars, the hardcoded key is used. This is a known secret in the codebase.  
**Fix:** Remove the fallback. Throw an error if the key is missing.

---

### 12. JWT access token expires in 15 minutes — no silent refresh on Vercel
**File:** `backend/.env`, `frontend/src/app/services/api.ts`  
**Problem:** The token refresh logic in `api.ts` retries on 401, but if the user is on a slow connection or the refresh token itself expires (7 days), they get silently redirected to `/login` mid-interview — losing all progress.  
**Fix:** Add a proactive token refresh (refresh 2 minutes before expiry) using a timer in `authStore`.

---

### 13. `STRIPE_PRO_PRICE_ID=price_pro_monthly` is a fake ID
**File:** `backend/.env`  
**Problem:** The Stripe price IDs are placeholder strings. The billing portal will not show correct plan information. Subscription webhooks may fail to match plans.  
**Fix:** Create real Stripe products/prices in the Stripe dashboard and use the real `price_xxx` IDs.

---

### 14. Rate limiter uses in-memory store — resets on every Render deploy
**File:** `backend/src/middleware/rateLimiter.ts`  
**Problem:** `express-rate-limit` defaults to an in-memory store. On Render, every deploy or restart resets all rate limit counters. Brute force attacks can exploit deploy windows.  
**Fix:** Use `rate-limit-redis` with your Redis URL as the store.

---

### 15. `REDIS_URL=redis://localhost:6379` in backend `.env`
**File:** `backend/.env`  
**Problem:** Redis is not available on Render unless you add a Redis service. The current URL points to localhost which doesn't exist on Render.  
**Fix:** Either add a Redis service on Render (or use Upstash free tier) and update `REDIS_URL`, or make Redis fully optional with graceful degradation (it already degrades gracefully, but rate limiting and caching won't work).

---

## DEPLOYMENT CHECKLIST

### Before deploying to Vercel (Frontend)

- [ ] Fix #3 — Add `frontend/vercel.json` with SPA rewrite rule
- [ ] Fix #9 — Remove `mongoose` from `frontend/package.json`
- [ ] Set env var `VITE_API_BASE_URL=https://your-render-backend.onrender.com/api`
- [ ] Set env var `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`
- [ ] Verify `vite build` completes without errors locally first
- [ ] Set Vercel build command: `npm run build`, output dir: `dist`, root: `frontend`

### Before deploying to Render (Backend)

- [ ] Fix #1 — Auth0 JWT verification
- [ ] Fix #2 — Remove mock user fallback in production
- [ ] Fix #4 — Add `render.yaml`
- [ ] Fix #5 — Set `FRONTEND_URL` to Vercel URL in Render env vars
- [ ] Fix #6 — Fix `PYTHON_API_URL` → `PYTHON_AI_SERVER_URL`
- [ ] Fix #11 — Remove hardcoded API key fallback
- [ ] Fix #14 — Switch rate limiter to Redis store
- [ ] Set `NODE_ENV=production` in Render env vars
- [ ] Set all required env vars (see list below)
- [ ] Verify `npm run build` (TypeScript compile) passes locally
- [ ] Set build command: `npm ci && npm run build`, start command: `npm start`

### Required Render Environment Variables

```
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=<strong-random-64-char>
JWT_REFRESH_SECRET=<strong-random-64-char>
GEMINI_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...  (real Stripe ID)
STRIPE_ENTERPRISE_PRICE_ID=price_...  (real Stripe ID)
FRONTEND_URL=https://your-app.vercel.app
EMAIL_USER=...
EMAIL_PASSWORD=...
PYTHON_AI_SERVER_URL=https://your-ai-server.onrender.com  (if deployed)
PYTHON_AI_SERVER_API_KEY=<strong-random-key>
REDIS_URL=redis://...  (Upstash or Render Redis)
```

### AI Server — Separate deployment decision needed

The Python AI server cannot run on Render free tier due to memory requirements. Options:
1. **Skip for now** — The app works without it (Gemini runs in Node.js backend, resume parsing degrades gracefully)
2. **Railway** — $5/month, 512MB RAM, supports Docker
3. **Fly.io** — Free tier with 256MB, may work if you strip torch/transformers
4. **Render paid** — $7/month for 1GB RAM instance

---

## What Actually Works Right Now (Production-Ready Features)

| Feature | Ready? |
|---|---|
| User registration + login + email verification | ✅ |
| JWT auth + token refresh | ✅ |
| Interview creation with Gemini questions | ✅ |
| Interview session (text answers) | ✅ |
| Coding interview with Piston execution | ✅ |
| Resume upload to Cloudinary | ✅ |
| Stripe payments (test mode) | ✅ |
| Dashboard + history | ✅ |
| Feedback generation | ✅ |
| Admin panel | ✅ |
| Real-time video/audio AI analysis | ❌ (AI server not deployed) |
| WebRTC peer video | ❌ (no TURN server) |
| Interview recording storage | ❌ (not implemented) |
| PDF report export | ❌ (window.print only) |
| Practice history persistence | ✅ (fixed — MongoDB) |
| Scheduling emails | ✅ (fixed — Gmail SMTP) |
