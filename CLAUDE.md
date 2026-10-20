# CLAUDE.md

This file provides guidance when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 3000
npm run build     # TypeScript check (tsc --noEmit) + Vite production build
npm run preview   # Preview the production build locally
```

## Environment Setup

Copy `.env.example` to `.env` and fill in values:

```
# Gemini AI (used server-side in api/insight.ts and Vite dev middleware)
GEMINI_API_KEY=...

# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Cloudinary (unsigned image uploads)
VITE_CLOUDINARY_CLOUD_NAME=...
VITE_CLOUDINARY_UPLOAD_PRESET=...
```

## Architecture

GoBoard is a student project showcase and literature platform for Godfrey Okoye University (GoUni).
Students submit tech projects and creative writing, admins approve/reject them, and the community upvotes, comments, and follows project build journeys.

**Stack**: React 19 + TypeScript + Vite + Firebase (Firestore, Auth) + Cloudinary + Google Gemini AI (`@google/genai`) on Vercel Serverless

### Entry & Routing

- `index.tsx` — mounts the app wrapped in `AuthProvider → ToastProvider → UserCacheProvider → RouterProvider`
- `router.tsx` — React Router v7 config with lazy-loaded pages:
  - `/` — `LandingPage` (standalone)
  - `/browse` — `HomePage` (all tech projects)
  - `/project/:id` — `ProjectPage` (finds project by unique slug or Firestore doc ID)
  - `/lit-club` — `LitClubPage` (stories, poems, essays)
  - `/writing/:id` — `WritingPage` (literature piece details)
  - `/profile` — `ProfilePage`
  - `/admin` — `AdminPage` (admin review queue for projects & writings)
- `App.tsx` — shell layout: sticky navbar with live XP/rank/avatar, mobile drawer, global projects/votes/favorites state passed to child routes via `<Outlet context>`

### Services & API

- `services/firebase.ts` — initializes Firebase client and exports `auth`, `db`, `googleProvider`
- `services/firestoreService.ts` — all Firestore operations:
  - Real-time `onSnapshot` listeners for projects, writings, user votes, favorites, and notifications
  - Atomic voting via `writeBatch` on both vote tracking collection and document `likes`
  - Comments added with `arrayUnion` to prevent overwrite race conditions
  - Notifications stored in `users/{uid}/notifications`, expire after 2 days
  - Cloudinary upload helper for project screenshots, build update images, and user avatars
- `api/insight.ts` — Vercel serverless function calling Gemini (`gemini-3-flash-preview`). Keeps `GEMINI_API_KEY` secure on the server without leaking to the browser bundle
- `services/geminiService.ts` — client fetcher for `/api/insight` with graceful fallback
- `services/utils.ts` — slug generation with collision handling, `canViewItem` moderation visibility check, date formatting, badges, ranks, and URL cleanup

### Contexts

- `contexts/AuthContext.tsx` — Firebase Auth wrapper with real-time profile listener, login streak tracking (XP every 3 days), and notification cleanup
- `contexts/UserCacheContext.tsx` — in-memory cache for `uid → { displayName, photoURL }` lookups. Use `useResolvedUser(uid, fallbackName, fallbackPhoto)` in components

### Key Domain Rules

- **Moderation & Visibility**: New projects and writings start with `approvalStatus: 'pending'`. Non-admins only see approved items (or their own submissions). Suspended items (`isSuspended: true`) are only visible to admins and the item's author. Enforced both in list feeds and via `canViewItem` on direct detail URLs.
- **Admin Access**: Gated by `isAdmin: true` on the Firestore user document. Protected against client self-promotion in `firestore.rules`.
- **XP System** (`firestoreService.ts`, `XP_VALUES` constant):
  - Submit (50 XP), approval (50 XP), first project bonus (100 XP), receiving votes (3 XP), leaving comments (3 XP, daily cap of 25 XP), receiving comments (5 XP), login streak every 3 days (10 XP)
  - Vote milestones (10 votes = 25 XP, 50 votes = 75 XP) tracked in `xpMilestonesAwarded`
- **Rank Thresholds**: Freshman Coder (0) → Rising Dev (100) → Code Ninja (300) → Campus Builder (600) → Campus Legend (1000) → Hall of Fame (2000)
- **Display Names**: Users can only edit their display name once (`hasEditedDisplayName: true`).

### Firestore Collections

| Collection | Purpose |
|---|---|
| `projects` | Tech project documents (comments and updates embedded as arrays) |
| `votes` | `{userId}_{projectId}` vote tracking docs |
| `writings` | Lit Club creative writing submissions |
| `litVotes` | `{userId}_{writingId}` lit vote tracking docs |
| `users` | User profiles with XP, rank, streak, and admin flag |
| `users/{uid}/notifications` | Notification subcollection |
| `users/{uid}/favorites` | Bookmarked project IDs subcollection |
| `settings/boardNotice` | Admin-editable community board notice |
