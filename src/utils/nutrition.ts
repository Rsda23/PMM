import type { Ingredient } from '../services/api/ingredientsApi';
import type { IngredientItem } from '../services/api/recipesApi';

/**
 * Résultat agrégé du calcul nutritionnel pour une liste d'ingrédients de
 * recette. Les valeurs sont arrondies, et `linkedCount` / `uncountedCount`
 * permettent à l'UI de prévenir l'utilisateur que l'estimation est partielle.
 */
export type MacroEstimate = {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  /** Ingrédients pris en compte dans le calcul. */
  linkedCount: number;
  /** Ingrédients ignorés faute de catalogue ou de quantité parsable. */
  uncountedCount: number;
};

const EMPTY: MacroEstimate = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  linkedCount: 0,
  uncountedCount: 0,
};

/**
 * Calcule une estimation des macros pour une recette à partir de :
 *  - sa liste d'ingrédients (`ingredientsDetailed`),
 *  - le catalogue d'ingrédients (chacun avec des macros pour 100 g/100 ml).
 *
 * Règles de comptabilisation (volontairement conservatrices) :
 *  - L'item DOIT avoir un `ingredientId` qui pointe vers un doc du catalogue.
 *  - L'item DOIT avoir un `amountValue` numérique.
 *  - Trois cas valides selon `defaultUnit` du catalogue :
 *      1. `g` ou `ml` ET item dans la même unité → facteur = amountValue / 100.
 *      2. `piece` ET item en `piece` ET `gramsPerPiece` défini sur le
 *         catalogue → facteur = (amountValue * gramsPerPiece) / 100.
 *      3. Aucun (toute autre combinaison) → `uncountedCount` est incrémenté
 *         plutôt que de fausser le total avec une conversion approximative.
 */
export const computeMacrosFromIngredients = (
  items: IngredientItem[] | undefined,
  catalog: Ingredient[] | undefined,
): MacroEstimate => {
  if (!items?.length || !catalog?.length) return { ...EMPTY };

  const byId = new Map(catalog.map((ing) => [ing.id, ing]));
  const result: MacroEstimate = { ...EMPTY };

  for (const item of items) {
    if (!item.ingredientId || typeof item.amountValue !== 'number' || !Number.isFinite(item.amountValue)) {
      result.uncountedCount += 1;
      continue;
    }
    const ing = byId.get(item.ingredientId);
    if (!ing) {
      result.uncountedCount += 1;
      continue;
    }
    const baseUnit = ing.defaultUnit;

    let factor: number | null = null;
    if ((baseUnit === 'g' || baseUnit === 'ml') && item.unit === baseUnit) {
      factor = item.amountValue / 100;
    } else if (
      baseUnit === 'piece' &&
      item.unit === 'piece' &&
      typeof ing.gramsPerPiece === 'number' &&
      ing.gramsPerPiece > 0
    ) {
      factor = (item.amountValue * ing.gramsPerPiece) / 100;
    }

    if (factor === null) {
      result.uncountedCount += 1;
      continue;
    }

    if (typeof ing.kcalPer100 === 'number') result.kcal += ing.kcalPer100 * factor;
    if (typeof ing.proteinPer100 === 'number') result.protein += ing.proteinPer100 * factor;
    if (typeof ing.carbsPer100 === 'number') result.carbs += ing.carbsPer100 * factor;
    if (typeof ing.fatsPer100 === 'number') result.fats += ing.fatsPer100 * factor;
    result.linkedCount += 1;
  }

  result.kcal = Math.round(result.kcal);
  result.protein = Math.round(result.protein * 10) / 10;
  result.carbs = Math.round(result.carbs * 10) / 10;
  result.fats = Math.round(result.fats * 10) / 10;

  return result;
};

/**
 * Vrai si l'estimation contient au moins un ingrédient comptabilisé.
 */
export const isUsableEstimate = (estimate: MacroEstimate): boolean => estimate.linkedCount > 0;
