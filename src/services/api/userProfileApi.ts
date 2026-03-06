import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import type { Objective } from './recipesApi';

export type UserProfile = {
  objective?: Objective;
  calorieGoal?: number;
};

const COLLECTION = 'users';

export const getUserProfile = async (): Promise<UserProfile | null> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const ref = doc(db, COLLECTION, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      objective: data.objective ?? undefined,
      calorieGoal: data.calorieGoal ?? undefined,
    };
  } catch (e) {
    console.warn('getUserProfile failed:', e);
    return null;
  }
};

export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Non connecté.');
  const ref = doc(db, COLLECTION, uid);
  const payload: Record<string, unknown> = {};
  if (updates.objective !== undefined) payload.objective = updates.objective;
  if (updates.calorieGoal !== undefined) payload.calorieGoal = updates.calorieGoal;
  if (Object.keys(payload).length === 0) return;
  await setDoc(ref, payload, { merge: true });
};
