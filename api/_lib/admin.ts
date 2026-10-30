import { getApps, getApp, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function parseServiceAccountEnv(raw: string): any | null {
  let trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // 2. Handle literal newlines inside JSON string values (common when pasting into Vercel env vars)
    try {
      const escapedNewlines = trimmed.replace(/\r?\n/g, '\\n');
      return JSON.parse(escapedNewlines);
    } catch {
      // 3. Try base64 decoding if stored as base64
      try {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    }
  }
}

export function hasServiceAccountCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = parseServiceAccountEnv(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (sa && sa.private_key && sa.client_email) return true;
  }
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    return true;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return true;
  }
  return false;
}

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  // Option 1: Entire service account JSON stored in FIREBASE_SERVICE_ACCOUNT
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = parseServiceAccountEnv(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount && serviceAccount.private_key && serviceAccount.client_email) {
      serviceAccount.private_key = String(serviceAccount.private_key).replace(/\\n/g, '\n');
      return initializeApp({
        credential: cert(serviceAccount),
        projectId:
          serviceAccount.project_id ||
          process.env.VITE_FIREBASE_PROJECT_ID ||
          process.env.FIREBASE_PROJECT_ID ||
          'gotechboard-7af85',
      });
    } else {
      console.error('FIREBASE_SERVICE_ACCOUNT was present but could not be parsed as valid service account JSON.');
    }
  }

  // Option 2: Individual env vars for private key and client email
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1);
    }
    return initializeApp({
      credential: cert({
        projectId:
          process.env.VITE_FIREBASE_PROJECT_ID ||
          process.env.FIREBASE_PROJECT_ID ||
          'gotechboard-7af85',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  // Option 3: Default application credentials
  return initializeApp({
    projectId:
      process.env.VITE_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      'gotechboard-7af85',
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
