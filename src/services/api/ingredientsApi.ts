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

/**
 * Unité par défaut associée à un ingrédient.
 *
 * - `g`  : aliment solide pesé en grammes
 * - `ml` : aliment liquide mesuré en millilitres
 * - `piece` : aliment dénombrable (1 œuf, 1 oignon, 1 tranche…)
 * - `cuillere_a_soupe`, `cuillere_a_cafe` : mesures volumétriques courantes
 * - `pincee` : approximation (sel, épices…)
 */
export type IngredientUnit =
  | 'g'
  | 'ml'
  | 'piece'
  | 'cuillere_a_soupe'
  | 'cuillere_a_cafe'
  | 'pincee';

/**
 * Catégorie haute-niveau utilisée pour le tri / les filtres dans l'UI.
 * Volontairement limité au début, extensible.
 */
export type IngredientCategory =
  | 'viande'
  | 'poisson'
  | 'oeuf_laitier'
  | 'legume'
  | 'fruit'
  | 'feculent'
  | 'legumineuse'
  | 'matiere_grasse'
  | 'epice_aromate'
  | 'sauce_condiment'
  | 'boisson'
  | 'sucre_chocolat'
  | 'autre';

/**
 * Document Firestore `ingredients/{id}`.
 *
 * Les ingrédients dits "officiels" ont `createdBy == null` et sont écrits via
 * l'Admin SDK (script de seed). Les ingrédients perso ont `createdBy == uid`
 * et sont créés/édités via l'app.
 *
 * Les macros sont exprimées pour 100 g (ou 100 ml pour les liquides). Toutes
 * optionnelles : on peut amorcer un ingrédient sans macros et les compléter
 * plus tard.
 */
export type Ingredient = {
  id: string;
  name: string;
  aliases?: string[];
  category?: IngredientCategory;
  defaultUnit?: IngredientUnit;
  kcalPer100?: number;
  proteinPer100?: number;
  carbsPer100?: number;
  fatsPer100?: number;
  /**
   * Poids moyen d'une pièce en grammes, pour les ingrédients dont `defaultUnit`
   * est `piece` (ex. œuf ≈ 50 g, oignon ≈ 110 g). Permet de convertir une
   * quantité en pièces vers les macros pour 100 g.
   */
  gramsPerPiece?: number;
  tags?: string[];
  allergens?: string[];
  createdBy: string | null;
};

type IngredientDocument = Omit<Ingredient, 'id'>;

const COLLECTION = 'ingredients';
const INGREDIENTS_CACHE_TTL_MS = 5 * 60_000;

let ingredientsCache:
  | {
      uid: string;
      fetchedAt: number;
      data: Ingredient[];
    }
  | null = null;
let ingredientsInFlight: Promise<Ingredient[]> | null = null;

const clearIngredientsCache = () => {
  ingredientsCache = null;
  ingredientsInFlight = null;
};

export const clearIngredientsCacheOnAuthChange = clearIngredientsCache;

const mapFirestoreIngredient = (id: string, data: IngredientDocument): Ingredient => ({
  id,
  name: typeof data.name === 'string' ? data.name : '',
  aliases: Array.isArray(data.aliases) ? data.aliases : undefined,
  category: data.category,
  defaultUnit: data.defaultUnit,
  kcalPer100: typeof data.kcalPer100 === 'number' ? data.kcalPer100 : undefined,
  proteinPer100: typeof data.proteinPer100 === 'number' ? data.proteinPer100 : undefined,
  carbsPer100: typeof data.carbsPer100 === 'number' ? data.carbsPer100 : undefined,
  fatsPer100: typeof data.fatsPer100 === 'number' ? data.fatsPer100 : undefined,
  gramsPerPiece:
    typeof data.gramsPerPiece === 'number' && Number.isFinite(data.gramsPerPiece)
      ? data.gramsPerPiece
      : undefined,
  tags: Array.isArray(data.tags) ? data.tags : undefined,
  allergens: Array.isArray(data.allergens) ? data.allergens : undefined,
  createdBy: data.createdBy ?? null,
});

/**
 * Charge le catalogue complet (officiels + perso de l'utilisateur courant).
 * Les règles Firestore filtrent déjà côté serveur ce que l'utilisateur peut
 * voir : il accède aux officiels (createdBy == null) + les siens.
 *
 * On garde un cache mémoire de 5 minutes — le catalogue est censé bouger peu.
 */
