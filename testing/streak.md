# Streak — Testing

**Scope (spec §18–§23, §110):** the AETHER streak is a real count of real
qualifying activity, bucketed in the candidate's local timezone.

## How it works

- Source of truth: `UserActivityEvent` documents in MongoDB.
- Bucketing: `backend/src/utils/localDay.ts` converts each UTC timestamp to the
  candidate's configured `preferences.timezone` day key (`YYYY-MM-DD`).
- Levels (`StreakService.LEVEL_THRESHOLDS`): 0 = none, 1 = 1 activity,
  2 = 2, 3 = 3–4, 4 = 5+.
- Streak is alive on a day that is still in progress: it only breaks when a
  *completed* local day has no activity.

## Automated checks — PASS (`npx jest tests/streak.test.js`, 13/13)

| # | Check | Expected | Result |
|---|---|---|---|
| S-1 | 2026-09-27T20:00Z in `Asia/Kolkata` | day key `2026-09-28` (it is 01:30 there) | **PASS** |
| S-2 | 2026-09-28T02:00Z in `America/Los_Angeles` | day key `2026-09-27` (19:00 the previous day) | **PASS** |
| S-3 | 2026-09-28T00:00Z in `Asia/Kolkata` | day key `2026-09-28` — UTC midnight is 05:30 the **same** day there | **PASS** |
| S-4 | Invalid timezone | falls back to `UTC`, never throws | **PASS** |
| S-5 | `startOfLocalDayUtc('2026-09-28','Asia/Kolkata')` | `2026-09-27T18:30:00.000Z` | **PASS** |
| S-6 | DST transition (America/New_York, 2026-03-08) | resolves to the correct local midnight | **PASS** |
| S-7 | Month/year/leap boundaries | `2026-09-30 +1 = 2026-10-01`, `2028-02-28 +1 = 2028-02-29` | **PASS** |
| S-8 | 365-day window | exactly 365 keys, `2025-09-28` → `2026-09-27` | **PASS** |
| S-9 | Level thresholds | 0→0, 1→1, 2→2, 3→3, 4→3, 5→4, 50→4 | **PASS** |
| S-10 | Level 0 reserved | every count ≥ 1 yields level ≥ 1 (never a false zero) | **PASS** |
| S-11 | Day label format | `2026-09-27` → `27 Sep 2026` (locale-independent) | **PASS** |

## Manual checks — NOT TESTED

| # | Test | Steps | Expected | Actual |
|---|---|---|---|---|
| S-12 | Activity marks today | Complete a lesson → reload `/profile` | Today's cell is lit; current streak ≥ 1 | |
| S-13 | Persistence | Refresh the page | Heatmap and streak unchanged | |
| S-14 | Tooltip | Hover a cell with 4 events | "4 activities on <date>" + per-source breakdown | |
| S-15 | Streak breaks correctly | No activity for 2 days, then act today | Streak restarts at 1 | |
| S-16 | In-progress day does not break | Act today, act yesterday, none the day before | Streak = 2, not 1 | |
| S-17 | Timezone boundary | Set timezone to `Asia/Kolkata` in `/settings` at 06:00 IST | Events bucket to the correct IST day | |
| S-18 | Timezone change | Change timezone, reload | Heatmap re-buckets; totals unchanged | |
| S-19 | New user empty state | Fresh account → `/profile` | Fully empty grid + prompt. **No generated pattern.** | |
| S-20 | Role filtering | `GET /api/activity/streak?roleId=backend-developer` | Only that role's activity counted | |
| S-21 | Month label | Scan the 365-day grid | Month labels appear once per month boundary, correctly aligned | |
| S-22 | Mobile | View on a 375 px viewport | Grid scrolls horizontally; legend and summary remain usable | |

## Fixture to use (spec §110)

1. Sign in as the candidate test account.
2. Record activity across 4 consecutive days (lesson, quiz, coding submission,
   interview) plus one empty day.
3. Expected heatmap: 4 lit cells with a gap; current streak = 4 (or 3 if today
   is empty); longest streak = 4; active days = 4.

## What is NOT counted (spec §16)

Deliberately excluded — they are not evidence of work and would inflate the
streak: page views, button hovers, login requests, route changes, scroll depth.

Qualifying types are the closed list in
`backend/src/models/UserActivityEvent.ts` (`ACTIVITY_TYPES`).