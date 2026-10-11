# AETHER — Complete Local Run Guide (Windows)

> **Project:** AETHER — AI Placement Training Platform  
> **Repository:** `Huzaifa-Bubere/AETHER-AI-PLATFORM`  
> **Frontend:** React 18 + Vite + TypeScript  
> **Backend:** Node.js + Express + TypeScript + MongoDB  
> **AI Server:** Python 3.11 + FastAPI  
> **Cache:** Redis  
> **Default local ports:** Frontend `5175`, Backend `5001`, AI Server `8000`

This guide is written for **Windows Command Prompt (CMD)** and the current AETHER project structure.

---

## 1. Project folder

Your current local project path is:

```cmd
C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning
```

Open **Command Prompt** and enter:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning"
```

Check the main folders:

```cmd
dir
```

You should see folders such as:

```text
backend
frontend
ai-server
nginx
scripts
```

---

## 2. Required software

Verify Node.js and npm:

```cmd
node -v
npm -v
```

Recommended: Node.js 20+.

Verify Python 3.11:

```cmd
py -3.11 --version
```

or:

```cmd
python --version
```

Verify Git:

```cmd
git --version
```

If you want to use Docker:

```cmd
docker --version
docker compose version
```

Make sure **Docker Desktop is running** before Docker commands.

---

## 3. Important environment-file locations

AETHER currently reads environment variables from different locations.

### Backend runtime

The backend application reads:

```text
backend\.env
```

### Backend seed scripts

The current seed scripts are executed from `backend` but load:

```text
..\.env
```

That means the **project-root `.env`**.

So, if you use MongoDB Atlas, keep the MongoDB URI in both:

```text
PROJECT_ROOT\.env
PROJECT_ROOT\backend\.env
```

### AI Server

The AI Server reads:

```text
ai-server\.env
```

### Frontend

Vite reads:

```text
frontend\.env
```

---

## 4. Create `backend\.env`

Create:

```text
backend\.env
```

Recommended local configuration:

```env
NODE_ENV=development
PORT=5001

MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER/YOUR_DATABASE

JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-refresh-secret

FRONTEND_URL=http://localhost:5175

PYTHON_AI_SERVER_URL=http://localhost:8000
PYTHON_AI_SERVER_API_KEY=aether-local-ai-key

REDIS_URL=redis://localhost:6379

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=YOUR_SUPPORTED_GEMINI_MODEL

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

These three values are mandatory for backend startup:

```env
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
```

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be different.

Never push `.env` files to GitHub.

---

## 5. Create root `.env`

Create:

```text
AI_Placement_Trainning\.env
```

This is important for seed scripts and Docker Compose.

Example:

```env
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER/YOUR_DATABASE
SEED_MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER/YOUR_DATABASE

JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-refresh-secret

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=YOUR_SUPPORTED_GEMINI_MODEL

PYTHON_AI_SERVER_API_KEY=aether-local-ai-key

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

VITE_API_BASE_URL=/api
```

---

## 6. Create `ai-server\.env`

Create:

```text
ai-server\.env
```

Example:

```env
ENVIRONMENT=development
PORT=8000
HOST=0.0.0.0

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=YOUR_SUPPORTED_GEMINI_MODEL

PYTHON_AI_SERVER_API_KEY=aether-local-ai-key

REDIS_URL=redis://localhost:6379
```

Use the same `PYTHON_AI_SERVER_API_KEY` in both backend and AI Server.

---

## 7. Create `frontend\.env`

Create:

```text
frontend\.env
```

For local development:

```env
VITE_API_BASE_URL=http://localhost:5001
VITE_WS_URL=http://localhost:5001
```

The frontend is configured to run on:

```text
http://localhost:5175
```

---

# 8. First-time dependency installation

## Backend

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\backend"
npm install
```

## Frontend

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\frontend"
npm install
```

## AI Server

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\ai-server"
py -3.11 -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

# 9. Recommended development method

For active development, run AETHER in separate terminals.

You normally need:

1. Redis
2. AI Server
3. Backend
4. Frontend

If MongoDB Atlas is configured, you do not need a local MongoDB process.

---

# 10. Terminal 1 — Redis

