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
  status: MealPlanStatus;
  createdAt?: Date; // optionnel pour les anciens documents
};

const COLLECTION = 'mealPlans';

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
  try {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', uid),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(parseEntry)
      .filter((e) => e.date >= startStr && e.date <= endStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.warn('getMealPlansForDateRange failed:', e);
    return [];
  }
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
    status: 'planned',
    createdAt: serverTimestamp(),
  });
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
