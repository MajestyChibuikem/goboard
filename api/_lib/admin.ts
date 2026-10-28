import { getApps, getApp, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

export function getAdminApp(): App {
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

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export async function verifyAuth(req: any): Promise<{
  uid: string;
  email?: string;
  signInProvider?: string;
  identities?: Record<string, string[]>;
}> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header.');
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  const firebaseData = (decoded as any).firebase || {};
  return {
    uid: decoded.uid,
    email: decoded.email,
    signInProvider: firebaseData.sign_in_provider,
    identities: firebaseData.identities || {},
  };
}