Because Redis may not be installed directly on Windows, the easiest method is Docker:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning"
docker compose up -d redis
```

Test Redis:

```cmd
docker compose exec redis redis-cli ping
```

Expected:

```text
PONG
```

---

# 11. Terminal 2 — AI Server

Open a new CMD window:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\ai-server"
venv\Scripts\activate
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

If that import style fails, the Docker entrypoint confirms the app can also start with:

```cmd
python src\main.py
```

Open:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

Health:

```text
http://localhost:8000/health
```

CMD test:

```cmd
curl http://localhost:8000/health
```

---

# 12. Terminal 3 — Backend

Open another CMD window:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\backend"
npm run dev
```

Backend:

```text
http://localhost:5001
```

Health:

```text
http://localhost:5001/api/health
```

CMD test:

```cmd
curl http://localhost:5001/api/health
```

A healthy startup should confirm MongoDB and server connectivity. Redis/AI status may also be shown by health checks when configured.

---

# 13. Terminal 4 — Frontend

Open another CMD window:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\frontend"
npm run dev
```

Open:

```text
http://localhost:5175
```

---

# 14. Correct startup order

```text
MongoDB Atlas available
        ↓
Redis
        ↓
AI Server
        ↓
Backend
        ↓
Frontend
```

---

# 15. Seed the database

Run seed commands from:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\backend"
```

Remember: current seed scripts read the **project-root `.env`**.

Seed career roles:

```cmd
npm run seed:careers
```

Seed courses:

```cmd
npm run seed:courses
```

Seed learning topics:

```cmd
npm run seed:topics
```

Seed coding problems:

```cmd
npm run seed:problems
```

Run multi-role migration when required:

```cmd
npm run migrate:multi-role
```

---

# 16. Admin account

From backend:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\backend"
```

List admins:

```cmd
npm run seed:admin -- --list
```

Your current database previously showed:

```text
admin@aether.local
AETHER Administrator
verified=true
plan=enterprise
```

Create the admin if missing:

```cmd
npm run seed:admin
```

The current script uses these development defaults when no overrides are set:

```text
Email:    admin@aether.local
Password: Admin@12345
```

You can override them in the root `.env`:

```env
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

Verify credentials without opening the browser:

```cmd
npm run seed:admin -- --email admin@aether.local --password Admin@12345 --verify
```

Reset the password:

```cmd
npm run seed:admin -- --email admin@aether.local --password "YOUR_NEW_PASSWORD" --reset-password
```

Verify the new password:

```cmd
npm run seed:admin -- --email admin@aether.local --password "YOUR_NEW_PASSWORD" --verify
```

Unlock the admin after too many failed attempts:

```cmd
npm run seed:admin -- --email admin@aether.local --unlock
```

---

# 17. Quick daily startup

After setup, you do **not** need `npm install` every day.

## CMD 1 — Redis

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning"
docker compose up -d redis
```

## CMD 2 — AI Server

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\ai-server"
venv\Scripts\activate
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

## CMD 3 — Backend

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\backend"
npm run dev
```

## CMD 4 — Frontend

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\frontend"
npm run dev
```

Then open:

```text
http://localhost:5175
```

---

# 18. Docker — run the complete project

Current Docker Compose services include:

```text
frontend
backend
ai-server
mongodb
redis
nginx
```

Current Docker port mappings:

```text
Frontend: 5174
Backend:  5001
AI:       8000
MongoDB:  27017
Redis:    6379
```

Start Docker Desktop first.

Test:

```cmd
docker info
```

If you receive a `dockerDesktopLinuxEngine` error, Docker Desktop is not ready.

Build:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning"
docker compose build
```

Or build only application services:

```cmd
docker compose build backend frontend ai-server
```

Start:

```cmd
docker compose up -d
```

Check:

```cmd
docker compose ps
```

Docker URLs:

```text
Frontend:       http://localhost:5174
Backend:        http://localhost:5001
Backend health: http://localhost:5001/api/health
AI Server:      http://localhost:8000
AI Docs:        http://localhost:8000/docs
```

---

# 19. Docker logs

Backend:

```cmd
docker compose logs --tail=100 backend
```

AI Server:

