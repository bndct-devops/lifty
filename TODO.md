# lifty — Checkpoint (2 Mar 2026)

## How to run
- **Quick start**: `./scripts/dev_up.sh`
- **Rebuild**: `docker compose up --build -d`
- **Reset DB**: `rm data/lifty.db && docker compose restart backend`
- App: http://localhost:5173 · API: http://localhost:8000
- **Prod** (Unraid/Dockge): frontend `:3420`, backend via `ghcr.io` images (compose config in README)

## Stack
- **Backend**: FastAPI + SQLModel + SQLite, Python 3.11
- **Frontend**: React 18 + Vite, single `App.jsx`, served via nginx
- **CI**: GitHub Actions → `ghcr.io/bndct-devops/lifty-{frontend,backend}:latest` (multi-arch amd64+arm64, concurrency cancellation on push)

---

## What's been built

### Backend
- Full CRUD: exercises (global, seeded on startup), workouts, sets
- `POST /api/workouts/{id}/start` + `.../finish` with timestamps
- `GET /api/exercises/{id}/last_sets` — last session's sets per exercise
- `GET /api/analytics/prs` — best estimated 1RM per exercise (Epley)
- `GET /api/analytics/daily_volume`, `weekly_volume`, `muscle_groups`
- `POST /api/import/strong` — Strong CSV import (skips blank/rest-timer rows, duplicate workouts)
- `GET /api/profiles/{id}/export.csv`
- `DELETE /api/profiles/{profile_id}/workouts` — delete all workouts for a profile
- `POST /api/workouts/{id}/rest_day` — mark rest day

### Frontend
- **Multi-profile** support with local profile selector
- **4-tab bottom nav**: Home / Exercises / History / Progress
- **Home tab**: weekly stats, streak, in-progress banner, last workout card
- **Exercises tab**: body-part chip filter, collapsible groups, inline edit, add exercise form
- **History tab**: workout list with detail sheet (swipe-to-dismiss), stats, muscle donut, sets
- **Progress tab**: PRs per body part (Epley 1RM), weekly volume bar chart, muscle group donut, activity heatmap, monthly calendar
- **ActiveWorkoutView**:
  - Sets table with prev-session reference, "Same as last" shortcut, per-set delete, reorder exercises (↑↓)
  - **Rest timer**: absolute-time countdown (stays accurate after backgrounding), Web Audio ding on finish, vibration, Notification API permission request, duration selector (60/90/120/180s), `visibilitychange` correction on resume
  - Workout notes (markdown-lite)
  - Mark rest day
- **Settings sheet** (swipe-to-dismiss): rename, units (kg/lbs), themes, export, Strong import, danger zone (delete all workouts with type-to-confirm)
- **Themes**: Dark, Light, Catppuccin Mocha / Macchiato / Frappé / Latte
- **PWA**: `manifest.json`, `theme-color`, Apple mobile web app meta tags, flamingo barbell favicon (SVG, transparent bg)
- **Flat SVG icons** in import/export (no emoji)
- **Reusable `BottomSheet`** component (swipe-to-dismiss, body scroll lock, `dragZoneContent` slot) used by all sheets
- Safari zoom fix (`font-size: 16px` on all inputs)

---

## Known issues / things to watch
- Calendar date alignment: workout `date` is stored as date-only; timezones west of UTC may see workouts on the wrong day.
- iOS Safari kills backgrounded JS after ~30s; the ding won't sound while the screen is locked. `visibilitychange` corrects the timer display on return, but the audio fires then too.

---

## Possible next things

### Infrastructure
- **v1.0.1 release** — merge `dev` → `main`, tag, write release notes (icon fix, Lifty theme, PWA polish, auth, refactor, etc.); update hardcoded `v1.0.0` strings in App.jsx (about modal pill + release link)
- **CI: explicit frontend build job** — add `npm ci && npm run build` step before `build-and-push` for faster, cheaper feedback on broken JSX/imports (currently only caught inside the Docker build)

### UX / missing features
- **JSON backup / restore** — full JSON dump of exercises + workouts + sets per profile; CSV export exists but can't be re-imported; needed for migrating between instances
- **System theme auto-follow** — "System" option in theme picker reads `prefers-color-scheme` and maps to Light/Dark; single media query, no backend change
- **Exercise picker: body part filter chips** — horizontal scrollable chip row (All / Chest / Back / …) above the list in the add-exercise bottom sheet; reuses existing filter logic from Exercises tab
- **Exercise picker: inline "New" quick-create** — "+ New Exercise" button inside the picker sheet; opens a small inline form (name + body part) so users don't have to exit the workout to create a custom exercise

