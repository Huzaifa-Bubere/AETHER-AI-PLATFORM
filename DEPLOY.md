# Deployment Guide
## Frontend → Vercel | Backend → Render

---

## 1. Deploy Backend to Render

### Steps
1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml` — confirm settings
5. Add all environment variables listed below
6. Deploy

### Build & Start (auto-detected from render.yaml)
- Build: `cd backend && npm ci && npm run build`
- Start: `cd backend && npm start`
- Health check: `/health`

### Required Environment Variables on Render
```
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=<64-char random string>
JWT_REFRESH_SECRET=<64-char random string>
GEMINI_API_KEY=AIza...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...   ← real Stripe Price ID
STRIPE_ENTERPRISE_PRICE_ID=price_...   ← real Stripe Price ID
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM=your@gmail.com
FRONTEND_URL=https://your-app.vercel.app   ← set AFTER Vercel deploy
PYTHON_AI_SERVER_URL=https://your-ai-server.onrender.com   ← optional
PYTHON_AI_SERVER_API_KEY=<random string>   ← optional
```

---

## 2. Deploy Frontend to Vercel

### Steps
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Framework: Vite (auto-detected)
5. Build command: `npm run build` (auto-detected)
6. Output directory: `dist` (auto-detected)
7. Add environment variables below
8. Deploy

### Required Environment Variables on Vercel
```
VITE_API_BASE_URL=https://smart-interview-backend.onrender.com/api
VITE_AUTH0_DOMAIN=dev-eyw7prroknl3bvk6.us.auth0.com
VITE_AUTH0_CLIENT_ID=4CoejB1F9WBJZKEc7o17MWux3F51AXQA
VITE_AUTH0_AUDIENCE=https://interview-coach-api
```

### After Vercel deploys
Copy your Vercel URL (e.g. `https://smart-interview-ai.vercel.app`) and set it as `FRONTEND_URL` in Render env vars, then redeploy the backend.

---

## 3. MongoDB Atlas Setup
- Network Access → Add `0.0.0.0/0` (allow all) for Render (Render IPs change)
- Or use Render's static outbound IPs (paid plan) and whitelist those

---

## 4. Stripe Setup (for payments to work)
1. Go to Stripe Dashboard → Products → Create product "Pro" and "Enterprise"
2. Copy the Price IDs (format: `price_1ABC...`)
3. Set `STRIPE_PRO_PRICE_ID` and `STRIPE_ENTERPRISE_PRICE_ID` in Render

---

## 5. AI Server (Optional)
The app works without the Python AI server — Gemini runs in the Node.js backend.
Resume parsing and real-time video/audio analysis require the AI server.

To deploy on Railway:
1. Connect GitHub repo
2. Set root to `ai-server`
3. Add env vars: `GEMINI_API_KEY`, `PYTHON_AI_SERVER_API_KEY`
4. Copy the Railway URL to `PYTHON_AI_SERVER_URL` in Render
