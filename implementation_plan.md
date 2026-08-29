# Implementation Plan: User Dashboard Aptitude Integration, Admin Management Navigation & Project Run Setup

This plan addresses all requirements:
1. **Direct User Dashboard Aptitude Access**: Adding a direct Aptitude Test card alongside Technical Interview and Coding Challenge, and fixing navigation links.
2. **Admin Question Creation & Visibility**: Supporting text questions (statement + options A, B, C, D) as well as image questions, graceful image handling, relaxing question selection so tests work regardless of bank size, and auto-seeding sample questions and tests.
3. **Admin Dashboard vs Candidate Separation & Complete UI Navigation**: Creating an Admin Management Hub on `/admin`, adding an Admin sub-navigation bar across all admin aptitude pages, and role-based Header navigation.
4. **Full Project Verification & Runner Scripts**: Creating root `package.json` / runner scripts (`run-all.bat`, `run-all.ps1`) and instructions to run Backend, Frontend, and AI Server smoothly.

---

## Proposed Changes

### 1. User Dashboard & Header Navigation
- **`frontend/src/app/pages/DashboardPage.tsx`**:
  - Add an **Aptitude & Technical MCQ** card to Quick Actions (3-card grid with Technical Interview, Coding Challenge, Aptitude Test).
  - Add aptitude progress/recommendations in Next Steps.
- **`frontend/src/app/components/Header.tsx`**:
  - Replace `<a>` tag reloads with React Router `<Link>`.
  - Add role-based navigation: when `user.auth.role === 'admin'`, show Admin navigation links (Admin Overview, Question Bank, Tests Manager, Students, Aptitude Analytics, Switch to Candidate View) and Admin Badge.

### 2. Question Model, Selector & Controller Enhancements
- **`backend/src/models/AptitudeQuestion.ts`**:
  - Add support for `questionText` (string) and `options` (`{ A: string, B: string, C: string, D: string }`).
  - Make `imageUrl` and `imagePublicId` optional.
- **`backend/src/controllers/adminAptitude.controller.ts`**:
  - Support creating text-based questions (JSON or form) and image-based questions.
  - Graceful Cloudinary / local data-URI fallback when image is uploaded so it never crashes if Cloudinary credentials are not set.
- **`backend/src/services/questionSelector.service.ts`**:
  - Update `buildQuestionSet` to dynamically pick questions from available pool across difficulties and categories if exact difficulty count is not reached, preventing "Not enough easy questions" crashes.
- **`backend/src/services/seedAptitude.service.ts`**:
  - New service to auto-seed default admin account (`admin@smartinterview.ai` / `Admin@123456`) and a rich bank of Aptitude & Technical MCQs with published tests if database is empty.
- **`backend/src/server.ts`**:
  - Trigger auto-seeder after database connection.

### 3. Aptitude Test Taking & Results UI
- **`frontend/src/pages/aptitude/ExamRoom.tsx`**:
  - Render `questionText` and option text buttons when present, or image when image is present.
- **`frontend/src/pages/aptitude/ResultsDashboard.tsx`**:
  - Render text questions and options in the review section.
- **`frontend/src/store/aptitudeStore.ts`**:
  - Update `Question` interface with `questionText` and `options`.

### 4. Admin Management Hub & Navigation
- **`frontend/src/app/pages/AdminDashboardPage.tsx`**:
  - Add **Admin Management Hub** at the top of `/admin` with cards for Question Bank, Test Manager, Student Performance, and Aptitude Analytics.
- **`frontend/src/components/admin/AdminNav.tsx`**:
  - Create reusable Admin Tab Navigation bar for all `/admin/*` pages.
- **`frontend/src/pages/admin/aptitude/QuestionManager.tsx`**:
  - Add text-based question input form (question statement, options A, B, C, D, explanation) alongside image upload option.
  - Include AdminNav header.
- **`frontend/src/pages/admin/aptitude/TestManager.tsx`**:
  - Include AdminNav header and improved test creation with flexible question counts.
- **`frontend/src/pages/admin/aptitude/StudentManager.tsx`**:
  - Include AdminNav header.
- **`frontend/src/pages/admin/aptitude/AdminDashboard.tsx`**:
  - Include AdminNav header.

### 5. Project Run Setup & Scripts
- **`package.json` (root)**:
  - Add root scripts `npm run dev` (running backend and frontend concurrently), `npm run dev:backend`, `npm run dev:frontend`, `npm run dev:ai`.
- **`run-all.bat` / `run-all.ps1`**:
  - Batch / PowerShell scripts for 1-click startup on Windows.

---

## Verification Plan

### Automated / Build Verification
- Build frontend: `cmd /c "npm run build"` in `frontend/`
- Build backend: `cmd /c "npm run build"` in `backend/`

### Manual Verification
- Test user flow:
  1. Login as user (`/login`) -> go to `/dashboard` -> click "Aptitude & Technical MCQ" -> lands on `/aptitude`.
  2. Start test -> take exam with text and/or image questions -> submit -> view results with AI feedback.
- Test admin flow:
  1. Login as admin (`/admin/login`) with `admin@smartinterview.ai` -> redirected to `/admin`.
  2. See Admin Management Hub cards -> click "Question Bank" (`/admin/aptitude/questions`).
  3. Add a new text question or image question -> see it listed in Question Bank.
  4. Create / publish test in Test Manager -> test immediately becomes available to users.
  5. Navigate between Admin tools using the Admin Navigation Bar.
