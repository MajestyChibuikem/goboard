import { FieldValue } from 'firebase-admin/firestore';
import { XP_LIMITS } from './xpRules';

export interface GrantXpReadState {
  alreadyGranted: boolean;
  userExists: boolean;
  dailyTotal: number;
  grantAmount: number;
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function readXpGrantState(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  ledgerId: string,
  userId: string,
  amount: number,
  today: string,
  bypassDailyCap = false
): Promise<GrantXpReadState> {
  const ledgerRef = db.collection('xpLedger').doc(ledgerId);
  const ledgerSnap = await tx.get(ledgerRef);
  if (ledgerSnap.exists) {
    return { alreadyGranted: true, userExists: false, dailyTotal: 0, grantAmount: 0 };
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await tx.get(userRef);
  if (!userSnap.exists) {
    return { alreadyGranted: false, userExists: false, dailyTotal: 0, grantAmount: 0 };
  }

  const dailyRef = db.collection('xpDaily').doc(`${userId}_${today}`);
  const dailySnap = await tx.get(dailyRef);
  const dailyTotal = dailySnap.exists ? (dailySnap.data()?.total || 0) : 0;

  let grantAmount = amount;
  if (!bypassDailyCap) {
    const remaining = Math.max(0, XP_LIMITS.DAILY_XP_CAP - dailyTotal);
    grantAmount = Math.min(amount, remaining);
  }

  return {
    alreadyGranted: false,
    userExists: true,
    dailyTotal,
    grantAmount,
  };
}

export function applyXpGrantInTransaction(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  ledgerId: string,
  userId: string,
  readState: GrantXpReadState,
  reason: string,
  today: string,
  meta?: Record<string, any>
): number {
  if (readState.alreadyGranted || !readState.userExists || readState.grantAmount <= 0) {
    return 0;
  }

  const ledgerRef = db.collection('xpLedger').doc(ledgerId);
  const userRef = db.collection('users').doc(userId);
  const dailyRef = db.collection('xpDaily').doc(`${userId}_${today}`);

  tx.create(ledgerRef, {
    userId,
    amount: readState.grantAmount,
    reason,
    meta: meta || {},
    createdAt: FieldValue.serverTimestamp(),
  });

  tx.set(
    dailyRef,
    {
      userId,
      date: today,
      total: readState.dailyTotal + readState.grantAmount,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  tx.update(userRef, {
    xp: FieldValue.increment(readState.grantAmount),
    seasonXp: FieldValue.increment(readState.grantAmount),
  });

  return readState.grantAmount;
}
