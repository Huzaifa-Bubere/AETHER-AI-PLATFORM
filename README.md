# Smart Interview AI Platform

A comprehensive AI-powered interview preparation platform with real-time video interviews, code execution, resume analysis, and detailed feedback generation.

## 🚀 Features

### Core Features
- **AI-Powered Mock Interviews** - Conduct realistic technical and behavioral interviews with AI
- **Real-time Video Analysis** - Emotion detection, speech analysis, and body language assessment
- **Code Execution Engine** - Support for Python, JavaScript, TypeScript, Java, C++, C, C#
- **Resume Analyzer** - AI-powered resume parsing and improvement suggestions
- **Detailed Feedback Reports** - Comprehensive performance analysis with downloadable PDFs
- **Practice Mode** - Prepare with coding problems and interview questions
- **Interview Scheduling** - Schedule and manage mock interviews
- **Payment Integration** - Stripe payment gateway with INR support
- **Admin Dashboard** - Platform analytics, user management, and system monitoring

### Technical Features
- **WebRTC Video Streaming** - Real-time video communication
- **Socket.IO Integration** - Live interview sessions
- **Redis Caching** - Performance optimization
- **Email Notifications** - Payment receipts and notifications
- **File Storage** - Cloudinary and local storage support
- **Rate Limiting** - API protection and security
- **JWT Authentication** - Secure user authentication
- **Role-based Access Control** - Admin and user roles

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Socket.IO Client for real-time communication
- Axios for API calls
- React Router for navigation

**Backend:**
- Node.js with Express
- TypeScript
- MongoDB with Mongoose
- Redis for caching
- Socket.IO for WebRTC signaling
- JWT for authentication
- Stripe for payments

**AI Server:**
- Python FastAPI
- Google Gemini AI
- OpenCV for video analysis
- Speech recognition
- Emotion detection
- Resume parsing

**Infrastructure:**
- Docker & Docker Compose
- Nginx (production)
- PM2 (process management)

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- MongoDB 5.0+
- Redis 6.0+
- Docker & Docker Compose (optional)

### Environment Variables

Create `.env` files in respective directories:

**backend/.env:**
```env
# Server
PORT=5001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/smart-interview-ai

# JWT
JWT_ACCESS_SECRET=your-access-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# Email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# AI Server
PYTHON_API_URL=http://localhost:8000
PYTHON_AI_SERVER_API_KEY=smart-interview-ai-python-server-key-2024

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# Frontend URL
FRONTEND_URL=http://localhost:5175
```

**ai-server/.env:**
```env
# Server
PORT=8000
HOST=0.0.0.0

# API Key
API_KEY=smart-interview-ai-python-server-key-2024

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

**frontend/.env:**
```env
VITE_API_BASE_URL=http://localhost:5001
VITE_WS_URL=http://localhost:5001
```

### Installation Steps

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd smart-interview-ai
```

#### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

#### 3. Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

#### 4. Install AI Server Dependencies
```bash
cd ../ai-server
python -m venv myenv
source myenv/bin/activate  # On Windows: myenv\Scripts\activate
pip install -r requirements.txt
```

#### 5. Start Services

**Option A: Using Docker Compose (Recommended)**
```bash
docker-compose up -d
```

**Option B: Manual Start**

Terminal 1 - MongoDB:
```bash
mongod
```

Terminal 2 - Redis:
```bash
redis-server
```

Terminal 3 - Backend:
```bash
cd backend
npm run dev
```

Terminal 4 - Frontend:
```bash
cd frontend
npm run dev
```

Terminal 5 - AI Server:
```bash
cd ai-server
source myenv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

## 🎯 Usage

### Access the Application
- **Frontend**: http://localhost:5175
- **Backend API**: http://localhost:5001
- **AI Server**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Default Admin Account
Create an admin user by updating a user in MongoDB:
```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { "auth.role": "admin" } }
)
```

### Test Payment
Use Stripe test cards:
- **Success**: 4242 4242 4242 4242
- **3D Secure**: 4000 0027 6000 3184
- Any future expiry date and CVC

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### User Endpoints
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `GET /api/user/stats` - Get user statistics

### Interview Endpoints
- `POST /api/interview/create` - Create interview
- `GET /api/interview/:id` - Get interview details
- `GET /api/interview/history` - Get interview history
- `PUT /api/interview/:id/complete` - Complete interview

### Resume Endpoints
- `POST /api/resume/upload` - Upload resume
- `GET /api/resume/latest` - Get latest resume
- `GET /api/resume/:id/view` - View resume
- `GET /api/resume/:id/download` - Download resume

### Payment Endpoints
- `POST /api/payment/create-checkout-session` - Create Stripe session
- `GET /api/payment/verify-session/:sessionId` - Verify payment
- `GET /api/payment/history` - Get payment history

### Admin Endpoints
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/users` - List all users
- `GET /api/admin/interviews` - List all interviews
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

## 🔧 Configuration

### Subscription Plans
Edit in `backend/src/routes/payment.ts`:
```typescript
const plans = {
  pro: { price: 2499, currency: 'inr' },      // ₹2,499/month
  enterprise: { price: 8499, currency: 'inr' } // ₹8,499/month
}
```

### Rate Limits
Edit in `backend/src/middleware/rateLimiter.ts`:
```typescript
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

### File Upload Limits
Edit in `backend/src/routes/resume.ts`:
```typescript
const upload = multer({
  limits: { fileSize: 10485760 }, // 10MB
  fileFilter: // pdf, doc, docx
});
```

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm test
npm run test:coverage
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

## 📊 Project Structure

```
smart-interview-ai/
├── backend/
│   ├── src/
│   │   ├── middleware/      # Auth, rate limiting, sanitization
│   │   ├── models/          # MongoDB models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Helper functions
│   │   ├── app.ts           # Express app configuration
│   │   └── server.ts        # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── components/  # Reusable components
│   │       ├── pages/       # Page components
│   │       ├── services/    # API services
│   │       ├── types/       # TypeScript types
│   │       └── App.tsx      # Main app component
│   ├── package.json
│   └── vite.config.ts
├── ai-server/
│   ├── src/
│   │   ├── models/          # Pydantic models
│   │   ├── services/        # AI services
│   │   └── main.py          # FastAPI app
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

## 🔐 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - DDoS protection
- **Input Sanitization** - XSS protection
- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **HTTPS Ready** - SSL/TLS support
- **CSP Headers** - Content Security Policy

## 🚀 Deployment

### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Serve dist/ folder with nginx or any static server
```

**AI Server:**
```bash
cd ai-server
gunicorn src.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Docker Deployment
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 License

This project is licensed under the MIT License.


## 🎉 Acknowledgments

- Google Gemini AI for interview question generation
- Stripe for payment processing
- Cloudinary for file storage
- MongoDB for database
- Redis for caching

---

**Built with ❤️ for better interview preparation**
