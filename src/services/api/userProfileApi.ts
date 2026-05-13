import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import type { Objective } from './recipesApi';

export type UserProfile = {
  objective?: Objective;
  calorieGoal?: number;
  avatarUrl?: string;
  customRecipeTags?: string[];
  customIngredients?: string[];
};

const COLLECTION = 'users';
const PROFILE_CACHE_TTL_MS = 60_000;
let profileCache:
  | {
      uid: string;
      fetchedAt: number;
      data: UserProfile | null;
    }
  | null = null;
let profileInFlight: Promise<UserProfile | null> | null = null;

const clearProfileCache = () => {
  profileCache = null;
  profileInFlight = null;
};

export const clearProfileCacheOnAuthChange = clearProfileCache;

export const getUserProfile = async (): Promise<UserProfile | null> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  if (
    profileCache &&
    profileCache.uid === uid &&
    Date.now() - profileCache.fetchedAt < PROFILE_CACHE_TTL_MS
  ) {
    return profileCache.data;
  }

  if (profileInFlight) return profileInFlight;

  profileInFlight = (async () => {
    try {
      const ref = doc(db, COLLECTION, uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        profileCache = { uid, fetchedAt: Date.now(), data: null };
        return null;
      }
      const data = snap.data();
      const profile: UserProfile = {
        objective: data.objective ?? undefined,
        calorieGoal: data.calorieGoal ?? undefined,
        avatarUrl: data.avatarUrl ?? undefined,
        customRecipeTags: Array.isArray(data.customRecipeTags) ? data.customRecipeTags : undefined,
        customIngredients: Array.isArray(data.customIngredients) ? data.customIngredients : undefined,
      };
      profileCache = { uid, fetchedAt: Date.now(), data: profile };
      return profile;
    } catch (e) {
      console.warn('getUserProfile failed:', e);
      return null;
    } finally {
      profileInFlight = null;
    }
  })();

  return profileInFlight;
};

export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Non connecté.');
  const ref = doc(db, COLLECTION, uid);
  const payload: Record<string, unknown> = {};
  if (updates.objective !== undefined) payload.objective = updates.objective;
  if (updates.calorieGoal !== undefined) payload.calorieGoal = updates.calorieGoal;
  if (updates.avatarUrl !== undefined) payload.avatarUrl = updates.avatarUrl;
  if (updates.customRecipeTags !== undefined) payload.customRecipeTags = updates.customRecipeTags;
  if (updates.customIngredients !== undefined) payload.customIngredients = updates.customIngredients;
  if (Object.keys(payload).length === 0) return;
  await setDoc(ref, payload, { merge: true });
  clearProfileCache();
};
