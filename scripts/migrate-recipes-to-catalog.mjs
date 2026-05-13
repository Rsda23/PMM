/**
 * Migre les recettes existantes vers le pattern "référence + dénormalisation"
 * lié au catalogue d'ingrédients (`ingredients/*`).
 *
 * Pour chaque recette :
 *  - Si `ingredientsDetailed` existe ET que toutes les entrées ont déjà un
 *    `ingredientId` → on saute (déjà migrée).
 *  - Sinon on parse chaque ligne du legacy `ingredients[]` (texte libre),
 *    on tente un match contre le catalogue Firestore, et on écrit
 *    `ingredientsDetailed` avec { name, amount?, unit?, amountValue?, ingredientId? }.
 *
 * Le champ legacy `ingredients[]` est conservé pour rétro-compatibilité.
 * Script idempotent : peut être relancé sans problème.
 *
 * Port en JS du parser TypeScript `src/utils/ingredientParsing.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) return acc;
    acc[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    return acc;
  }, {});
};
const envFromFile = readEnvFile(envPath);
const readEnv = (k) => process.env[k] || envFromFile[k] || '';

const serviceAccountPath = readEnv('FIREBASE_SERVICE_ACCOUNT_PATH');
if (!serviceAccountPath) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_PATH in .env.');
  process.exit(1);
}
const resolvedServiceAccountPath = path.isAbsolute(serviceAccountPath)
  ? serviceAccountPath
  : path.resolve(projectRoot, serviceAccountPath);
if (!fs.existsSync(resolvedServiceAccountPath)) {
  console.error(`Service account file not found: ${resolvedServiceAccountPath}`);
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(resolvedServiceAccountPath, 'utf8'));
const projectId = readEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID') || serviceAccount.project_id;

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
const db = admin.firestore();

// ----------------------------------------------------------------------------
// Parsing helpers (port de src/utils/ingredientParsing.ts)
// ----------------------------------------------------------------------------

const UNICODE_FRACTIONS = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
  '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const replaceFractions = (s) =>
  s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (ch) => ` ${UNICODE_FRACTIONS[ch]} `);
const stripParens = (s) => s.replace(/\([^)]*\)/g, ' ');
const stripAccents = (s) =>
  s
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'Oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const normalizeSpaces = (s) => s.replace(/\s+/g, ' ').trim();

const QUANTITY_RE =
  /^\s*(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+([.,]\d+)?(\s*[-à]\s*\d+([.,]\d+)?)?)\s*/i;

