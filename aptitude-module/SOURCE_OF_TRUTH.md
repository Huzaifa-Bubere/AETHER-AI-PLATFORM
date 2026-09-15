# Aptitude source

The executable aptitude implementation lives in `backend/src` and `frontend/src`.
Files in this directory now re-export those implementations so authentication,
answer persistence and grading fixes cannot diverge between duplicate copies.

Run the application's normal backend/frontend build commands. This directory
does not contain an independent application or package manifest. Do not copy the
re-export files to another repository without their referenced implementation.