### Tech debt
- **Frontend Vitest tests** — no component tests exist; add Vitest + React Testing Library; smoke tests for `fmtWeight`, `parseWeight`, set-log flow would catch regressions

---
## Changelog (6 Mar 2026) — session 2

### Completed
- **Notification permission UI** — rest timer shows "Tap to enable alarm notification" (tappable) when `'default'`, "Notifications blocked — enable in browser settings" when `'denied'`; `notifPerm` state seeded from `Notification.permission` on mount, updated reactively
- **Short timer dev override** — `docker-compose.override.yml` (gitignored) passes `VITE_SHORT_TIMER=1` build arg → rest timer shows 3/5/8/10s buttons instead of 60/90/120/180s; `docker-compose.override.yml` auto-merged by Docker Compose, no `-f` flag needed
- **`playDing()` now async** — `await ctx.resume()` before scheduling tones; `finish()` calls it fire-and-forget, state updates immediately so timer doesn't freeze at 1s
- **VAPID Web Push (partial)** — full implementation committed to `dev` (commit `0270dcb`):
  - `pywebpush==1.14.1` added to `requirements.txt`
  - VAPID key pair generated on first backend startup, stored in `app_config` table, persisted across restarts
  - `PushSubscription` model + DB table (profile_id, endpoint, p256dh, auth)
  - `GET /api/push/vapid-public-key` — returns public key
  - `POST /api/push/subscribe` — store/update subscription
  - `POST /api/push/schedule` — creates `asyncio.Task` that sleeps then calls `pywebpush.webpush()`
  - `POST /api/push/cancel` — cancels the pending task
  - SW: `push` event handler fires `showNotification` from server-sent push
  - Frontend: `subscribePush`, `schedulePush`, `cancelPush` in `api.js`; wired into `startRestTimer` / `stopRestTimer` / `finish()` in `ActiveWorkoutView.jsx`; subscribes on mount if already granted

### 🔴 Known bug — not yet fixed / committed
**`/api/push/vapid-public-key` returns 401** — endpoint is behind the auth middleware. `subscribePush()` silently fails, nothing is ever stored, push never fires.

**Fix** (already applied locally, NOT committed/pushed — commit this first):
```python
# backend/main.py line ~28
_UNPROTECTED_PATHS = {"/health", "/metrics", "/api/auth/status", "/api/auth/login", "/api/push/vapid-public-key"}
```

### To continue web push debugging
1. Commit + push the unprotected-path fix above
2. Deploy to `lifty.bndct.dev`, verify `GET /api/push/vapid-public-key` returns `{"publicKey": "..."}` without auth
3. Open PWA from Home Screen on iPhone, start a timer — check browser console for `[push] subscribe failed` errors
4. Lock screen, wait for timer to expire — check if notification appears
5. If not: check backend container logs for `[push] send error: ...`
   - Most likely failure: `pywebpush` VAPID key format — it may expect PEM not raw base64url; try switching to `py-vapid` to generate keys in the right format
   - Second likely failure: `vapid_claims` `sub` must be a real mailto or https URL the push service can reach
 — tap any PR row in the Progress tab → BottomSheet with pure SVG line chart (accent fill + polyline, date labels) + recent-sessions table (date · sets · top weight · est. 1RM); fetches `GET /api/exercises/{id}/history?limit=60`; `TrendingUp` icon hint on PR rows
- **Service Worker** (`public/sw.js`) — offline-first caching: static assets cache-first, API network-first with stale-cache fallback, navigation network-first; background rest-timer: page posts `SCHEDULE_NOTIFICATION`/`CANCEL_NOTIFICATION`, SW fires `showNotification` via `setTimeout` wrapped in `e.waitUntil`; `notificationclick` focuses existing window or opens `/`; SW works on non-EU iOS 16.4+ for locked-screen rest-timer ding
- **SW update → auto-reload** (`main.jsx`) — `updatefound` + `statechange` listener reloads all open clients when a new SW version activates, so deploys propagate immediately
- **nginx cache strategy** — `index.html` + `sw.js` served with `no-store, no-cache, must-revalidate`; hashed JS/CSS/assets served with `public, immutable` (1 year); `sw.js` exempt from the broad `.js` immutable rule via an earlier `location = /sw.js` block

