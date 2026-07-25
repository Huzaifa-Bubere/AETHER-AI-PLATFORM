# Integrating the Aptitude/Technical Quiz Module

This drops into your existing `Mock_Interview_Ai` project (backend/, frontend/)
without touching your interview, resume, or payment code.

## 1. Copy files

```
backend/src/models/AptitudeQuestion.ts   → backend/src/models/
backend/src/models/AptitudeTest.ts       → backend/src/models/
backend/src/models/AptitudeAttempt.ts    → backend/src/models/
backend/src/controllers/*.ts             → backend/src/controllers/
backend/src/services/*.ts                → backend/src/services/
backend/src/routes/*.ts                  → backend/src/routes/
backend/src/utils/aptitudeImageUpload.ts → backend/src/utils/

frontend/src/store/aptitudeStore.ts          → frontend/src/store/
frontend/src/components/aptitude/*          → frontend/src/components/aptitude/
frontend/src/pages/aptitude/*               → frontend/src/pages/aptitude/
frontend/src/pages/admin/aptitude/*         → frontend/src/pages/admin/aptitude/
```

## 2. Backend wiring

**a) Install new dependencies** (in `backend/`):
```bash
npm install streamifier @google/generative-ai
npm install -D @types/multer
```
(`multer`, `mongoose`, `cloudinary` are already in your stack per the report.)

**b) Register routes** in `backend/src/server.ts` (or wherever you mount routes):
```ts
import aptitudeStudentRoutes from './routes/aptitudeStudent.routes';
import aptitudeAdminRoutes from './routes/aptitudeAdmin.routes';

app.use('/api/aptitude', aptitudeStudentRoutes);
app.use('/api/admin/aptitude', aptitudeAdminRoutes);
```

**c) Uncomment auth middleware** in both route files and point them at your
real middleware (the report references JWT access tokens, so this is likely
something like `middleware/auth.middleware.ts` with `authenticate` +
`requireAdmin`):
```ts
router.use(authenticate);            // aptitudeStudent.routes.ts
router.use(authenticate, requireAdmin); // aptitudeAdmin.routes.ts
```

**d) Point the Cloudinary + Gemini wrappers at your existing config** — three
files have `ADAPT:` comments at the top telling you exactly what to swap:
- `utils/aptitudeImageUpload.ts` → reuse your existing `cloudinary.config()` call
  (the one already used for resume uploads) instead of configuring a second one.
- `services/aptitudeAI.service.ts` → reuse your existing Gemini client setup.
- `controllers/adminAptitude.controller.ts` (`toggleStudentBlock`) → point at
  your real `User` model path, and add an `isBlocked: Boolean` field to it if
  it isn't there yet.

**e) No new env vars are required** — this reuses `GEMINI_API_KEY`,
`GEMINI_MODEL`, and your existing Cloudinary vars from your current `.env`.
(You should have already rotated those after the earlier screenshot — this is
a good moment to confirm you did.)

## 3. Frontend wiring

**a) Install new dependency** (in `frontend/`):
```bash
npm install recharts
```
(You already have `axios`, `zustand`, and Tailwind per the report.)

**b) Add routes** in your router (e.g. `frontend/src/App.tsx` or wherever your
`<Routes>` live):
```tsx
import TestSelection from './pages/aptitude/TestSelection';
import ExamRoom from './pages/aptitude/ExamRoom';
import ResultsDashboard from './pages/aptitude/ResultsDashboard';
import AdminDashboard from './pages/admin/aptitude/AdminDashboard';
import QuestionManager from './pages/admin/aptitude/QuestionManager';
import TestManager from './pages/admin/aptitude/TestManager';
import StudentManager from './pages/admin/aptitude/StudentManager';

// Student-facing
<Route path="/aptitude" element={<TestSelection />} />
<Route path="/aptitude/attempts/:attemptId" element={<ExamRoom />} />
<Route path="/aptitude/attempts/:attemptId/result" element={<ResultsDashboard />} />

// Admin (nest under your existing admin layout/guard)
<Route path="/admin/aptitude" element={<AdminDashboard />} />
<Route path="/admin/aptitude/questions" element={<QuestionManager />} />
<Route path="/admin/aptitude/tests" element={<TestManager />} />
<Route path="/admin/aptitude/students" element={<StudentManager />} />
```

**c) Swap the local `axios.create(...)` calls** in each page/store for your
existing configured `api` instance (the one with the JWT interceptor) —
every file that needs it has a comment marking the line to change.

## 4. Seed data to test with

You need question images before a test can run. Fastest way to try it end to
end:
1. Log in as admin → Question Bank → Add Question → upload any image, set
   category `quantitative-aptitude`, difficulty `easy`, correct option `A`.
   Repeat until you have at least as many `easy` questions as your test's
   `difficultyPlan.easy.count` (15 by default).
2. Admin → Tests → Create Test → pick "Aptitude", tick `quantitative-aptitude`,
   leave the default 15/15/15 counts (or lower them to match how many
   questions you actually uploaded) → Publish.
3. As a student, go to `/aptitude` → Start Test.

## 5. What's intentionally left as a stub / your decision

- **Pass threshold** is hardcoded at 40% in `finalizeSubmission` — pull it
  from a test-level field if you want it configurable per test.
- **`toggleStudentBlock`** assumes a `User.isBlocked` boolean; wire it to
  your actual account-status model.
- **Rank** (mentioned in your report's result fields) isn't computed here —
  it needs a leaderboard query across all attempts for a given test, which
  I left out since it wasn't in the notes' "must have" list. Say the word and
  I'll add it.
- **Tab-switch auto-submit** currently fires on ANY tab blur (matches your
  notes: "Tab switching / minimizing of browser window will lead to auto
  submit"). If that's too aggressive in practice (e.g. someone alt-tabs to
  check something for 1 second), tell me and I'll add a grace-period warning
  before submitting instead.
