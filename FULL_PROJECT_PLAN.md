# GoUni Tech Showcase — Full Project Plan

A competitive project showcase platform for the Faculty of Computing & IT at Godfrey Okoye University. Designed to drive innovation, reward builders, and create a visible culture of student engineering excellence.

---

## Vision

Every CS student at GoUni should feel that **building things matters** — socially, academically, and professionally. This platform makes student work visible, rankable, and eventually rewardable with real-world value.

---

## Phase 1: Foundation (Current Sprint)

> Get the platform functional with real users, real data, and real accountability.

- [ ] Authentication (Google / school email)
- [ ] Backend & database (Firebase/Supabase)
- [ ] Project CRUD with persistent storage
- [ ] One-vote-per-user enforcement
- [ ] Admin/faculty approval queue for submissions
- [ ] Comment system with authenticated users
- [ ] Image upload (project screenshots)
- [ ] Basic XP points system (earn points for submitting, getting votes, commenting)
- [ ] User profiles (submitted projects, total XP, rank)
- [ ] Mobile-responsive polish

---

## Phase 2: Competition & Engagement

> Turn passive browsing into active participation.

- [ ] Seasonal showcases — semester-bound submission windows with deadlines
- [ ] Semester leaderboard with top 3 recognition
- [ ] Challenges/bounties — faculty-posted problems students compete to solve
- [ ] Peer code review system — structured feedback with rating categories (code quality, UI/UX, innovation, usefulness)
- [ ] Team profiles — group project support with shared reputation
- [ ] Project update logs — milestone posts showing progress over time
- [ ] Notification system — votes, comments, challenge announcements

---

## Phase 3: Faculty & Academic Integration

> Bridge the gap between extracurricular building and academic recognition.

- [ ] Faculty mentor endorsements — lecturers can officially endorse projects (weighted higher than peer votes)
- [ ] Course tagging — link projects to specific courses (CSC 401, etc.)
- [ ] Faculty dashboard — lecturers see student activity, top projects per course
- [ ] Portfolio export — students generate a shareable portfolio page for job applications
- [ ] Skill badges — "Full Stack", "AI Builder", "IoT Pioneer" — earned by shipping in categories
- [ ] Ranks/tiers — Freshman Coder → Code Ninja → Campus Legend (based on cumulative XP)
- [ ] Streak rewards — submit projects across consecutive semesters for XP multipliers

---

## Phase 4: Tokenization & Blockchain

> Convert platform reputation into tangible, tradeable value.

### Token Design
- [ ] GoUni Innovation Token (GIT) — limited supply ERC-20 or similar
- [ ] Token distribution tied to XP milestones and seasonal leaderboard placement
- [ ] Wallet integration — students connect/create a wallet on the platform
- [ ] Token dashboard — balance, transaction history, earning breakdown

### Redemption System
- [ ] School fee offset — partner with bursary to accept tokens for partial fee payment
- [ ] Course mark bonus — faculty opt-in: tokens redeemable for bonus marks in select courses
- [ ] Merch/swag store — GoUni branded items purchasable with tokens
- [ ] Event access — priority registration for hackathons, workshops, tech talks

### Anti-Gaming & Integrity
- [ ] Sybil resistance — one account per verified student (school email + student ID verification)
- [ ] Vote manipulation detection — flag suspicious voting patterns
- [ ] Faculty oversight — token distribution requires admin approval for large amounts
- [ ] Audit trail — all token transactions logged and transparent

### Technical Considerations
- [ ] Chain selection — consider Polygon/Base for low gas fees, or a private chain for full control
- [ ] Smart contract development & security audit
- [ ] Off-chain points → on-chain token bridge (convert accumulated XP to tokens at defined intervals)
- [ ] Legal/regulatory review with university counsel

---

## Architecture (High Level)

```
Frontend (React + Vite + Tailwind)
    │
    ├── Firebase Auth (Google/email sign-in)
    ├── Firestore (projects, users, comments, votes, XP)
    ├── Firebase Storage (project images)
    ├── Gemini API (AI project analysis)
    │
    └── [Phase 4] Blockchain Layer
        ├── Smart Contracts (token minting, distribution)
        ├── Wallet Integration (MetaMask / embedded wallet)
        └── Token Redemption API (school systems integration)
```

---

## Success Metrics

| Metric | Target (Semester 1) | Target (Year 1) |
|---|---|---|
| Registered students | 50+ | 200+ |
| Projects submitted | 20+ | 100+ |
| Active voters/commenters | 30+ | 150+ |
| Faculty endorsements | 5+ | 20+ |
| Challenges posted | 2+ | 10+ |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Low adoption | Launch with a faculty-backed event, mandatory for one course |
| Vote manipulation | Auth + one-vote-per-user + anomaly detection |
| Junk submissions | Admin approval queue + minimum description length |
| Blockchain complexity | Delay to Phase 4, start with off-chain points |
| Admin buy-in for token redemption | Build traction first, present data to administration |
| Scope creep | Strict phased approach — ship Phase 1 before touching Phase 2 |