```cmd
docker compose logs --tail=100 ai-server
```

Frontend:

```cmd
docker compose logs --tail=100 frontend
```

Redis:

```cmd
docker compose logs --tail=100 redis
```

All:

```cmd
docker compose logs --tail=200
```

Live backend logs:

```cmd
docker compose logs -f backend
```

Stop following logs with `Ctrl + C`.

---

# 20. Stop Docker

Stop and remove containers/networks while keeping named volumes:

```cmd
docker compose down
```

Stop without removing containers:

```cmd
docker compose stop
```

Start stopped containers again:

```cmd
docker compose start
```

Avoid this unless you intentionally want to remove local volume data:

```cmd
docker compose down -v
```

---

# 21. Build verification before Git push

## Backend

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\backend"
npm run build
```

Backend tests:

```cmd
npm test
```

Serial test run:

```cmd
npm test -- --runInBand
```

## Frontend

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\frontend"
npm run typecheck
npm run build
```

The current `build` script already runs typecheck before `vite build`.

## AI Server

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\ai-server"
venv\Scripts\activate
python -m compileall src
```

---

# 22. Feature verification checklist

```text
[ ] MongoDB reachable
[ ] Redis returns PONG
[ ] AI Server /health works
[ ] AI Server /docs works
[ ] Backend /api/health works
[ ] Frontend opens at 5175
[ ] Candidate login works
[ ] Admin login works
[ ] Dashboard loads
[ ] Aptitude loads
[ ] Technical MCQ loads
[ ] Coding loads
[ ] Interview loads
[ ] Resume Analyzer loads
[ ] Resume Builder loads
[ ] Career Learning loads
[ ] Career Intelligence loads
[ ] Analytics loads
[ ] Profile loads
[ ] Subscription page loads
```

---

# 23. MongoDB Atlas checklist

If the backend cannot connect to Atlas, check:

### Network Access

MongoDB Atlas:

```text
Security → Network Access
```

Allow your current public IP.

For short-lived development only, `0.0.0.0/0` permits all IPs, but it is less secure.

### Database Access

Check:

```text
Security → Database Access
```

Make sure username/password match your connection string.

### Password special characters

If the password contains characters such as:

```text
@ : / # %
```

URL-encode them inside the MongoDB URI.

---

# 24. Atlas DNS errors

If you see:

```text
querySrv ECONNREFUSED
ENOTFOUND
MongoServerSelectionError
```

Test DNS:

```cmd
nslookup -type=SRV _mongodb._tcp.YOUR_CLUSTER.mongodb.net
```

You can try DNS servers such as:

```text
8.8.8.8
1.1.1.1
```

The backend supports:

```env
DNS_SERVERS=8.8.8.8,1.1.1.1
```

---

# 25. Backend says `MONGODB_URI` is missing

Make sure this file exists:

```text
backend\.env
```

Then restart:

```cmd
npm run dev
```

---

# 26. Seed says no MongoDB URI configured

Current seed scripts use the **project-root `.env`**.

Make sure this exists:

```text
AI_Placement_Trainning\.env
```

with:

```env
MONGODB_URI=...
```

Then rerun the seed from `backend`.

---

# 27. AI Server virtual environment missing

If:

```cmd
venv\Scripts\activate
```

returns:

```text
The system cannot find the path specified.
```

first enter the AI Server folder:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\ai-server"
```

Then create it:

```cmd
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

---

# 28. Port already in use

Port 5001:

```cmd
netstat -ano | findstr :5001
```

Port 5175:

```cmd
netstat -ano | findstr :5175
```

Port 8000:

```cmd
netstat -ano | findstr :8000
```

Stop only the process you recognize:

```cmd
taskkill /PID YOUR_PID /F
```

---

# 29. Frontend opens but API requests fail

Check:

```text
frontend\.env
```

Manual mode should normally contain:

```env
VITE_API_BASE_URL=http://localhost:5001
```

Restart Vite after environment changes:

```text
Ctrl + C
npm run dev
```

---

# 30. Backend cannot reach AI Server

Verify:

```text
http://localhost:8000/health
```

Backend `.env`:

```env
PYTHON_AI_SERVER_URL=http://localhost:8000
PYTHON_AI_SERVER_API_KEY=aether-local-ai-key
```

AI Server `.env`:

```env
PYTHON_AI_SERVER_API_KEY=aether-local-ai-key
```

Restart both services after changes.

---

# 31. Gemini errors

A Gemini error does not always mean AETHER itself failed to start.

If you see `404 model not found` or `429 quota exceeded`, check:

```env
GEMINI_API_KEY=
GEMINI_MODEL=
```

Keep Gemini model selection environment-based rather than hardcoding an old model throughout the source.

---

# 32. Git check

From the real Git repository:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning"
git status
```

