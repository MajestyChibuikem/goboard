# GoUni Tech Showcase — Current Build Plan (Phase 1)

> Goal: Ship a functional, authenticated platform with persistent data, voting integrity, and the foundation for gamification. No blockchain yet — just a solid product students actually use.

---

## 1. Authentication

- [ ] Firebase Auth setup (Google provider + email/password)
- [ ] Sign in / Sign up UI (modal or dedicated page)
- [ ] Auth context provider wrapping the app
- [ ] Protected actions: voting, commenting, and submitting require login
- [ ] Display logged-in user info in the navbar (avatar, name)
- [ ] Sign out functionality

## 2. Database & Persistence

- [ ] Firebase project setup (Firestore + Storage)
- [ ] Firestore collections design:
  - `projects` — all project data
  - `users` — profile, XP, submitted project IDs
  - `votes` — maps `userId → projectId` (enforces one vote per user per project)
  - `comments` — subcollection under each project
- [ ] Migrate seed data from `constants.ts` to Firestore (or keep as fallback)
- [ ] Real-time listeners for project list and detail views

## 3. Project Submission (Real)

- [ ] Connect submit form to Firestore (create document)
- [ ] Firebase Storage integration for image uploads (replace picsum placeholders)
- [ ] Image compression/resize on client before upload
- [ ] Submission status: `pending` → `approved` / `rejected`
- [ ] Only approved projects visible on the main feed

## 4. Admin Approval Queue

- [ ] Admin role flag on user documents
- [ ] Admin dashboard route/page — list of pending submissions
- [ ] Approve/reject actions with optional feedback message
- [ ] Notification to student on approval/rejection (in-app)

## 5. Voting System (Real)

- [ ] Check if current user already voted before allowing upvote
- [ ] Toggle vote (upvote / remove upvote)
- [ ] Store votes in dedicated collection for integrity
- [ ] Update project `likes` count via Firestore increment
- [ ] Optimistic UI updates with rollback on failure

## 6. Comments (Authenticated)

- [ ] Replace anonymous name generator with real user identity
- [ ] Store comments with `userId`, `displayName`, `photoURL`
- [ ] Real-time comment updates via Firestore listener
- [ ] Optional: keep anonymous mode as a toggle (fun feature to preserve)

## 7. User Profiles

- [ ] Profile page showing:
  - Display name, email, avatar
  - Submitted projects list
  - Total XP and current rank
  - Join date
- [ ] Public profile view (click on any student name to see their work)

## 8. XP Points System (Foundation)

- [ ] Point values:
  - Submit a project: **50 XP**
  - Project gets approved: **25 XP**
  - Receive a vote: **2 XP**
  - Leave a comment: **5 XP**
  - Receive a comment on your project: **3 XP**
- [ ] XP stored on user document, updated via Cloud Functions or client-side transactions
- [ ] Leaderboard sorted by XP (replaces current likes-based leaderboard)
- [ ] Rank thresholds:
  - 0–99 XP: **Freshman Coder**
  - 100–299 XP: **Rising Dev**
  - 300–599 XP: **Code Ninja**
  - 600–999 XP: **Campus Builder**
  - 1000+ XP: **Campus Legend**

## 9. UI/UX Polish

- [ ] Loading skeletons for project list and detail views
- [ ] Toast notifications for actions (voted, commented, submitted)
- [ ] Empty states with CTAs (no projects yet? submit one!)
- [ ] Error boundaries and error states
- [ ] Confirm dialogs for destructive actions
- [ ] Smooth page transitions between list and detail views

## 10. Cleanup & Tech Debt

- [ ] Remove unused `ProjectDetailsModal.tsx` (replaced by `ProjectDetailView`)
- [ ] Handle the `size` prop properly in `Button.tsx` or remove usage
- [ ] Environment variable handling (move from `process.env` to `import.meta.env` for Vite)
- [ ] Set up proper Tailwind config (currently using CDN — move to PostCSS build)
- [ ] Add ESLint + basic linting rules
- [ ] Git init + initial commit + .gitignore review

---

## Suggested Build Order

```
1. Git init + Firebase project setup
2. Auth (login/signup/context)
3. Firestore schema + migrate project data
4. Project submission → Firestore + image upload
5. Voting with one-per-user enforcement
6. Authenticated comments
7. User profiles
8. XP system + leaderboard
9. Admin approval queue
10. UI polish + cleanup
```

---

## Tech Decisions

| Concern | Decision | Reason |
|---|---|---|
| Backend | Firebase | Fast to ship, free tier generous, real-time built in |
| Auth | Firebase Auth (Google) | Students have Google accounts, zero friction |
| Storage | Firebase Storage | Integrated with auth rules, easy image uploads |
| Hosting | Firebase Hosting or Vercel | Both have free tiers, Vercel simpler for Vite |
| AI | Gemini API (already integrated) | Keep as-is, works well |
| Styling | Tailwind (move to PostCSS) | Already using it via CDN, just need proper setup |

---

## Out of Scope (For Now)

- Blockchain / tokens (Phase 4)
- Faculty endorsements (Phase 3)
- Course tagging (Phase 3)
- Challenges/bounties (Phase 2)
- Team profiles (Phase 2)
- Portfolio export (Phase 3)
- Notification system beyond in-app (Phase 2)

These are tracked in `FULL_PROJECT_PLAN.md` and will be tackled after Phase 1 ships.