---
## Changelog (2 Mar 2026) — session 3
- **Instance auth** — `LIFTY_PASSWORD` env var enables JWT-based auth on all API routes; disabled by default (zero friction for local dev); lock screen with logo bubble + password input before profile selector; 30-day HS256 JWT stored in `localStorage`; `lifty:unauthorized` event listener clears token and shows lock screen on 401; Settings → Instance Auth: Change Password (in-app) + Sign Out; PBKDF2-SHA256 password hashing (stdlib, no extra deps); 10 new auth tests — 30 total passing
- **Default profile name** — changed hardcoded `"benedict"` → `"Me"` in startup seed
## Changelog (2 Mar 2026) — session 3
- **Instance auth** — `LIFTY_PASSWORD` env var enables JWT-based auth on all API routes; disabled by default (zero friction for local dev); lock screen before profile selector; 30-day HS256 JWT stored in localStorage; 401 listener clears token and redirects to lock screen; Settings → Instance Auth → Change Password (in-app) + Sign Out; PBKDF2-SHA256 password hashing (stdlib, no extra deps); new test suite (13 auth tests, 30 total passing)
- **Default profile name** — changed hardcoded `"benedict"` → `"Me"` in startup seed
- **Timer banner fix** — banner no longer shows 0:00 after page refresh (seeds `timerStart` from `inProgress.start_time` via `useEffect`); also fixed 0:00 on exit by removing stray `setTimerStart(null)` from `onExit`
- **Empty workout state** — replaced plain text with illustrated empty state: breathing accent bubble with Dumbbell icon, "Ready when you are" headline
- **Login screen polish** — `ProfileSelector` redesigned: large breathing bubble logo, spring pop-in headline, staggered `slideUp` on profile cards, coloured avatar shadow
- **Animation system** — `tabFadeIn` keyframe on all 4 tab sections; "Animations" toggle in settings persisted to localStorage; `.app.no-anim *` global kill switch (sets `animation-duration: 0.001ms`)
- **Bottom nav redesign** — dual style system: `style-frosted` (floating pill, blur, labels) and `style-bubble` (icon-only compact pill); "Nav bar style" setting cycles between them, persisted to localStorage; fixed CSS specificity clash with global button rule using `!important` on `border:none`
- **Celebration modal** — confirmed complete: overlay, `CheckCircle2` icon, workout name, duration/sets/exercises stats, "Nice!" dismiss button, `celebrationPop` spring animation

## Changelog (2 Mar 2026)
- **Tab switching** — eliminated iOS 300ms tap delay (`touch-action: manipulation`); added `useTransition` so button highlights instantly before heavy tab content renders
- **Delete exercise** — `DELETE /api/exercises/{id}` endpoint (custom exercises only, cascades set entries); Delete button in Exercises tab (global/seeded exercises show Edit only)
- **UI polish** — Finish button now shows ✓ checkmark; Cancel Workout button shows ✗ icon; template sheet gets an explicit close button
- **Icon buttons** — fixed blank-square rendering on all fixed-size icon buttons (root cause: global `padding: 10px 16px` CSS rule + `box-sizing: border-box` leaving 0px content space); added `padding: 0` to detail sheet close, avatar, workout exit, and log-set confirm buttons; log-set button bumped to 32×32 with Lucide `Check`
- **Rest timer z animation** — three staggered floating `z` letters (CSS `@keyframes floatZ`) drift up and fade next to the countdown; pure CSS, zero JS overhead
- **Tab responsiveness** — `touch-action: manipulation` + `useTransition` for instant tab highlight on mobile
- **docker-compose.yml** — removed obsolete `version:` key
- **Delete exercise custom modal** — replaced `window.confirm()` with in-app modal matching the cancel-workout pattern
- **Set row grid fix** — corrected `28px→32px` column mismatch so log button aligns with header
- **History empty state** — centered clipboard-icon card shown when no workouts exist
- **Progress tab caching** — replaced boolean `loaded` flags with per-range cache objects; switching ranges no longer re-fetches already-loaded data
- **Set log pulse** — log button scales to 1.38× and snaps back on every set logged (`setLogPulse` keyframe + `onAnimationEnd` reset)
- **Streak Flame** — animated Lucide `Flame` icon (orange) appears next to streak count when ≥ 3 days (`flamePulse` keyframe)
- **PR badge** — after each set, e1rm (Epley) is compared against existing PRs; a gold `Trophy PR` pill pops on the exercise header for 3 s then fades out (`prBadgePop` keyframe)
- **Haptic feedback** — `navigator.vibrate?.(30)` on set log, `?(20)` on rest timer start; silent on iOS/unsupported browsers
- **Workout duration color shift** — timer line transitions muted → amber at 90 min → red at 120 min (2 s CSS ease)
- **Rest bar pulse** — progress bar flashes at 0.5 s interval when ≤ 10 s remain (`restBarPulse` keyframe)

