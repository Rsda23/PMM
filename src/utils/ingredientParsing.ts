import type { Ingredient, IngredientUnit } from '../services/api/ingredientsApi';
import type { IngredientItem } from '../services/api/recipesApi';

/**
 * Sortie du parsing d'une ligne d'ingrédient en texte libre.
 * Tous les champs sont optionnels sauf `name` : c'est la seule garantie minimale.
 */
export type ParsedIngredientLine = {
  name: string;
  amount?: string;
  unit?: IngredientUnit | string;
  amountValue?: number;
};

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

const replaceFractions = (s: string): string =>
  s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (ch) => ` ${UNICODE_FRACTIONS[ch]} `);

const stripParens = (s: string): string => s.replace(/\([^)]*\)/g, ' ');
// Les ligatures (œ, æ) ne sont pas décomposées par NFD : on les remplace
// explicitement avant la normalisation. Sans ça, [^a-z0-9\s] les transforme
// en espace et "bœuf" devient "b uf" → faux match catalogue.
const stripAccents = (s: string): string =>
  s
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'Oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const normalizeSpaces = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Quantité au début : "300", "1,5", "1/2", "1 1/2", "2-3" */
const QUANTITY_RE =
  /^\s*(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+([.,]\d+)?(\s*[-à]\s*\d+([.,]\d+)?)?)\s*/i;

/**
 * Mapping des unités libres détectées dans le texte vers les unités
 * normalisées du catalogue. Inclut les variantes avec/sans accents puisqu'on
 * compare sur la version accent-strippée.
 */
const UNIT_PATTERNS: Array<{ re: RegExp; unit: IngredientUnit; scale?: number }> = [
  { re: /^kg\b\.?/i, unit: 'g', scale: 1000 },
  { re: /^kilogrammes?\b\.?/i, unit: 'g', scale: 1000 },
  { re: /^g\b\.?/i, unit: 'g' },
  { re: /^grammes?\b\.?/i, unit: 'g' },
  { re: /^litres?\b\.?/i, unit: 'ml', scale: 1000 },
  { re: /^l\b\.?/i, unit: 'ml', scale: 1000 },
  { re: /^centilitres?\b\.?/i, unit: 'ml', scale: 10 },
  { re: /^cl\b\.?/i, unit: 'ml', scale: 10 },
  { re: /^millilitres?\b\.?/i, unit: 'ml' },
  { re: /^ml\b\.?/i, unit: 'ml' },
  { re: /^c\.?\s*a\s*\.?\s*soupe\b/i, unit: 'cuillere_a_soupe' },
  { re: /^cuilleres?\s+a\s+soupe\b/i, unit: 'cuillere_a_soupe' },
  { re: /^cuillerees?\s+a\s+soupe\b/i, unit: 'cuillere_a_soupe' },
  { re: /^c\.?\s*a\s*\.?\s*s\.?\b/i, unit: 'cuillere_a_soupe' },
  { re: /^c\.?\s*a\s*\.?\s*cafe\b/i, unit: 'cuillere_a_cafe' },
  { re: /^cuilleres?\s+a\s+cafe\b/i, unit: 'cuillere_a_cafe' },
  { re: /^cuillerees?\s+a\s+cafe\b/i, unit: 'cuillere_a_cafe' },
  { re: /^c\.?\s*a\s*\.?\s*c\.?\b/i, unit: 'cuillere_a_cafe' },
  { re: /^pincees?\b\.?/i, unit: 'pincee' },
];

const FREE_UNITS_RE =
  /^(gousses?|tasses?|verres?|bols?|boites?|sachets?|paquets?|tranches?|morceaux?|feuilles?|brins?|branches?|bouquets?|tetes?|cubes?|noix|gouttes?)\b\.?/i;

const PREPOSITION_RE = /^(?:de\s+la|de\s+l['’]|du\s+|des\s+|de\s+|d['’])\s*/i;

/**
 * Préfixes descriptifs sans quantité ("Pincée de sel", "Quelques gouttes de…").
 * On les détecte avant la passe quantité pour leur attribuer l'unité correcte
 * et garder un nom propre.
 */
