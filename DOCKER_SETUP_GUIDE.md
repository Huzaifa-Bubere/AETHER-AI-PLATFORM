# 🐳 AETHER AI Platform — Complete Docker Setup Guide

> Share this file with your friend. Everything they need is here.

---

## 📋 What Gets Deployed

| Container | Technology | Port |
|-----------|-----------|------|
| `aether-nginx` | Nginx (reverse proxy) | **80** ← main entry |
| `aether-frontend` | React + Vite (via Nginx) | 5174 |
| `aether-backend` | Node.js + Express | 5001 |
| `aether-ai-server` | Python + FastAPI | 8000 |
| `aether-job-provider` | Python + FastAPI | 8010 |
| `aether-mongodb` | MongoDB 7.0 | 27017 |
| `aether-redis` | Redis 7.2 | 6379 |

> **Your friend only needs to open `http://localhost` in their browser.**
> Nginx handles all routing automatically.

---

## ✅ Prerequisites

Your friend must have these installed **before** anything else:

### 1. Docker Desktop
Download → https://www.docker.com/products/docker-desktop/

- **Windows**: Requires WSL 2 (Docker Desktop installs it automatically)
- **Mac**: Works out of the box
- **Linux**: Install Docker Engine + Docker Compose plugin

Verify installation:
```bash
docker --version          # should be 24+
docker compose version    # should be 2.20+
```

### 2. Git (to clone the repo)
Download → https://git-scm.com/downloads

---

## 🚀 Step-by-Step Setup (One Time Only)

### Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

> Replace with your actual GitHub URL.

---

### Step 2 — Create the Environment File

```bash
# Linux / Mac / Git Bash on Windows:
cp .env.example .env

# Windows CMD:
copy .env.example .env

# Windows PowerShell:
Copy-Item .env.example .env
```

Open `.env` in any text editor and fill in **at minimum** these values:

| Variable | Where to get it | Required? |
|----------|----------------|-----------|
| `JWT_ACCESS_SECRET` | Run `openssl rand -hex 48` | ✅ YES |
| `JWT_REFRESH_SECRET` | Run `openssl rand -hex 48` (DIFFERENT value) | ✅ YES |
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey (free) | ✅ YES |
| `PYTHON_AI_SERVER_API_KEY` | Run `openssl rand -hex 48` (any random string) | ✅ YES |
| `CLOUDINARY_CLOUD_NAME` | https://cloudinary.com (free tier) | Optional |
| `CLOUDINARY_API_KEY` | Same Cloudinary account | Optional |
| `CLOUDINARY_API_SECRET` | Same Cloudinary account | Optional |

**Generate random secrets quickly:**
```bash
# Linux/Mac/Git Bash:
openssl rand -hex 48

# Windows PowerShell (no openssl needed):
-join ((48..57) + (97..122) | Get-Random -Count 96 | % {[char]$_})
```

> ⚠️ The app will NOT start if JWT secrets or PYTHON_AI_SERVER_API_KEY are left as placeholder text.

---

### Step 3 — Build and Start Everything

```bash
docker compose up --build -d
```

> **First run takes 5–15 minutes** — Docker downloads images and installs Python ML packages.
> Subsequent starts take ~30 seconds.

**When done you'll see:**
```
✔ Container aether-mongodb        Healthy
✔ Container aether-redis          Healthy
✔ Container aether-ai-server      Healthy
✔ Container aether-job-provider   Healthy
✔ Container aether-backend        Healthy
✔ Container aether-frontend       Started
✔ Container aether-nginx          Started
```

---

### Step 4 — Open the App

```
http://localhost
```

**Done! ✅**

---

## 🔄 Daily Usage Commands

```bash
# Start (after initial setup)
docker compose up -d

# Stop
docker compose down

# Restart one service
docker compose restart backend

# See all running containers
docker compose ps

# Live logs (all services)
docker compose logs -f

# Live logs (one service)
docker compose logs -f backend
docker compose logs -f ai-server
```

---

## 🔁 After Pulling New Code from GitHub

```bash
git pull
docker compose up --build -d
```

---

## 🔍 Troubleshooting

### ❌ "Port already in use"
Something else is using port 80 or 5001.
```bash
# Windows — find what's using port 80:
netstat -ano | findstr :80

# Kill it or change the port in docker-compose.yml: "8080:80"
```

### ❌ Container keeps restarting
```bash
docker compose logs backend     # read the actual error
```
Most common cause: missing/wrong values in `.env`.

### ❌ "Cannot connect to Docker daemon"
Docker Desktop is not running — open it from the taskbar/applications.

### ❌ Build fails on AI server
```bash
docker compose build ai-server --no-cache --progress=plain
```
Needs internet connection and ~2 GB disk space.

### ❌ MongoDB connection refused after start
```bash
docker compose restart backend
```
The backend started before MongoDB was fully ready.

---

## 🌐 Service URLs (for testing)

| Service | URL |
|---------|-----|
| **Main App** | http://localhost |
| Backend API health | http://localhost:5001/health |
| AI Server health | http://localhost:8000/health |
| Job Provider health | http://localhost:8010/health |

---

## 🧹 Full Reset (Wipes All Data)

```bash
# Stop + delete all containers and volumes (DELETES DATABASE)
docker compose down -v

# Start fresh
docker compose up --build -d
```

---

## 📊 System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Disk | 10 GB free | 20 GB free |
| CPU | 4 cores | 8 cores |

> Set Docker Desktop RAM to 6+ GB: Docker Desktop → Settings → Resources → Memory

---

## 📁 Project Structure

```
AI_Placement_Trainning/
├── docker-compose.yml        ← orchestrates all 7 containers
├── .env.example              ← copy this → .env and fill in secrets
├── .env                      ← YOUR secrets (never commit to git!)
├── scripts/
│   └── mongo-init.js         ← runs automatically on first DB start
├── nginx/
│   └── nginx.conf            ← reverse proxy (routes / → frontend, /api → backend)
├── frontend/                 ← React + Vite
├── backend/                  ← Node.js + Express + TypeScript
├── ai-server/                ← Python + FastAPI + ML models
└── job-provider-service/     ← Python + FastAPI (job scraper)
```
