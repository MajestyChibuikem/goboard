import { getApps, getApp, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin singleton
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  // Option 1: Entire service account JSON stored in FIREBASE_SERVICE_ACCOUNT
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      return initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
    }
  }

  // Option 2: Individual env vars for private key and client email
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    return initializeApp({
      credential: cert({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gotechboard-7af85',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  }

  // Option 3: Default application credentials
  return initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gotechboard-7af85'
  });
}

const ALLOWED_ACTIONS: Record<string, number> = {
  SUBMIT_PROJECT: 50,
  PROJECT_APPROVED: 50,
  RECEIVE_VOTE: 3,
  RECEIVE_COMMENT: 5,
  FIRST_PROJECT: 100,
  VOTE_MILESTONE_10: 25,
  VOTE_MILESTONE_50: 75,
  LOGIN_STREAK: 10
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract Bearer token
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  let adminApp: App;
  try {
    adminApp = getAdminApp();
  } catch (err: any) {
    console.error('Firebase Admin initialization error:', err);
    return res.status(500).json({
      error: 'Firebase Admin is not configured on the server. Please add FIREBASE_SERVICE_ACCOUNT in environment variables.'
    });
  }

  // Verify Firebase ID Token
  let callerUid: string;
  try {
    const auth = getAuth(adminApp);
    const decoded = await auth.verifyIdToken(idToken);
    callerUid = decoded.uid;
  } catch (err: any) {
    console.error('ID token verification failed:', err);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  const { targetUserId, amount, action } = req.body || {};

  if (!targetUserId || typeof targetUserId !== 'string') {
    return res.status(400).json({ error: 'targetUserId is required.' });
  }

  if (typeof amount !== 'number' || amount <= 0 || amount > 100) {
    return res.status(400).json({ error: 'Invalid XP amount. Must be between 1 and 100.' });
  }

  // Validate action constraints
  const db = getFirestore(adminApp);

  if (action && ALLOWED_ACTIONS[action]) {
    const expectedAmount = ALLOWED_ACTIONS[action];
    if (amount > expectedAmount) {
      return res.status(400).json({ error: `Amount ${amount} exceeds canonical limit of ${expectedAmount} for action ${action}.` });
    }
  }

  // Author cannot award vote/comment XP to themselves
  if ((action === 'RECEIVE_VOTE' || action === 'RECEIVE_COMMENT') && callerUid === targetUserId) {
    return res.status(403).json({ error: 'You cannot award vote or comment XP to yourself.' });
  }

  // Project approval XP can only be triggered by an admin
  if (action === 'PROJECT_APPROVED') {
    const callerDoc = await db.collection('users').doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.isAdmin !== true) {
      return res.status(403).json({ error: 'Only admins can approve projects and award approval XP.' });
    }
  }

  try {
    const userRef = db.collection('users').doc(targetUserId);
    await userRef.update({
      xp: FieldValue.increment(amount),
      seasonXp: FieldValue.increment(amount)
    });

    return res.status(200).json({
      success: true,
      awarded: amount,
      targetUserId,
      action: action || 'CUSTOM_AWARD'
    });
  } catch (err: any) {
    console.error('Failed to update XP in Firestore:', err);
    return res.status(500).json({ error: 'Failed to update user XP in database.' });
  }
}
