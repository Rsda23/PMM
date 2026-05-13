import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { toDateString } from '../../utils/dateUtils';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealPlanStatus = 'planned' | 'completed';

/** On stocke recipeId + recipeTitle + calories pour que l’historique reste correct si la recette est modifiée plus tard. */
export type MealPlanEntry = {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  mealType: MealType;
  recipeId: string;
  recipeTitle: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  status: MealPlanStatus;
  createdAt?: Date; // optionnel pour les anciens documents
};

const COLLECTION = 'mealPlans';
const MEAL_PLANS_CACHE_TTL_MS = 20_000;
let mealPlansCache:
  | {
      uid: string;
      fetchedAt: number;
      data: MealPlanEntry[];
    }
  | null = null;
let mealPlansInFlight: Promise<MealPlanEntry[]> | null = null;

const clearMealPlansCache = () => {
  mealPlansCache = null;
  mealPlansInFlight = null;
};

export const clearMealPlansCacheOnAuthChange = clearMealPlansCache;

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function parseEntry(docSnap: { id: string; data: () => Record<string, unknown> }): MealPlanEntry {
  const data = docSnap.data() as Record<string, unknown>;
  const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? undefined;
  return {
    id: docSnap.id,
    userId: data.userId as string,
    date: data.date as string,
    mealType: data.mealType as MealType,
    recipeId: data.recipeId as string,
    recipeTitle: (data.recipeTitle as string) ?? '',
    calories: (data.calories as number) ?? 0,
    protein: typeof data.protein === 'number' ? data.protein : undefined,
    carbs: typeof data.carbs === 'number' ? data.carbs : undefined,
    fats: typeof data.fats === 'number' ? data.fats : undefined,
    status: ((data.status as string) ?? 'planned') as MealPlanStatus,
    ...(createdAt && { createdAt }),
  };
}

export async function getMealPlansForDateRange(
  startDate: Date | string,
  endDate: Date | string
): Promise<MealPlanEntry[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const startStr = typeof startDate === 'string' ? startDate : toDateString(startDate);
  const endStr = typeof endDate === 'string' ? endDate : toDateString(endDate);

  const getAllForUser = async (): Promise<MealPlanEntry[]> => {
    if (
      mealPlansCache &&
      mealPlansCache.uid === uid &&
      Date.now() - mealPlansCache.fetchedAt < MEAL_PLANS_CACHE_TTL_MS
    ) {
      return mealPlansCache.data;
    }

    if (mealPlansInFlight) return mealPlansInFlight;

    mealPlansInFlight = (async () => {
      try {
        const q = query(collection(db, COLLECTION), where('userId', '==', uid));
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map(parseEntry)
          .sort((a, b) => a.date.localeCompare(b.date));
        mealPlansCache = { uid, fetchedAt: Date.now(), data };
        return data;
      } catch (e) {
        console.warn('getMealPlansForDateRange failed:', e);
        return [];
      } finally {
        mealPlansInFlight = null;
      }
    })();

    return mealPlansInFlight;
  };

  const allEntries = await getAllForUser();
  return allEntries.filter((e) => e.date >= startStr && e.date <= endStr);
}

export async function getMealPlansForWeek(weekStart: Date): Promise<MealPlanEntry[]> {
  const { start, end } = getWeekBounds(weekStart);
  return getMealPlansForDateRange(start, end);
}

export async function getMealPlansForDay(dateString: string): Promise<MealPlanEntry[]> {
  return getMealPlansForDateRange(dateString, dateString);
}

/** Enregistre recipeId + recipeTitle + calories pour figer le libellé et les kcal au moment de l’ajout (historique stable). */
export async function addMealPlan(params: {
  date: string;
  mealType: MealType;
  recipeId: string;
  recipeTitle: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Tu dois être connecté pour planifier un repas.');
  const ref = await addDoc(collection(db, COLLECTION), {
    userId: uid,
    date: params.date,
    mealType: params.mealType,
    recipeId: params.recipeId,
    recipeTitle: params.recipeTitle,
    calories: params.calories,
    ...(params.protein !== undefined ? { protein: params.protein } : {}),
    ...(params.carbs !== undefined ? { carbs: params.carbs } : {}),
    ...(params.fats !== undefined ? { fats: params.fats } : {}),
    status: 'planned',
    createdAt: serverTimestamp(),
  });
  clearMealPlansCache();
  return ref.id;
}

export async function updateMealPlanStatus(id: string, status: MealPlanStatus): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Non connecté.');
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists() || (snap.data() as { userId: string }).userId !== uid) {
    throw new Error('Entrée introuvable.');
  }
  await updateDoc(ref, { status });
  clearMealPlansCache();
}

export async function deleteMealPlan(id: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Non connecté.');
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists() || (snap.data() as { userId: string }).userId !== uid) {
    throw new Error('Entrée introuvable.');
  }
  await deleteDoc(ref);
  clearMealPlansCache();
}

export function groupEntriesByDate(entries: MealPlanEntry[]): Map<string, MealPlanEntry[]> {
  const map = new Map<string, MealPlanEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const order: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
      return order.indexOf(a.mealType) - order.indexOf(b.mealType);
    });
  }
  return map;
}

export function totalCalories(entries: MealPlanEntry[], onlyCompleted = false): number {
  return entries
    .filter((e) => !onlyCompleted || e.status === 'completed')
    .reduce((sum, e) => sum + e.calories, 0);
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Petit déjeuner',
  lunch: 'Déjeuner',
  snack: 'Encas',
  dinner: 'Dîner',
};
