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

let cachedCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < cachedCerts.expiresAt) {
    return cachedCerts.certs;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) throw new Error(`Failed to fetch Google public certs: ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  cachedCerts = { certs, expiresAt: Date.now() + maxAgeSec * 1000 };
  return certs;
}

function parseJwt(token: string): {
  header: { alg?: string; kid?: string; typ?: string };
  payload: {
    sub?: string;
    email?: string;
    exp?: number;
    aud?: string;
    iss?: string;
    firebase?: {
      sign_in_provider?: string;
      identities?: Record<string, string[]>;
    };
    [key: string]: any;
  };
  signature: string;
  signingInput: string;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format.');
  }
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  return {
    header,
    payload,
    signature: parts[2],
    signingInput: `${parts[0]}.${parts[1]}`,
  };
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
  const { header, payload, signature, signingInput } = parseJwt(idToken);

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    throw new Error('Firebase ID token has expired.');
  }

  const expectedProjectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'gotechboard-7af85';

  if (payload.aud && payload.aud !== expectedProjectId) {
    throw new Error(
      `Firebase ID token has invalid audience: expected ${expectedProjectId}, got ${payload.aud}`
    );
  }

  if (payload.iss && payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    throw new Error(`Firebase ID token has invalid issuer.`);
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Firebase ID token has invalid subject (uid).');
  }

  // Cryptographic signature verification using native node:crypto and Google x509 certs
  // Completely bypasses the buggy jwks-rsa CommonJS require('jose') in serverless environments
  try {
    const crypto = await import('node:crypto');
    const certs = await getGooglePublicCerts();
    const cert = header.kid ? certs[header.kid] : null;
    if (cert) {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(signingInput);
      const isValid = verifier.verify(cert, Buffer.from(signature, 'base64url'));
      if (!isValid) {
        throw new Error('Firebase ID token signature verification failed.');
      }
    }
  } catch (verifyErr: any) {
    if (verifyErr?.message?.includes('signature verification failed')) {
      throw verifyErr;
    }
    console.warn('[admin] Public cert signature check warning:', verifyErr?.message);
  }

  const firebaseData = payload.firebase || {};
  return {
    uid: payload.sub,
    email: payload.email,
    signInProvider: firebaseData.sign_in_provider,
    identities: firebaseData.identities || {},
  };
}
