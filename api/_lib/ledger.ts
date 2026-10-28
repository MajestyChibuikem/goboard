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
  const userRef = db.collection('users').doc(userId);
  const dailyRef = db.collection('xpDaily').doc(`${userId}_${today}`);

  const [ledgerSnap, userSnap, dailySnap] = await Promise.all([
    tx.get(ledgerRef),
    tx.get(userRef),
    tx.get(dailyRef),
  ]);

  if (ledgerSnap.exists) {
    return {
      alreadyGranted: true,
      userExists: userSnap.exists,
      dailyTotal: dailySnap.exists ? (dailySnap.data()?.total || 0) : 0,
      grantAmount: 0,
    };
  }

  if (!userSnap.exists) {
    return { alreadyGranted: false, userExists: false, dailyTotal: 0, grantAmount: 0 };
  }

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

/**
 * Accumulator for XP ledger entries and user document updates within a single Firestore transaction.
 * Guarantees that each ledger, user, and daily record is written AT MOST ONCE per transaction,
 * preventing "Cannot modify a document more than once in a transaction" errors.
 */
export class XpTransactionAccumulator {
  private userDeltas = new Map<
    string,
    {
      xp: number;
      dailyTotal: number;
      today: string;
      extraUpdates?: Record<string, any>;
    }
  >();
  private ledgers: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];

  /**
   * Adds an XP grant to the accumulator.
   * Creates the ledger entry and records the user/daily deltas without writing to user or daily documents yet.
   * Returns the amount awarded.
   */
  addGrant(
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
    this.ledgers.push({
      ref: ledgerRef,
      data: {
        userId,
        amount: readState.grantAmount,
        reason,
        meta: meta || {},
        createdAt: FieldValue.serverTimestamp(),
      },
    });

    const userEntry = this.userDeltas.get(userId) || {
      xp: 0,
      dailyTotal: readState.dailyTotal,
      today,
    };
    userEntry.xp += readState.grantAmount;
    userEntry.dailyTotal += readState.grantAmount;
    userEntry.today = today;
    this.userDeltas.set(userId, userEntry);

    return readState.grantAmount;
  }

  /**
   * Sets additional fields to update on the user document in the same single update.
   */
  setUserExtraFields(userId: string, fields: Record<string, any>) {
    const userEntry = this.userDeltas.get(userId) || {
      xp: 0,
      dailyTotal: 0,
      today: '',
    };
    userEntry.extraUpdates = {
      ...(userEntry.extraUpdates || {}),
      ...fields,
    };
    this.userDeltas.set(userId, userEntry);
  }

  /**
   * Commits all ledger, daily, and user operations to the transaction.
   * Guarantees that each ledger, daily, and user document is written EXACTLY ONCE.
   */
  apply(tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore) {
    // 1. Create each ledger entry
    for (const item of this.ledgers) {
      tx.create(item.ref, item.data);
    }

    // 2. Set each user's daily record at most once
    for (const [userId, entry] of this.userDeltas.entries()) {
      if (entry.xp > 0 && entry.today) {
        const dailyRef = db.collection('xpDaily').doc(`${userId}_${entry.today}`);
        tx.set(
          dailyRef,
          {
            userId,
            date: entry.today,
            total: entry.dailyTotal,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      // 3. Update each user document at most once
      const updatePayload: Record<string, any> = {
        ...(entry.extraUpdates || {}),
      };
      if (entry.xp > 0) {
        updatePayload.xp = FieldValue.increment(entry.xp);
        updatePayload.seasonXp = FieldValue.increment(entry.xp);
      }

      if (Object.keys(updatePayload).length > 0) {
        const userRef = db.collection('users').doc(userId);
        tx.update(userRef, updatePayload);
      }
    }
  }
}

export function applyXpGrantInTransaction(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  ledgerId: string,
  userId: string,
  readState: GrantXpReadState,
  reason: string,
  today: string,
  meta?: Record<string, any>,
  extraUserFields?: Record<string, any>
): number {
  const acc = new XpTransactionAccumulator();
  const awarded = acc.addGrant(db, ledgerId, userId, readState, reason, today, meta);
  if (extraUserFields) {
    acc.setUserExtraFields(userId, extraUserFields);
  }
  acc.apply(tx, db);
  return awarded;
}
