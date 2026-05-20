import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

export type Objective = 'perte_poids' | 'prise_masse' | 'equilibre';
const PRIVATE_TAG_PREFIX = 'private:';
export type IngredientItem = {
  /** Nom affiché. Reste la source pour l'UI : on dénormalise même quand on a un ingredientId. */
  name: string;
  /** Quantité telle que saisie par l'utilisateur (texte libre, peut contenir "1/2"). */
  amount?: string;
  /** Unité libre (compat actuelle). Peut être une chaîne libre type "cuillère à soupe". */
  unit?: string;
  /** ID du document de la collection `ingredients` quand l'item est lié au catalogue. Optionnel. */
  ingredientId?: string;
  /** Quantité parsée en nombre (g, ml, pièces…) pour les calculs de macros. Optionnel. */
  amountValue?: number;
};

/**
 * Nettoie un tableau d'ingrédients avant écriture Firestore.
 * - Retire les champs `undefined` (Firestore les rejette avec la config par défaut).
 * - Trim le `name` et garde uniquement les items qui ont un nom non vide.
 * - `amountValue` n'est conservé que s'il s'agit d'un nombre fini.
 */
const sanitizeIngredientsDetailedForWrite = (items: IngredientItem[]): Record<string, unknown>[] =>
  items
    .map((item) => {
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) return null;
      const out: Record<string, unknown> = { name };
      if (typeof item.amount === 'string' && item.amount.trim()) out.amount = item.amount.trim();
      if (typeof item.unit === 'string' && item.unit.trim()) out.unit = item.unit.trim();
      if (typeof item.ingredientId === 'string' && item.ingredientId.trim()) {
        out.ingredientId = item.ingredientId.trim();
      }
      if (typeof item.amountValue === 'number' && Number.isFinite(item.amountValue)) {
        out.amountValue = item.amountValue;
      }
      return out;
    })
    .filter((v): v is Record<string, unknown> => !!v);

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
  /** Durée de préparation en minutes (portion) */
  prepMinutes?: number;
};

const RECIPES_CACHE_TTL_MS = 60_000;
let recipesCache:
  | {
      uid: string;
      fetchedAt: number;
      data: Recipe[];
    }
  | null = null;
let recipesInFlight: Promise<Recipe[]> | null = null;

const clearRecipesCache = () => {
  recipesCache = null;
  recipesInFlight = null;
};

export const clearRecipesCacheOnAuthChange = clearRecipesCache;

/** Document Firestore "recipes" (README) : name, ingredients, calories, tags */
type RecipeDocument = {
  name?: string;
  title?: string;
  ingredients?: string[];
  ingredientsDetailed?: Array<Partial<IngredientItem>>;
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
  prepMinutes?: number;
};

const mapFirestoreRecipeToRecipe = (id: string, docData: RecipeDocument, uid: string): Recipe => ({
  id,
  title: docData.name ?? docData.title ?? '',
  calories: docData.calories ?? 0,
  protein: typeof docData.protein === 'number' ? docData.protein : undefined,
  carbs: typeof docData.carbs === 'number' ? docData.carbs : undefined,
  fats: typeof docData.fats === 'number' ? docData.fats : undefined,
  tags: mapTagsForCurrentUser(Array.isArray(docData.tags) ? docData.tags : [], uid),
  ingredients: Array.isArray(docData.ingredients) ? docData.ingredients : [],
  ingredientsDetailed: Array.isArray(docData.ingredientsDetailed)
    ? docData.ingredientsDetailed
        .map((item): IngredientItem | null => {
          if (!item || typeof item !== 'object') return null;
          const name = typeof item.name === 'string' ? item.name.trim() : '';
          if (!name) return null;
          const mapped: IngredientItem = { name };
          if (typeof item.amount === 'string' && item.amount.trim()) {
            mapped.amount = item.amount.trim();
          }
          if (typeof item.unit === 'string' && item.unit.trim()) {
            mapped.unit = item.unit.trim();
          }
          if (typeof item.ingredientId === 'string' && item.ingredientId.trim()) {
            mapped.ingredientId = item.ingredientId.trim();
          }
          if (typeof item.amountValue === 'number' && Number.isFinite(item.amountValue)) {
            mapped.amountValue = item.amountValue;
          }
          return mapped;
        })
        .filter((item): item is IngredientItem => item !== null)
    : undefined,
  instructions: Array.isArray(docData.instructions)
    ? docData.instructions
    : docData.instructions
    ? [docData.instructions]
    : undefined,
  image: docData.image,
  createdBy: docData.createdBy ?? null,
  difficulty: docData.difficulty,
  rating: docData.rating,
  prepMinutes:
    typeof docData.prepMinutes === 'number' && docData.prepMinutes > 0
      ? Math.round(docData.prepMinutes)
      : undefined,
});

export const getRecipeById = async (recipeId: string): Promise<Recipe | null> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const ref = doc(db, 'recipes', recipeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return mapFirestoreRecipeToRecipe(snap.id, snap.data() as RecipeDocument, uid);
  } catch (e) {
    console.warn('getRecipeById failed:', e);
    return null;
  }
};

