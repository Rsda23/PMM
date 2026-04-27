import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

export type Objective = 'perte_poids' | 'prise_masse' | 'equilibre';
const PRIVATE_TAG_PREFIX = 'private:';
export type IngredientItem = {
  name: string;
  amount?: string;
  unit?: string;
};

const mapTagsForCurrentUser = (tags: string[], currentUid?: string): string[] => {
  return tags.flatMap((tag) => {
    if (!tag.startsWith(PRIVATE_TAG_PREFIX)) return [tag];
    const match = /^private:([^:]+):(.+)$/.exec(tag);
    if (!match) return [];
    const [, ownerUid, privateTag] = match;
    if (!currentUid || ownerUid !== currentUid) return [];
    return [privateTag];
  });
};

export type Recipe = {
  id: string;
  title: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  tags: string[];
  ingredients: string[];
  ingredientsDetailed?: IngredientItem[];
  instructions?: string[];
  image?: string;
  createdBy?: string | null;
  difficulty?: string;
  rating?: number;
};

/** Document Firestore "recipes" (README) : name, ingredients, calories, tags */
type RecipeDocument = {
  name?: string;
  title?: string;
  ingredients?: string[];
  ingredientsDetailed?: IngredientItem[];
  instructions?: string[] | string;
  image?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  tags: string[];
  createdBy?: string | null;
  difficulty?: string;
  rating?: number;
};

export const getRecommendedRecipes = async (
  objective: Objective
): Promise<Recipe[]> => {
  const recipes = await getAllRecipes();
  const filtered = recipes.filter((r) => r.tags.includes(objective));
  return filtered.length > 0 ? filtered : recipes;
};

export const getAllRecipes = async (): Promise<Recipe[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  try {
    const snapshot = await getDocs(collection(db, 'recipes'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as RecipeDocument;
      return {
        id: docSnap.id,
        title: data.name ?? data.title ?? '',
        calories: data.calories ?? 0,
        protein: typeof data.protein === 'number' ? data.protein : undefined,
        carbs: typeof data.carbs === 'number' ? data.carbs : undefined,
        fats: typeof data.fats === 'number' ? data.fats : undefined,
        tags: mapTagsForCurrentUser(Array.isArray(data.tags) ? data.tags : [], uid),
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        ingredientsDetailed: Array.isArray(data.ingredientsDetailed)
          ? data.ingredientsDetailed
              .map((item) => {
                if (!item || typeof item !== 'object') return null;
                const name = typeof item.name === 'string' ? item.name.trim() : '';
                if (!name) return null;
                return {
                  name,
                  amount: typeof item.amount === 'string' ? item.amount : undefined,
                  unit: typeof item.unit === 'string' ? item.unit : undefined,
                };
              })
              .filter((item): item is IngredientItem => !!item)
          : undefined,
        instructions: Array.isArray(data.instructions)
          ? data.instructions
          : data.instructions
          ? [data.instructions]
          : undefined,
        image: data.image,
        createdBy: data.createdBy ?? null,
        difficulty: data.difficulty,
        rating: data.rating,
      };
    });
  } catch (e) {
    console.warn('Firestore recipes read failed:', e);
    return [];
  }
};

export const createRecipe = async (recipe: Omit<Recipe, 'id'>) => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Tu dois être connecté pour créer une recette.');
  }

  const { image, instructions, ...required } = recipe;

  const payload: Record<string, unknown> = {
    ...required,
    createdAt: serverTimestamp(),
    createdBy: userId,
  };

  if (image) {
    payload.image = image;
  }

  if (instructions && instructions.length > 0) {
    payload.instructions = instructions;
  }

  await addDoc(collection(db, 'recipes'), payload);
};

export const updateRecipe = async (
  id: string,
  updates: Partial<Omit<Recipe, 'id'>>,
) => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Tu dois être connecté pour modifier une recette.');
  }

  const ref = doc(db, 'recipes', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Recette introuvable.');
  }
  const createdBy = (snap.data() as RecipeDocument).createdBy;
  if (createdBy !== userId) {
    throw new Error('Tu ne peux modifier que tes propres recettes.');
  }

  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.calories !== undefined) payload.calories = updates.calories;
  if (updates.protein !== undefined) payload.protein = updates.protein;
  if (updates.carbs !== undefined) payload.carbs = updates.carbs;
  if (updates.fats !== undefined) payload.fats = updates.fats;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.ingredients !== undefined) payload.ingredients = updates.ingredients;
  if (updates.ingredientsDetailed !== undefined) payload.ingredientsDetailed = updates.ingredientsDetailed;
  if (updates.instructions !== undefined) payload.instructions = updates.instructions;
  if (updates.image !== undefined) payload.image = updates.image;

  await updateDoc(ref, payload);
};

export const deleteRecipe = async (id: string) => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Tu dois être connecté pour supprimer une recette.');
  }
  const ref = doc(db, 'recipes', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Recette introuvable.');
  }
  const createdBy = (snap.data() as RecipeDocument).createdBy;
  if (createdBy !== userId) {
    throw new Error('Tu ne peux supprimer que tes propres recettes.');
  }
  await deleteDoc(ref);
};
