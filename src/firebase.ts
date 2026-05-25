import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, doc, persistentMultipleTabManager, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Room, Movie } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with modern local caching configuration (fully replacing deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */

export const auth = getAuth();

// Helper function to resolve room document path
export const getRoomRef = (code: string) => doc(db, 'artifacts', 'flixmatch-default-id', 'public', 'data', 'rooms', code);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  DATABASE_GET = 'get', // Keep both for safety
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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CENTRALIZED FIRESTORE DECORATOR MUTATION HELPERS
const getPath = (code: string) => `artifacts/flixmatch-default-id/public/data/rooms/${code}`;

export async function createRoomInFirestore(code: string, roomPayload: Room) {
  const roomDocRef = getRoomRef(code);
  try {
    await setDoc(roomDocRef, roomPayload);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function joinRoomInFirestore(code: string, userId: string, username: string) {
  const roomDocRef = getRoomRef(code);
  try {
    await updateDoc(roomDocRef, {
      [`users.${userId}`]: username,
      [`swipes.${userId}`]: {},
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function swipeMovieInFirestore(code: string, userId: string, movieId: string, liked: boolean) {
  const roomDocRef = getRoomRef(code);
  try {
    await updateDoc(roomDocRef, {
      [`swipes.${userId}.${movieId}`]: liked,
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function addMatchInFirestore(code: string, movie: Movie | string) {
  const roomDocRef = getRoomRef(code);
  try {
    await updateDoc(roomDocRef, {
      matches: arrayUnion(movie),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function updateMatchesInFirestore(code: string, updatedMatches: (Movie | string)[]) {
  const roomDocRef = getRoomRef(code);
  try {
    await updateDoc(roomDocRef, {
      matches: updatedMatches,
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function toggleSuperLikeInFirestore(code: string, userId: string, movieId: string, superLiked: boolean) {
  const roomDocRef = getRoomRef(code);
  try {
    await updateDoc(roomDocRef, {
      [`superLikes.${userId}.${movieId}`]: superLiked,
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function sendGlobalReactionInFirestore(code: string, userId: string, emoji: string) {
  const roomDocRef = getRoomRef(code);
  try {
    await updateDoc(roomDocRef, {
      [`reactions.${userId}`]: {
        emoji,
        timestamp: Date.now(),
      },
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function sendMovieReactionInFirestore(code: string, userId: string, movieId: string, emoji: string) {
  const roomDocRef = getRoomRef(code);
  try {
    await updateDoc(roomDocRef, {
      [`movieReactions.${movieId}.${userId}`]: emoji,
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function resetRoomDeckInFirestore(code: string, userIds: string[]) {
  const roomDocRef = getRoomRef(code);
  const cleanSwipes: Record<string, any> = {};
  userIds.forEach((uid) => {
    cleanSwipes[uid] = {};
  });
  try {
    await updateDoc(roomDocRef, {
      swipes: cleanSwipes,
      matches: [],
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function loadNewBatchInFirestore(code: string, userIds: string[], movies: Movie[], resetMatches: boolean, fallbackLevel?: number) {
  const roomDocRef = getRoomRef(code);
  const cleanSwipes: Record<string, any> = {};
  userIds.forEach((uid) => {
    cleanSwipes[uid] = {};
  });
  const updatePayload: Record<string, any> = {
    movies,
    swipes: cleanSwipes,
  };
  if (resetMatches) {
    updatePayload.matches = [];
  }
  if (fallbackLevel !== undefined) {
    updatePayload.fallbackLevel = fallbackLevel;
  }
  try {
    await updateDoc(roomDocRef, updatePayload);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}

export async function prefetchMoviesInFirestore(code: string, movies: Movie[]) {
  const roomDocRef = getRoomRef(code);
  try {
    await updateDoc(roomDocRef, {
      movies,
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, getPath(code));
  }
}
