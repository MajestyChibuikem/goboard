import { auth } from './firebase';

export type XpEventType =
  | 'PROJECT_SUBMITTED'
  | 'PROJECT_APPROVED'
  | 'VOTE_CAST'
  | 'COMMENT_POSTED'
  | 'WRITING_SUBMITTED'
  | 'WRITING_APPROVED'
  | 'WRITING_VOTE_CAST'
  | 'DAILY_LOGIN'
  | 'GITHUB_SYNC'
  | 'ONBOARDING_COMPLETED';

export interface XpEventPayload {
  type: XpEventType;
  projectId?: string;
  writingId?: string;
  targetType?: 'project' | 'writing';
  targetId?: string;
  commentId?: string;
  displayName?: string;
  department?: string;
  academicLevel?: string;
  interests?: string[];
}

export interface XpEventResponse {
  success: boolean;
  awarded: number;
  streakDays?: number;
  reason?: string;
  error?: string;
  profile?: any;
  onboardingCompletedAt?: string;
}

/**
 * Server-authoritative XP reporter.
 * The client only reports WHAT happened; the server verifies and awards XP.
 * Fail-closed: Never falls back to client-side database writes.
 */
export async function reportXpEvent(payload: XpEventPayload): Promise<XpEventResponse> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, awarded: 0, reason: 'NOT_AUTHENTICATED' };
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/api/xp-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`XP event ${payload.type} server rejected:`, errorData.error || response.statusText);
      return {
        success: false,
        awarded: 0,
        error: errorData.error || response.statusText,
      };
    }

    const data: XpEventResponse = await response.json();
    return {
      success: !!data.success,
      awarded: data.awarded || 0,
      streakDays: data.streakDays,
      reason: data.reason,
      profile: data.profile,
      onboardingCompletedAt: data.onboardingCompletedAt,
    };
  } catch (err: any) {
    console.warn(`XP event ${payload.type} network/client error:`, err);
    return { success: false, awarded: 0, error: err.message };
  }
}