const DESCRIPTOR_PREFIXES: Array<{ re: RegExp; unit?: IngredientUnit }> = [
  { re: /^pincees?\s+/i, unit: 'pincee' },
  { re: /^quelques\s+gouttes?\s+(?:de\s+|d['’])/i },
  { re: /^quelques\s+/i },
  { re: /^un\s+peu\s+(?:de\s+|d['’])/i },
];

const parseAmountValue = (
  raw: string | undefined,
  scale: number,
): number | undefined => {
  if (!raw) return undefined;
  const cleaned = raw.replace(',', '.').trim();
  const simple = /^\d+(\.\d+)?$/;
  const fraction = /^(\d+)\s*\/\s*(\d+)$/;
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/;
  const range = /^(\d+(?:\.\d+)?)\s*[-à]\s*(\d+(?:\.\d+)?)$/;
  let n: number | undefined;
  if (simple.test(cleaned)) {
    const v = Number(cleaned);
    if (Number.isFinite(v)) n = v;
  } else {
    const fMatch = fraction.exec(cleaned);
    if (fMatch && Number(fMatch[2]) !== 0) n = Number(fMatch[1]) / Number(fMatch[2]);
  }
  if (n === undefined) {
    const mMatch = mixed.exec(cleaned);
    if (mMatch && Number(mMatch[3]) !== 0) {
      n = Number(mMatch[1]) + Number(mMatch[2]) / Number(mMatch[3]);
    }
  }
  if (n === undefined) {
    const rMatch = range.exec(cleaned);
    if (rMatch) n = (Number(rMatch[1]) + Number(rMatch[2])) / 2;
  }
  return n === undefined ? undefined : n * scale;
};

/**
 * Parse une ligne d'ingrédient libre type "200 g de bœuf en morceaux" en
 * { name, amount, unit, amountValue }. Reste tolérant : si rien n'est
 * extractable, `name` est la ligne brute trimée.
 */
export const parseIngredientLine = (raw: string): ParsedIngredientLine | null => {
  if (!raw) return null;
  let s = normalizeSpaces(stripParens(replaceFractions(String(raw))));
  if (!s) return null;

  let amount: string | undefined;
  let unit: IngredientUnit | string | undefined;
  let scale = 1;

  for (const { re, unit: u } of DESCRIPTOR_PREFIXES) {
    if (re.test(s)) {
      s = s.replace(re, '');
      if (u) unit = u;
      break;
    }
  }

  const lowered = stripAccents(s).toLowerCase();
  const qMatch = lowered.match(QUANTITY_RE);
  if (qMatch) {
    amount = qMatch[0].trim();
    s = s.slice(qMatch[0].length);
  }

  if (!unit) {
    const loweredAfterQ = stripAccents(s).toLowerCase();
    for (const { re, unit: u, scale: sc } of UNIT_PATTERNS) {
      const m = loweredAfterQ.match(re);
      if (m) {
        unit = u;
        if (sc) scale = sc;
        s = s.slice(m[0].length);
        break;
      }
    }
    if (!unit) {
      const loweredAfterQ2 = stripAccents(s).toLowerCase();
      const free = loweredAfterQ2.match(FREE_UNITS_RE);
      if (free) {
        unit = free[0].trim().replace(/\.$/, '');
        s = s.slice(free[0].length);
      }
    }
  }

  s = normalizeSpaces(s);
  s = s.replace(PREPOSITION_RE, '');
  s = normalizeSpaces(s);

  const commaIdx = s.indexOf(',');
  if (commaIdx > 0) s = s.slice(0, commaIdx);

  s = normalizeSpaces(s);
  if (!s) {
    return amount || unit ? { name: String(raw).trim(), amount, unit } : null;
  }

  const name = s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1);
  const amountValue = parseAmountValue(amount, scale);
  return {
    name,
    ...(amount ? { amount } : {}),
    ...(unit ? { unit } : {}),
    ...(amountValue !== undefined ? { amountValue } : {}),
  };
};

const ADJECTIVES_TO_STRIP = [
  'hache', 'haches', 'hachee', 'hachees',
  'emince', 'eminces', 'emincee', 'eminces',
  'cuit', 'cuits', 'cuite', 'cuites',
  'cru', 'crus', 'crue', 'crues',
  'battu', 'battus', 'battue', 'battues',
  'frais', 'fraiche', 'fraiches',
  'moulu', 'moulus', 'moulue', 'moulues',
  'noir', 'noirs', 'noire', 'noires',
  'blanc', 'blancs', 'blanche', 'blanches',
  'rouge', 'rouges',
  'vert', 'verts', 'verte', 'vertes',
  'jaune', 'jaunes',
  'en morceaux', 'en cubes', 'en lamelles', 'en tranches', 'en rondelles',
  'en poudre',
  'tout usage',
];

const ADJECTIVES_RE = new RegExp(
  `\\s+(?:${ADJECTIVES_TO_STRIP.map((a) => a.replace(/\s/g, '\\s+')).join('|')})\\b`,
  'g',
);

/**
 * Forme normalisée d'un nom pour comparaison stricte avec le catalogue.
 * On retire les accents, les adjectifs/participes courants, le pluriel final,
 * et on ne garde que des lettres/chiffres + espaces.
 */
const normalizeForMatch = (raw: string): string => {
  let s = stripAccents(raw).toLowerCase();
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = ` ${s} `.replace(ADJECTIVES_RE, ' ');
  s = normalizeSpaces(s);
  if (s.length > 3 && s.endsWith('s')) s = s.slice(0, -1);
  return s.trim();
};

/**
 * Cherche le meilleur match dans le catalogue pour un nom donné.
 *
 * Stratégie volontairement conservatrice :
 *  1. Exact (après normalisation + retrait d'adjectifs + dépluralisation).
 *  2. Match d'alias déclaré.
 *  3. Match d'inclusion si le nom catalogue a >= 2 tokens et qu'ils sont
 *     tous présents dans le nom extrait (évite "Beurre" matchant
 *     "Beurre de cacahuète").
 * Retourne `null` si aucun match jugé sûr.
 */
export const findIngredientMatch = (
  rawName: string,
  catalog: Ingredient[],
): Ingredient | null => {
  if (!rawName) return null;
  const target = normalizeForMatch(rawName);
  if (!target) return null;

  let bestExact: Ingredient | null = null;
  let bestInclusion: Ingredient | null = null;

  for (const ing of catalog) {
    const candidates: string[] = [normalizeForMatch(ing.name)];
    (ing.aliases ?? []).forEach((a) => candidates.push(normalizeForMatch(a)));

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (candidate === target) {
        if (!bestExact) bestExact = ing;
        break;
      }
      const tokens = candidate.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        const targetTokens = new Set(target.split(/\s+/));
        const allIn = tokens.every((t) => targetTokens.has(t));
        if (allIn && !bestInclusion) bestInclusion = ing;
      }
    }
  }

  return bestExact ?? bestInclusion;
};

/**
 * Convertit la quantité depuis l'unité du parse vers la `defaultUnit` du
 * catalogue, quand la conversion est triviale (mêmes unités, déjà mises à
 * l'échelle au moment du parse). Pour les unités non comptabilisables
 * (`piece`, `gousse`, etc.), on conserve l'unité libre telle quelle dans
 * `IngredientItem.unit`.
 */
const buildItemFromMatch = (
  parsed: ParsedIngredientLine,
  matched: Ingredient | null,
): IngredientItem => {
  const base: IngredientItem = { name: parsed.name };
  if (parsed.amount) base.amount = parsed.amount;
  if (parsed.unit) base.unit = parsed.unit as string;
  if (parsed.amountValue !== undefined) base.amountValue = parsed.amountValue;

  if (matched) {
    base.ingredientId = matched.id;
    // On NE remplace PAS le `name` par celui du catalogue : le texte parsé
    // reflète mieux la version de l'ingrédient utilisée dans la recette
    // (ex. « Bœuf en morceaux » plutôt que le canonique « Bœuf haché »).
    if (!base.unit && matched.defaultUnit) base.unit = matched.defaultUnit;
  }
  return base;
};

/**
 * Produit la liste enrichie d'`IngredientItem` pour une recette, en
 * fusionnant l'éventuel `ingredientsDetailed` existant avec un parse à la
 * volée des chaînes legacy `ingredients`.
 *
 * Règles :
 *  - Si `detailed` est non vide, on l'utilise comme base (un item par entrée)
 *    et on tente le match catalogue par nom pour ceux qui n'ont pas encore
 *    d'`ingredientId`.
 *  - Sinon on parse `fallbackStrings`, une ligne = un item.
 *
 * Cette fonction est pure : elle ne touche pas à Firestore. La persistance
 * se fait quand l'utilisateur sauvegarde la recette dans `CreateRecipeScreen`.
 */
export const enrichIngredientsForRecipe = (
  detailed: IngredientItem[] | undefined,
  fallbackStrings: string[] | undefined,
  catalog: Ingredient[] | undefined,
): IngredientItem[] => {
  const cat = catalog ?? [];

  if (detailed && detailed.length > 0) {
    return detailed.map((item) => {
      if (item.ingredientId) return item;
      const matched = findIngredientMatch(item.name, cat);
      if (!matched) return item;
      return {
        ...item,
        ingredientId: matched.id,
        unit: item.unit ?? matched.defaultUnit,
      };
    });
  }

  if (!fallbackStrings?.length) return [];

  return fallbackStrings
    .map((raw) => {
      const parsed = parseIngredientLine(raw);
      if (!parsed) return null;
      const matched = findIngredientMatch(parsed.name, cat);
      return buildItemFromMatch(parsed, matched);
    })
    .filter((v): v is IngredientItem => !!v);
};