export const getRecommendedRecipes = async (
  objective: Objective
): Promise<Recipe[]> => {
  const recipes = await getAllRecipes();
  const filtered = recipes.filter((r) => r.tags.includes(objective));
  return filtered.length > 0 ? filtered : recipes;
};

/** Taille d’une page pour l’écran Recettes (affichage progressif). */
export const RECIPES_PAGE_SIZE = 4;

/**
 * Nombre total de recettes (agrégation Firestore, sans charger les documents).
 * @param onlyMine si true, uniquement les recettes créées par l’utilisateur connecté.
 */
export async function getRecipesTotalCount(onlyMine: boolean): Promise<number> {
  const uid = auth.currentUser?.uid;
  if (!uid) return 0;
  try {
    const col = collection(db, 'recipes');
    const snapshot = onlyMine
      ? await getCountFromServer(query(col, where('createdBy', '==', uid)))
      : await getCountFromServer(col);
    return snapshot.data().count;
  } catch (e) {
    console.warn('getRecipesTotalCount failed:', e);
    return 0;
  }
}

const PUBLIC_RECIPE_TAGS = new Set([
  'perte_poids',
  'prise_masse',
  'equilibre',
  'vegetarien',
  'riche_proteine',
]);

const persistedTagQueryValues = (tag: string, uid: string, onlyMine: boolean): string[] => {
  if (!onlyMine || PUBLIC_RECIPE_TAGS.has(tag)) return [tag];
  const privateTag = `${PRIVATE_TAG_PREFIX}${uid}:${tag}`;
  return privateTag === tag ? [tag] : [tag, privateTag];
};

const countFavoriteRecipes = async (
  onlyMine: boolean,
  favoriteRecipeIds: string[],
  uid: string,
): Promise<number> => {
  if (favoriteRecipeIds.length === 0) return 0;
  const col = collection(db, 'recipes');
  const IN_LIMIT = 30;
  let total = 0;

  for (let i = 0; i < favoriteRecipeIds.length; i += IN_LIMIT) {
    const chunk = favoriteRecipeIds.slice(i, i + IN_LIMIT);
    const q = onlyMine
      ? query(col, where('createdBy', '==', uid), where(documentId(), 'in', chunk))
      : query(col, where(documentId(), 'in', chunk));
    try {
      const snapshot = await getCountFromServer(q);
      total += snapshot.data().count;
    } catch (e) {
      console.warn('countFavoriteRecipes batch failed:', e);
    }
  }

  return total;
};

const countRecipesWithTag = async (
  tag: string,
  onlyMine: boolean,
  uid: string,
): Promise<number> => {
  const col = collection(db, 'recipes');
  const tagValues = persistedTagQueryValues(tag, uid, onlyMine);

  try {
    if (onlyMine) {
      if (tagValues.length === 1) {
        const snapshot = await getCountFromServer(
          query(
            col,
            where('createdBy', '==', uid),
            where('tags', 'array-contains', tagValues[0]),
          ),
        );
        return snapshot.data().count;
      }
      const snapshot = await getCountFromServer(
        query(
          col,
          where('createdBy', '==', uid),
          where('tags', 'array-contains-any', tagValues),
        ),
      );
      return snapshot.data().count;
    }

    const snapshot = await getCountFromServer(
      query(col, where('tags', 'array-contains', tag)),
    );
    return snapshot.data().count;
  } catch (e) {
    console.warn('countRecipesWithTag failed:', e);
    return 0;
  }
};

/**
 * Nombre total affiché pour le toggle + filtre actifs (sans pagination).
 * La recherche texte reste calculée côté client sur les recettes chargées.
 */
export async function getRecipesDisplayCount(params: {
  onlyMine: boolean;
  activeFilter: 'all' | 'favoris' | string;
  favoriteRecipeIds: string[];
}): Promise<number> {
  const uid = auth.currentUser?.uid;
  if (!uid) return 0;

  const { onlyMine, activeFilter, favoriteRecipeIds } = params;

  if (activeFilter === 'all') {
    return getRecipesTotalCount(onlyMine);
  }
  if (activeFilter === 'favoris') {
    return countFavoriteRecipes(onlyMine, favoriteRecipeIds, uid);
  }
  return countRecipesWithTag(activeFilter, onlyMine, uid);
}

export type RecipesPageCursor = QueryDocumentSnapshot<DocumentData> | null;

export type RecipesPageResult = {
  recipes: Recipe[];
  /** Dernier document de la page courante (pour la page suivante). */
  cursor: RecipesPageCursor;
  hasMore: boolean;
};

/**
 * Charge une page de recettes (ordre stable par id document Firestore).
 */
