# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 3000
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview the production build locally
```

There is no test suite.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in values:

```
GEMINI_API_KEY=...               # Google Gemini AI (mapped to process.env.API_KEY by vite.config.ts)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Architecture

GoBoard is a university student project showcase platform — students submit tech projects, admins approve/reject them, and others can upvote, comment, and follow project updates.

**Stack**: React 19 + TypeScript + Vite + Firebase (Firestore, Auth, Storage) + Google Gemini AI (`@google/genai`)

### Entry & Routing

- `index.tsx` — mounts the app, wraps everything in `AuthProvider → ToastProvider → UserCacheProvider → RouterProvider`
- `router.tsx` — React Router v7 config; all pages are lazy-loaded. The `/` route renders `LandingPage` standalone; all other routes (`/browse`, `/profile`, `/admin`, `/project/:id`) nest inside `App`
- `App.tsx` — the shell: sticky navbar, mobile drawer, global state (projects list, user votes, user favorites). Passes data to child pages via React Router's `<Outlet context>` — child pages read it with `useOutletContext()`

### Services

- `services/firebase.ts` — initializes Firebase and exports `auth`, `db`, `storage`, `googleProvider`
- `services/firestoreService.ts` — all Firestore operations. Key patterns:
  - `subscribeToProjects` / `subscribeToUserVotes` / `subscribeToUserFavorites` / `subscribeToUserNotifications` use `onSnapshot` for real-time updates
  - `toggleVote` uses a `writeBatch` on both `votes/{userId}_{projectId}` and `projects/{id}.likes` atomically
  - Comments and project updates are stored as embedded arrays inside project documents (not subcollections)
  - Notifications are stored in `users/{uid}/notifications` subcollection, expire after 2 days
  - Favorites are stored in `users/{uid}/favorites` subcollection
- `services/geminiService.ts` — calls Gemini to generate AI insights (review, impact, suggestion) for a project; returns a graceful fallback on error

### Contexts

- `contexts/AuthContext.tsx` — Firebase Auth wrapper. Exposes `user` (Firebase User), `profile` (Firestore UserProfile with XP/rank/streak), and auth methods. On sign-in: creates/updates the Firestore user doc, tracks login streak, cleans up expired notifications. Also sets up a real-time `onSnapshot` listener so XP/rank updates propagate live.
- `contexts/UserCacheContext.tsx` — in-memory cache for `uid → { displayName, photoURL }` lookups, used to resolve current display names for comments and updates without re-fetching on every render. Use `useResolvedUser(uid, fallbackName, fallbackPhoto)` in components.

### Key Domain Rules

**Approval flow**: New projects are created with `approvalStatus: 'pending'` and are invisible to regular users until an admin approves them. The `subscribeToProjects` filter in `App.tsx` enforces this client-side.

**Admin access**: Gated by `isAdmin: true` on the Firestore user document. There is no UI to promote users — it must be set directly in Firestore.

**XP system** (`firestoreService.ts`, `XP_VALUES` constant):
- Earned for: submitting a project (50 XP), project approval (50 XP), first project bonus (100 XP), receiving votes (3 XP), leaving comments (3 XP, daily cap of 25 XP), receiving comments (5 XP), login streak every 3 days (10 XP)
- Vote XP has guardrails: the voting account must be ≥7 days old, and the project must have ≥3 votes
- Vote milestones (10 votes = 25 XP bonus, 50 votes = 75 XP bonus) are tracked in `xpMilestonesAwarded` array on the project doc to prevent duplicate awards
- XP and `seasonXp` are both incremented together; `seasonXp` is for seasonal leaderboards

**Rank thresholds** (in `AuthContext.tsx`): Freshman Coder (0) → Rising Dev (100) → Code Ninja (300) → Campus Builder (600) → Campus Legend (1000) → Hall of Fame (2000)

**Display name edit**: Users can only edit their display name once (`hasEditedDisplayName` flag on Firestore user doc).

**Unique project titles**: Enforced via a `titleLower` field (lowercase normalized) on each project document, queried before creation.

**Project suspension**: Admins can suspend approved projects (`isSuspended: true`). Suspended projects are hidden from all users except admins and the project's own author.

### Firestore Collections

| Collection | Purpose |
|---|---|
| `projects` | All project documents (comments and updates embedded as arrays) |
| `votes` | One doc per `{userId}_{projectId}` pair |
| `users` | User profiles with XP, rank, streak |
| `users/{uid}/notifications` | Notification subcollection |
| `users/{uid}/favorites` | Favorite project IDs subcollection |
| `settings/boardNotice` | Single admin-editable board notice doc |