export const getAllIngredients = async (): Promise<Ingredient[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  if (
    ingredientsCache &&
    ingredientsCache.uid === uid &&
    Date.now() - ingredientsCache.fetchedAt < INGREDIENTS_CACHE_TTL_MS
  ) {
    return ingredientsCache.data;
  }

  if (ingredientsInFlight) return ingredientsInFlight;

  ingredientsInFlight = (async () => {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION));
      const data = snapshot.docs.map((docSnap) =>
        mapFirestoreIngredient(docSnap.id, docSnap.data() as IngredientDocument),
      );
      ingredientsCache = { uid, fetchedAt: Date.now(), data };
      return data;
    } catch (e) {
      console.warn('Firestore ingredients read failed:', e);
      return [];
    } finally {
      ingredientsInFlight = null;
    }
  })();

  return ingredientsInFlight;
};

export const getIngredientById = async (id: string): Promise<Ingredient | null> => {
  if (!auth.currentUser?.uid) return null;
  try {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return mapFirestoreIngredient(snap.id, snap.data() as IngredientDocument);
  } catch (e) {
    console.warn('getIngredientById failed:', e);
    return null;
  }
};

/**
 * Crée un ingrédient personnel (`createdBy == uid`).
 * Utilise `addDoc` pour générer un id Firestore unique et éviter tout conflit
 * avec les slugs des ingrédients officiels.
 */
export const createPersonalIngredient = async (
  input: Omit<Ingredient, 'id' | 'createdBy'>,
): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Tu dois être connecté pour créer un ingrédient.');

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error('Le nom de l’ingrédient est requis.');

  const payload: Record<string, unknown> = {
    name: trimmedName,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.aliases?.length) payload.aliases = input.aliases;
  if (input.category) payload.category = input.category;
  if (input.defaultUnit) payload.defaultUnit = input.defaultUnit;
  if (typeof input.kcalPer100 === 'number') payload.kcalPer100 = input.kcalPer100;
  if (typeof input.proteinPer100 === 'number') payload.proteinPer100 = input.proteinPer100;
  if (typeof input.carbsPer100 === 'number') payload.carbsPer100 = input.carbsPer100;
  if (typeof input.fatsPer100 === 'number') payload.fatsPer100 = input.fatsPer100;
  if (typeof input.gramsPerPiece === 'number') payload.gramsPerPiece = input.gramsPerPiece;
  if (input.tags?.length) payload.tags = input.tags;
  if (input.allergens?.length) payload.allergens = input.allergens;

  const ref = await addDoc(collection(db, COLLECTION), payload);
  clearIngredientsCache();
  return ref.id;
};

/**
 * Met à jour un ingrédient personnel. Les officiels (`createdBy == null`)
 * sont bloqués par les règles Firestore — inutile de double-vérifier ici.
 */
export const updatePersonalIngredient = async (
  id: string,
  updates: Partial<Omit<Ingredient, 'id' | 'createdBy'>>,
): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Tu dois être connecté pour modifier un ingrédient.');

  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.aliases !== undefined) payload.aliases = updates.aliases;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.defaultUnit !== undefined) payload.defaultUnit = updates.defaultUnit;
  if (updates.kcalPer100 !== undefined) payload.kcalPer100 = updates.kcalPer100;
  if (updates.proteinPer100 !== undefined) payload.proteinPer100 = updates.proteinPer100;
  if (updates.carbsPer100 !== undefined) payload.carbsPer100 = updates.carbsPer100;
  if (updates.fatsPer100 !== undefined) payload.fatsPer100 = updates.fatsPer100;
  if (updates.gramsPerPiece !== undefined) payload.gramsPerPiece = updates.gramsPerPiece;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.allergens !== undefined) payload.allergens = updates.allergens;

  await updateDoc(doc(db, COLLECTION, id), payload);
  clearIngredientsCache();
};

export const deletePersonalIngredient = async (id: string): Promise<void> => {
  if (!auth.currentUser?.uid) {
    throw new Error('Tu dois être connecté pour supprimer un ingrédient.');
  }
  await deleteDoc(doc(db, COLLECTION, id));
  clearIngredientsCache();
};