If Git says:

```text
fatal: not a git repository
```

you are probably inside a transfer/copy folder without `.git`.

Useful commands:

```cmd
git branch --show-current
git remote -v
git status --short
git diff --stat
```

Do not run `git add .` blindly if the project folder contains `.env`, reports, PDFs, PowerPoints, posters, generated output, or temporary files.

---

# 33. Recommended development workflow

```text
START
  ↓
Docker Desktop
  ↓
Redis
  ↓
AI Server
  ↓
Backend
  ↓
Frontend
  ↓
Open browser
  ↓
Test changed feature
  ↓
Backend build
  ↓
Frontend typecheck/build
  ↓
AI compileall
  ↓
Tests
  ↓
git status
  ↓
Commit only required code
```

---

# 34. Quick command reference

Project root:

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning"
```

Backend:

```cmd
cd backend
npm run dev
```

Frontend:

```cmd
cd frontend
npm run dev
```

AI Server:

```cmd
cd ai-server
venv\Scripts\activate
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Redis through Docker:

```cmd
docker compose up -d redis
```

Full Docker:

```cmd
docker compose up -d --build
```

Docker status:

```cmd
docker compose ps
```

Admin list:

```cmd
cd backend
npm run seed:admin -- --list
```

Seed data:

```cmd
npm run seed:careers
npm run seed:courses
npm run seed:topics
npm run seed:problems
```

Backend build:

```cmd
npm run build
```

Frontend verification:

```cmd
cd ..\frontend
npm run typecheck
npm run build
```

AI verification:

```cmd
cd ..\ai-server
venv\Scripts\activate
python -m compileall src
```

---

# 35. Local URLs

| Service | URL |
|---|---|
| Frontend development | `http://localhost:5175` |
| Docker frontend | `http://localhost:5174` |
| Backend | `http://localhost:5001` |
| Backend health | `http://localhost:5001/api/health` |
| AI Server | `http://localhost:8000` |
| AI health | `http://localhost:8000/health` |
| AI Swagger | `http://localhost:8000/docs` |
| Redis | `localhost:6379` |
| Local MongoDB Docker | `localhost:27017` |

---

# 36. Best run method for your current Windows setup

Because you already use MongoDB Atlas and Redis is easier to run through Docker on Windows, the recommended development setup is:

```text
MongoDB Atlas
      +
Redis Docker container
      +
AI Server locally
      +
Backend locally
      +
Frontend locally
```

### CMD 1

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning"
docker compose up -d redis
```

### CMD 2

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\ai-server"
venv\Scripts\activate
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### CMD 3

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\backend"
npm run dev
```

### CMD 4

```cmd
cd /d "C:\Huzaifa Degree\Final Year Project\Mock_Interview_Ai_V1\Mock_Interview_Ai\AI_Placement_Trainning\frontend"
npm run dev
```

Open:

```text
http://localhost:5175
```

---

# 37. Final health check

Before testing features:

```cmd
curl http://localhost:8000/health
```

Then:

```cmd
curl http://localhost:5001/api/health
```

Then open:

```text
http://localhost:5175
```

If all three work, the AETHER core stack is running.

---

## Final notes

- Do not commit `.env` files.
- Use Python 3.11 for the AI Server.
- Run seed scripts from the `backend` folder.
- Seed scripts currently read the project-root `.env`.
- The normal backend server reads `backend/.env`.
- The admin script supports list, verify, promote, reset-password and unlock operations.
- Restart the affected service after environment-variable changes.
- Restart Vite after frontend env changes.
- Rebuild Docker images after source-code changes when testing Docker deployment.
