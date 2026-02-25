# GoUni XP & Progression System

> Designed to reward quality submissions, sustain engagement, and create genuine prestige — without enabling spam or gaming.

---

## XP Point Values

| Action | XP | Notes |
|---|---|---|
| Submit a project | **+50 XP** | Awarded on submission |
| Project gets approved | **+50 XP** | Bumped up — approval should feel significant |
| Receive a vote | **+3 XP** | Scales with project quality |
| Project hits 10 votes | **+25 XP** | One-time milestone bonus |
| Project hits 50 votes | **+75 XP** | One-time milestone bonus |
| Leave a comment | **+3 XP** | Slightly nerfed to reduce spam incentive |
| Receive a comment on your project | **+5 XP** | Signals community engagement |
| First project ever submitted | **+100 XP** | One-time onboarding bonus |
| 3-day login streak | **+10 XP** | Encourages return visits |

### Philosophy

Creating is always more rewarding than consuming. Votes are the community's quality signal — XP flows toward students who earn them, not just post volume.

---

## Ranks & Thresholds

| XP Range | Rank Title | Feel |
|---|---|---|
| 0 – 99 | 🎓 Freshman Coder | Just getting started |
| 100 – 299 | 🚀 Rising Dev | Showing up consistently |
| 300 – 599 | 🥷 Code Ninja | Building real stuff |
| 600 – 999 | 🏗️ Campus Builder | Known contributor |
| 1000 – 1999 | 🌟 Campus Legend | Pillar of the platform |
| 2000+ | 🏆 Hall of Fame | Rare, elite, permanent prestige |

> **Lifetime XP never resets.** Ranks are permanent achievements.

---

## Perks Per Rank

### 🚀 Rising Dev (100 XP)
First unlock — should feel rewarding quickly.
- Colored username on the leaderboard
- Can add tags and tech stack to submitted projects

### 🥷 Code Ninja (300 XP)
- **Ninja badge** shown on project feed cards — visible social signal
- Can leave **featured comments** (pinned to top of a project's comment section)

### 🏗️ Campus Builder (600 XP)
- **Builder banner** on public profile
- Projects receive a transparent boost in feed ranking
- **Early access** to new platform features (beta flag on account)

### 🌟 Campus Legend (1000 XP)
- Custom profile color/theme
- **Legend badge** appears everywhere their name shows up across the platform
- Can **request homepage feature** for their project (admin still approves, but Legends get to nominate)

### 🏆 Hall of Fame (2000 XP)
- Permanent spot on the **Hall of Fame page**
- Profile linked from the platform landing page
- Their votes carry **2x weight** in leaderboard score calculations (not XP farming — their endorsement just means more)

---

## Seasons

GoUni runs on a **semester-based season cycle** (~8–12 weeks).

- At season end, the **Season Leaderboard is frozen and celebrated**
- Top 3 students receive a permanent **season badge** on their profile (e.g. `S2 Champion`)
- **Lifetime XP and ranks never reset**
- **Season XP is tracked separately and resets each season** — so new students can compete with established ones

This prevents early adopters from permanently dominating and keeps the leaderboard fresh and competitive every term.

---

## Anti-Gaming Guardrails

These rules are enforced at the data layer to protect XP integrity:

- **Comment XP is capped at 25 XP per user per day** — kills the spam comment loop
- **Votes from accounts less than 7 days old** count for project visibility but do not award XP
- **XP for votes and comments is only earned on projects with 3+ votes** — prevents friends gaming brand-new submissions
- **Milestone bonuses (10 votes, 50 votes) fire only once per project** — enforced via server-side transaction to prevent race conditions

---

## Implementation Notes

Most XP actions can be handled client-side with **Firestore transactions**:

- Submit project → award XP immediately on client
- Receive vote → increment target user's XP on the voter write
- Leave comment → award XP on client with daily cap check

**Cloud Functions are recommended for:**
- Milestone bonuses (race condition risk if done client-side)
- Season resets and final leaderboard snapshots
- Leaderboard weight calculation for Hall of Fame votes

### Daily Login Streak Tracking

Streak tracking runs inside the Firebase Auth `onAuthStateChanged` listener — this fires every time the app loads with an active session, so users who stay logged in across days still get credit without having to explicitly sign in again.

Dates are compared as **ISO date strings** (`"2026-02-23"`) rather than timestamps to avoid timezone edge cases causing missed or double-counted days.

```js
import { doc, runTransaction } from "firebase/firestore"
import { getAuth, onAuthStateChanged } from "firebase/auth"

const getDateString = (date = new Date()) => date.toISOString().split("T")[0]

const getYesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return getDateString(d)
}

onAuthStateChanged(getAuth(), async (user) => {
  if (!user) return

  const userRef = doc(db, "users", user.uid)
  const today = getDateString()
  const yesterday = getYesterday()

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef)
    const data = snapshot.data()

    // Already logged in today — do nothing
    if (data.lastLoginDate === today) return

    let newStreak = 1
    if (data.lastLoginDate === yesterday) {
      // Consecutive day — continue streak
      newStreak = (data.streakDays || 1) + 1
    }
    // If neither today nor yesterday, streak is broken — reset to 1

    const updates = {
      lastLoginDate: today,
      streakDays: newStreak,
    }

    // Award 10 XP every time the streak hits a multiple of 3 (day 3, 6, 9...)
    if (newStreak % 3 === 0) {
      updates.xp = (data.xp || 0) + 10
      updates.seasonXp = (data.seasonXp || 0) + 10
    }

    transaction.update(userRef, updates)
  })
})
```

**Key decisions:**
- XP fires at every **multiple of 3** (day 3, 6, 9...) rather than just once, so long streaks continue to feel rewarding
- The transaction ensures no double-awarding if `onAuthStateChanged` fires multiple times in quick succession
- `lastLoginDate` acts as the idempotency key — same-day calls are a no-op

### Relevant Firestore Structure

```
users/{userId}
  xp: number              // lifetime XP
  seasonXp: number        // resets each season
  rank: string            // derived from xp
  streakDays: number      // current consecutive login streak
  lastLoginDate: string   // ISO date string e.g. "2026-02-23"

votes/{userId}_{projectId}
  // Enforces one vote per user per project

projects/{projectId}
  likes: number
  xpMilestonesAwarded: [10, 50]  // tracks which bonuses have fired
```

---

## Out of Scope (Future Phases)

- XP decay for inactivity
- Negative XP / moderation penalties
- Faculty-endorsed bonus XP
- Challenge/bounty XP multipliers
- Team XP pooling