const UNIT_PATTERNS = [
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

const DESCRIPTOR_PREFIXES = [
  { re: /^pincees?\s+/i, unit: 'pincee' },
  { re: /^quelques\s+gouttes?\s+(?:de\s+|d['’])/i },
  { re: /^quelques\s+/i },
  { re: /^un\s+peu\s+(?:de\s+|d['’])/i },
];

const parseAmountValue = (raw, scale = 1) => {
  if (!raw) return undefined;
  const cleaned = String(raw).replace(',', '.').trim();
  const simple = /^\d+(\.\d+)?$/;
  const fraction = /^(\d+)\s*\/\s*(\d+)$/;
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/;
  const range = /^(\d+(?:\.\d+)?)\s*[-à]\s*(\d+(?:\.\d+)?)$/;
  let n;
  if (simple.test(cleaned)) {
    const v = Number(cleaned);
    if (Number.isFinite(v)) n = v;
  } else {
    const fm = fraction.exec(cleaned);
    if (fm && Number(fm[2]) !== 0) n = Number(fm[1]) / Number(fm[2]);
  }
  if (n === undefined) {
    const mm = mixed.exec(cleaned);
    if (mm && Number(mm[3]) !== 0) n = Number(mm[1]) + Number(mm[2]) / Number(mm[3]);
  }
  if (n === undefined) {
    const rm = range.exec(cleaned);
    if (rm) n = (Number(rm[1]) + Number(rm[2])) / 2;
  }
  return n === undefined ? undefined : n * scale;
};

const parseIngredientLine = (raw) => {
  if (!raw) return null;
  let s = normalizeSpaces(stripParens(replaceFractions(String(raw))));
  if (!s) return null;
  let amount, unit;
  let scale = 1;

  for (const { re, unit: u } of DESCRIPTOR_PREFIXES) {
    if (re.test(s)) {
      s = s.replace(re, '');
      if (u) unit = u;
      break;
    }
  }

  const lowered = stripAccents(s).toLowerCase();
  const qm = lowered.match(QUANTITY_RE);
  if (qm) {
    amount = qm[0].trim();
    s = s.slice(qm[0].length);
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
const normalizeForMatch = (raw) => {
  let s = stripAccents(String(raw || '')).toLowerCase();
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = ` ${s} `.replace(ADJECTIVES_RE, ' ');
  s = normalizeSpaces(s);
  if (s.length > 3 && s.endsWith('s')) s = s.slice(0, -1);
  return s.trim();
};

const findIngredientMatch = (rawName, catalog) => {
  if (!rawName) return null;
  const target = normalizeForMatch(rawName);
  if (!target) return null;
  let bestExact = null;
  let bestInclusion = null;
  for (const ing of catalog) {
    const candidates = [normalizeForMatch(ing.name)];
    (ing.aliases || []).forEach((a) => candidates.push(normalizeForMatch(a)));
    for (const c of candidates) {
      if (!c) continue;
      if (c === target) {
        if (!bestExact) bestExact = ing;
        break;
      }
      const tokens = c.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        const targetTokens = new Set(target.split(/\s+/));
        if (tokens.every((t) => targetTokens.has(t)) && !bestInclusion) bestInclusion = ing;
      }
    }
  }
  return bestExact || bestInclusion;
};

const buildItemFromMatch = (parsed, matched) => {
  const base = { name: parsed.name };
  if (parsed.amount) base.amount = parsed.amount;
  if (parsed.unit) base.unit = parsed.unit;
  if (parsed.amountValue !== undefined) base.amountValue = parsed.amountValue;
  if (matched) {
    base.ingredientId = matched.id;
    if (!base.unit && matched.defaultUnit) base.unit = matched.defaultUnit;
  }
  return base;
};

// ----------------------------------------------------------------------------
// Migration logic
// ----------------------------------------------------------------------------

const isAlreadyMigrated = (detailed) =>
  Array.isArray(detailed) &&
  detailed.length > 0 &&
  detailed.every((it) => it && typeof it === 'object' && typeof it.ingredientId === 'string' && it.ingredientId);

const sanitizeForFirestore = (item) => {
  const out = { name: String(item.name || '').trim() };
  if (!out.name) return null;
  if (item.amount) out.amount = String(item.amount).trim();
  if (item.unit) out.unit = String(item.unit).trim();
  if (item.ingredientId) out.ingredientId = String(item.ingredientId);
  if (typeof item.amountValue === 'number' && Number.isFinite(item.amountValue)) {
    out.amountValue = item.amountValue;
  }
  return out;
};

const loadCatalog = async () => {
  const snap = await db.collection('ingredients').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const stats = {
  total: 0,
  alreadyMigrated: 0,
  migrated: 0,
  matchedItems: 0,
  totalItems: 0,
  errors: 0,
};

const FORCE_REPARSE = process.argv.includes('--reparse');

const migrateRecipe = async (docSnap, catalog) => {
  stats.total += 1;
  const data = docSnap.data();
  const existingDetailed = Array.isArray(data.ingredientsDetailed) ? data.ingredientsDetailed : [];
  const legacy = Array.isArray(data.ingredients) ? data.ingredients : [];

  if (isAlreadyMigrated(existingDetailed) && !FORCE_REPARSE) {
    stats.alreadyMigrated += 1;
    return;
  }

  // On préfère reparser depuis le legacy `ingredients[]` quand il existe : c'est
  // la source canonique. L'`ingredientsDetailed` éventuellement présent peut
  // contenir des noms mal extraits par un run précédent.
  let detailed;
  if (legacy.length > 0) {
    detailed = legacy
      .map((raw) => {
        const parsed = parseIngredientLine(raw);
        if (!parsed) return null;
        const matched = findIngredientMatch(parsed.name, catalog);
        return buildItemFromMatch(parsed, matched);
      })
      .filter(Boolean);
  } else if (existingDetailed.length > 0) {
    detailed = existingDetailed.map((item) => {
      if (item && item.ingredientId) return item;
      const matched = findIngredientMatch(item?.name || '', catalog);
      if (!matched) return item;
      return {
        ...item,
        ingredientId: matched.id,
        unit: item.unit || matched.defaultUnit,
      };
    });
  } else {
    return;
  }

  const sanitized = detailed.map(sanitizeForFirestore).filter(Boolean);
  stats.totalItems += sanitized.length;
  stats.matchedItems += sanitized.filter((it) => it.ingredientId).length;

  await docSnap.ref.update({
    ingredientsDetailed: sanitized,
    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  stats.migrated += 1;
};

const main = async () => {
  console.log('Loading catalog...');
  const catalog = await loadCatalog();
  console.log(`Catalog: ${catalog.length} ingredients.`);

  console.log('Loading recipes...');
  const snap = await db.collection('recipes').get();
  console.log(`Recipes: ${snap.size}.`);

  // Petite concurrence pour aller plus vite sans saturer Firestore.
  const CONCURRENCY = 8;
  const docs = snap.docs;
  let index = 0;
  const worker = async () => {
    while (index < docs.length) {
      const i = index++;
      try {
        await migrateRecipe(docs[i], catalog);
      } catch (err) {
        stats.errors += 1;
        console.warn(`Failed for recipe ${docs[i].id}:`, err.message || err);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log('\n--- Migration summary ---');
  console.log(`Total recipes seen:    ${stats.total}`);
  console.log(`Already migrated:      ${stats.alreadyMigrated}`);
  console.log(`Newly migrated:        ${stats.migrated}`);
  console.log(`Items matched/total:   ${stats.matchedItems}/${stats.totalItems}`);
  if (stats.totalItems > 0) {
    const pct = ((stats.matchedItems / stats.totalItems) * 100).toFixed(1);
    console.log(`Catalog coverage:      ${pct}%`);
  }
  console.log(`Errors:                ${stats.errors}`);
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
