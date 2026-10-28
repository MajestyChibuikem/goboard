export const XP_VALUES = {
  SUBMIT_PROJECT: 50,
  FIRST_PROJECT: 100,
  PROJECT_APPROVED: 50,
  RECEIVE_VOTE: 3,
  VOTE_MILESTONE_10: 25,
  VOTE_MILESTONE_50: 75,
  LEAVE_COMMENT: 3,
  RECEIVE_COMMENT: 5,
  LOGIN_STREAK: 10,
  GITHUB_ACTIVE_DAY: 15,
  ONBOARDING_COMPLETE: 25,
  QUEST_1_BABY_STEPS: 25,
  QUEST_2_SHELL_BASICS: 50,
  CAMPAIGN_SUBMISSION_APPROVED: 50,
} as const;

export const XP_LIMITS = {
  MIN_ACCOUNT_AGE_DAYS: 7, // Voter/commenter account must be >= 7 days old for author/commenter XP to flow
  MIN_VOTES_FOR_XP: 3,     // Project/writing must have >= 3 votes before vote/comment XP flows
  COMMENT_XP_DAILY_CAP: 25, // Max comment-posting XP a single user can earn per day
  DAILY_XP_CAP: 200,       // Max non-approval XP a single user can receive per day across all actions
} as const;
