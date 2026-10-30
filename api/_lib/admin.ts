import { getApps, getApp, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function parseServiceAccount(raw: string | undefined): any | null {
  if (!raw || typeof raw !== 'string') return null;
  let str = raw.trim();

  // Strip wrapping single or double quotes repeatedly if nested
  while (
    (str.startsWith("'") && str.endsWith("'")) ||
    (str.startsWith('"') && str.endsWith('"'))
  ) {
    str = str.slice(1, -1).trim();
  }

  // Attempt 1: Direct JSON parse
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  // Attempt 2: If the string was double-escaped JSON (e.g. "{\"type\"...")
  try {
    const unescaped = str.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const parsed = JSON.parse(unescaped);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  // Attempt 3: Base64 decode
  try {
    const decoded = Buffer.from(str, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  // Attempt 4: Character-by-character scan fixing unescaped newlines/tabs inside string literals
  // (Extremely common when multi-line PEM private keys are pasted into Vercel UI text fields)
  try {
    let inString = false;
    let escaped = false;
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '\\' && inString) {
        escaped = !escaped;
        out += c;
        continue;
      }
      if (c === '"' && !escaped) {
        inString = !inString;
        out += c;
        continue;
      }
      escaped = false;
      if (inString) {
        if (c === '\n') out += '\\n';
        else if (c === '\r') out += '\\r';
        else if (c === '\t') out += '\\t';
        else out += c;
      } else {
        out += c;
      }
    }
    const parsed = JSON.parse(out);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  return null;
}

function normalizePrivateKey(key: string | undefined): string {
  if (!key || typeof key !== 'string') return '';
  let k = key.trim();
  while (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  k = k.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  k = k.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return k.trim();
}

export function hasServiceAccountCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (sa && (sa.private_key || sa.privateKey) && (sa.client_email || sa.clientEmail)) {
      return true;
    }
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
    try {
      const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
      const clientEmail = serviceAccount?.client_email || serviceAccount?.clientEmail;
      let rawKey = serviceAccount?.private_key || serviceAccount?.privateKey;
      const projectId =
        serviceAccount?.project_id ||
        serviceAccount?.projectId ||
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        'gotechboard-7af85';

      if (clientEmail && rawKey) {
        const privateKey = normalizePrivateKey(rawKey);
        console.log(`[admin] Initializing Firebase Admin with service account for ${clientEmail} (${projectId})`);
        return initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });
      }
    } catch (saErr: any) {
      console.error('[admin] Failed to initialize service account credential:', saErr?.message);
    }
  }

  // Option 2: Individual env vars for private key and client email
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    try {
      const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      const projectId =
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        'gotechboard-7af85';
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL.trim();
      console.log(`[admin] Initializing Firebase Admin with individual env vars for ${clientEmail} (${projectId})`);
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
    } catch (indErr: any) {
      console.error('[admin] Failed to initialize individual env credentials:', indErr?.message);
    }
  }

  // Option 3: Default application credentials
  console.warn('[admin] No service account credentials detected in environment; falling back to default app credentials.');
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