export async function getRecipesPage(
  pageSize: number,
  afterCursor: RecipesPageCursor,
  onlyMine = false,
): Promise<RecipesPageResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return { recipes: [], cursor: null, hasMore: false };
  }

  const col = collection(db, 'recipes');
  const ordered = orderBy(documentId());
  const pageLimit = limit(pageSize + 1);
  const baseConstraints = onlyMine ? [where('createdBy', '==', uid), ordered] : [ordered];
  const q = afterCursor
    ? query(col, ...baseConstraints, startAfter(afterCursor), pageLimit)
    : query(col, ...baseConstraints, pageLimit);

  try {
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasExtra = docs.length > pageSize;
    const pageDocs = hasExtra ? docs.slice(0, pageSize) : docs;

    const recipes = pageDocs.map((docSnap) =>
      mapFirestoreRecipeToRecipe(docSnap.id, docSnap.data() as RecipeDocument, uid),
    );
    const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : undefined;
    const cursor: RecipesPageCursor = lastDoc ?? null;

    return {
      recipes,
      cursor,
      hasMore: hasExtra,
    };
  } catch (e) {
    console.warn('getRecipesPage failed:', e);
    return { recipes: [], cursor: null, hasMore: false };
  }
}

/** Charge assez de pages pour atteindre au moins `targetCount` recettes (si disponibles). */
export async function fetchRecipesUpTo(
  targetCount: number,
  startCursor: RecipesPageCursor,
  onlyMine: boolean,
  pageSize: number = RECIPES_PAGE_SIZE,
): Promise<RecipesPageResult> {
  let recipes: Recipe[] = [];
  let cursor = startCursor;
  let hasMore = true;

  while (recipes.length < targetCount && hasMore) {
    const page = await getRecipesPage(pageSize, cursor, onlyMine);
    if (page.recipes.length === 0) {
      return { recipes, cursor, hasMore: false };
    }
    recipes = [...recipes, ...page.recipes];
    cursor = page.cursor;
    hasMore = page.hasMore;
  }

  return { recipes, cursor, hasMore };
}

export const getAllRecipes = async (): Promise<Recipe[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  if (
    recipesCache &&
    recipesCache.uid === uid &&
    Date.now() - recipesCache.fetchedAt < RECIPES_CACHE_TTL_MS
  ) {
    return recipesCache.data;
  }

  if (recipesInFlight) return recipesInFlight;

  recipesInFlight = (async () => {
    try {
      const snapshot = await getDocs(collection(db, 'recipes'));
      const data = snapshot.docs.map((docSnap) =>
        mapFirestoreRecipeToRecipe(docSnap.id, docSnap.data() as RecipeDocument, uid),
      );
      recipesCache = { uid, fetchedAt: Date.now(), data };
      return data;
    } catch (e) {
      console.warn('Firestore recipes read failed:', e);
      return [];
    } finally {
      recipesInFlight = null;
    }
  })();

  return recipesInFlight;
};

export const createRecipe = async (recipe: Omit<Recipe, 'id'>) => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Tu dois être connecté pour créer une recette.');
  }

  const {
    image,
    instructions,
    prepMinutes,
    ingredientsDetailed,
    protein,
    carbs,
    fats,
    difficulty,
    rating,
    ...required
  } = recipe;

  const payload: Record<string, unknown> = {
    ...required,
    createdAt: serverTimestamp(),
    createdBy: userId,
  };

  if (typeof protein === 'number' && Number.isFinite(protein)) payload.protein = protein;
  if (typeof carbs === 'number' && Number.isFinite(carbs)) payload.carbs = carbs;
  if (typeof fats === 'number' && Number.isFinite(fats)) payload.fats = fats;
  if (typeof difficulty === 'string' && difficulty.trim()) payload.difficulty = difficulty.trim();
  if (typeof rating === 'number' && Number.isFinite(rating)) payload.rating = rating;

  if (ingredientsDetailed && ingredientsDetailed.length > 0) {
    payload.ingredientsDetailed = sanitizeIngredientsDetailedForWrite(ingredientsDetailed);
  }

  if (image) {
    payload.image = image;
  }

  if (instructions && instructions.length > 0) {
    payload.instructions = instructions;
  }

  if (typeof prepMinutes === 'number' && prepMinutes > 0) {
    payload.prepMinutes = Math.round(prepMinutes);
  }

  await addDoc(collection(db, 'recipes'), payload);
  clearRecipesCache();
};

export const updateRecipe = async (
  id: string,
  updates: Partial<Omit<Recipe, 'id'>>,
  options?: { clearPrepMinutes?: boolean },
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
  if (updates.ingredientsDetailed !== undefined) {
    payload.ingredientsDetailed = sanitizeIngredientsDetailedForWrite(updates.ingredientsDetailed);
  }
  if (updates.instructions !== undefined) payload.instructions = updates.instructions;
  if (updates.image !== undefined) payload.image = updates.image;
  if (options?.clearPrepMinutes) {
    payload.prepMinutes = deleteField();
  } else if (updates.prepMinutes !== undefined) {
    payload.prepMinutes = updates.prepMinutes;
  }

  await updateDoc(ref, payload);
  clearRecipesCache();
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
  clearRecipesCache();
};
