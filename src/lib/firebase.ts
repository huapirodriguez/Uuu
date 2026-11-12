import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UnlockAttempt } from '../types.ts';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// CRITICAL: Must use firestoreDatabaseId
const dbId = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-patternlockdesbl-b8999005-f2fd-4612-8ade-cc07eacc8469';
export const db: Firestore = getFirestore(app, dbId);
export const auth = getAuth(app);

// Provider with Google profile & email
export const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleProvider.addScope(scope));

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// In-memory access token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize Auth listener
export const initAuth = (
  onSuccess?: (user: User, token: string | null) => void,
  onSignedOut?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onSignedOut) onSignedOut();
    }
  });
};

// Sign in with Google Popup
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string | null } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    // Save/update user profile in Firestore
    if (result.user) {
      const userRef = doc(db, 'users', result.user.uid);
      try {
        await setDoc(
          userRef,
          {
            userId: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || 'Usuario',
            photoUrl: result.user.photoURL || '',
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Could not sync user profile to Firestore:', err);
      }
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Update user profile in Firebase Auth and Firestore
export const updateUserProfileData = async (
  newDisplayName: string,
  newPhotoUrl?: string
): Promise<{ displayName: string; photoURL: string }> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No hay usuario autenticado');
  }

  // 1. Update Firebase Auth profile
  await updateProfile(user, {
    displayName: newDisplayName,
    photoURL: newPhotoUrl !== undefined ? newPhotoUrl : user.photoURL,
  });

  // 2. Sync to Firestore (/users/{userId}) adhering strictly to firestore.rules
  const userRef = doc(db, 'users', user.uid);
  try {
    await setDoc(
      userRef,
      {
        userId: user.uid,
        email: user.email || '',
        displayName: newDisplayName,
        photoUrl: (newPhotoUrl !== undefined ? newPhotoUrl : user.photoURL) || '',
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not update profile in Firestore:', err);
  }

  return {
    displayName: newDisplayName,
    photoURL: (newPhotoUrl !== undefined ? newPhotoUrl : user.photoURL) || '',
  };
};

// Switch Google account by forcing Google prompt: 'select_account'
export const switchGoogleAccount = async (): Promise<{ user: User; accessToken: string | null }> => {
  const switchProvider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => switchProvider.addScope(scope));
  switchProvider.setCustomParameters({
    prompt: 'select_account',
  });

  const result = await signInWithPopup(auth, switchProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedAccessToken = credential?.accessToken || null;

  if (result.user) {
    const userRef = doc(db, 'users', result.user.uid);
    try {
      await setDoc(
        userRef,
        {
          userId: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'Usuario',
          photoUrl: result.user.photoURL || '',
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not sync user profile to Firestore:', err);
    }
  }

  return { user: result.user, accessToken: cachedAccessToken };
};

// Load custom user profile from Firestore if available
export const loadUserProfileFromFirestore = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn('Failed to load user profile from Firestore:', err);
    return null;
  }
};

export const resetDeviceOAuth = async (): Promise<boolean> => {
  try {
    cachedAccessToken = null;
    await signOut(auth);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('patternlock_oauth_token');
      sessionStorage.removeItem('patternlock_oauth_token');
    }
    return true;
  } catch (err) {
    console.warn('Error resetting OAuth device credentials:', err);
    return false;
  }
};

export const getCachedAccessToken = () => cachedAccessToken;

// Test firestore connection on boot as mandated
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline, check connection.');
    }
  }
}

// Save unlock attempt to Firestore for the authenticated user
export async function saveAttemptToFirestore(attempt: UnlockAttempt, userId: string) {
  const path = 'unlock_attempts';
  try {
    const docRef = doc(db, path, attempt.id);
    await setDoc(docRef, {
      userId,
      success: attempt.success,
      length: attempt.length,
      patternMasked: attempt.patternMasked || '●●●●',
      deviceInfo: attempt.deviceInfo,
      timestamp: attempt.timestamp,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Load unlock attempts for authenticated user
export async function loadUserAttemptsFromFirestore(userId: string): Promise<UnlockAttempt[]> {
  const path = 'unlock_attempts';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const list: UnlockAttempt[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        success: data.success,
        length: data.length,
        patternMasked: data.patternMasked,
        deviceInfo: data.deviceInfo,
        timestamp: data.timestamp,
      });
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
