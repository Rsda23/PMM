/**
 * Génère un brouillon de catalogue d'ingrédients à partir des recettes
 * actuellement en base.
 *
 * - Lit toute la collection `recipes` via l'Admin SDK
 * - Parse chaque ligne d'ingrédient (string libre type "500 g de bœuf haché")
 *   pour en extraire un nom canonique (sans quantité ni unité)
 * - Dédoublonne par slug (NFD + lowercase + a-z0-9 + tirets)
 * - Pour chaque slug, agrège : occurrences, exemples bruts, unités vues
 * - Écrit `data/ingredients-catalog.draft.json` (trié par fréquence desc)
 *
 * Ce fichier est un BROUILLON à reviewer/curer manuellement avant le seed
 * Firestore (cf. scripts/seed-ingredients-catalog.mjs).
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
const outputDir = path.join(projectRoot, 'data');
const outputPath = path.join(outputDir, 'ingredients-catalog.draft.json');

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
const readEnv = (key) => process.env[key] || envFromFile[key] || '';

const serviceAccountPath = readEnv('FIREBASE_SERVICE_ACCOUNT_PATH');
if (!serviceAccountPath) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_PATH in .env (path to service account JSON).');
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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId,
});
const db = admin.firestore();

// --- Parsing helpers --------------------------------------------------------

const UNICODE_FRACTIONS = {
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

const replaceFractions = (s) =>
  s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (ch) => ` ${UNICODE_FRACTIONS[ch]} `);

const stripParens = (s) => s.replace(/\([^)]*\)/g, ' ');

const normalizeWhitespace = (s) => s.replace(/\s+/g, ' ').trim();

const QUANTITY_RE = /^\s*(\d+([.,]\d+)?(\s*[\/\-à]\s*\d+([.,]\d+)?)?|\d+\s+\d+\/\d+)\s*/i;

const UNITS = [
  'kg', 'kilogrammes?', 'kilo(s)?',
  'g\\.?', 'grammes?',
  'mg', 'milligrammes?',
  'l\\.?', 'litres?',
  'cl', 'centilitres?',
  'ml', 'millilitres?',
  'cuillerees? a soupe', 'cuillerees? a cafe',
  'cuilleres? a soupe', 'cuilleres? a cafe',
  'cuillere?s? a soupe', 'cuillere?s? a cafe',
  'c\\.?\\s*a\\.?\\s*s\\.?', 'c\\.?\\s*a\\.?\\s*c\\.?',
  'cs', 'cc',
  'pincees?',
  'gousses?',
  'tranches?',
  'morceaux?', 'morceau',
  'tasses?',
  'bols?',
  'verres?',
  'boites?', 'boite',
  'sachets?',
  'paquets?',
  'feuilles?',
  'brins?',
  'bouquets?',
  'tetes?',
  'branches?',
  'noix',
  'kg', 'g', 'l', 'cl', 'ml',
];
const UNIT_RE = new RegExp(`^\\s*(?:${UNITS.join('|')})\\b\\.?\\s*`, 'i');

const PREP_RE = /^\s*(?:de\s+la|de\s+l['’]|du\s+|des\s+|de\s+|d['’])\s*/i;

const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const slugify = (s) =>
  stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Sépare une ligne d'ingrédient en { quantity, unit, name }.
 * On reste tolérant : si on n'arrive pas à parser, name = ligne brute (cleanée).
 */
const parseIngredientLine = (raw) => {
  let s = normalizeWhitespace(stripParens(replaceFractions(String(raw || ''))));
  if (!s) return null;

  let quantity = null;
  let unit = null;

  const lowered = stripAccents(s).toLowerCase();

  const qMatch = lowered.match(QUANTITY_RE);
  if (qMatch) {
    quantity = qMatch[0].trim();
    s = s.slice(qMatch[0].length);
  }

  const loweredAfterQ = stripAccents(s).toLowerCase();
  const uMatch = loweredAfterQ.match(UNIT_RE);
  if (uMatch) {
    unit = uMatch[0].trim().replace(/\.$/, '');
    s = s.slice(uMatch[0].length);
  }

  s = s.replace(PREP_RE, '');
  s = normalizeWhitespace(s);

  // On retire les virgules de qualification ("oignon, émincé")
  const commaIdx = s.indexOf(',');
  if (commaIdx > 0) s = s.slice(0, commaIdx);

  s = normalizeWhitespace(s);
  if (!s) return null;

  // Capitaliser la première lettre pour un rendu lisible
  const name = s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1);

  return { quantity, unit, name };
};

const inferDefaultUnitFromOccurrences = (unitCounts) => {
  const entries = Object.entries(unitCounts).filter(([u]) => u);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0][0].toLowerCase();
  if (/^(g|kg|grammes?|kilo)/.test(top)) return 'g';
  if (/^(ml|cl|l|litres?|centilitres?|millilitres?)/.test(top)) return 'ml';
  if (/cuiller/.test(top) || /^cs$/i.test(top)) return 'cuillere_a_soupe';
  if (/^cc$/i.test(top) || /cafe/.test(top)) return 'cuillere_a_cafe';
  if (/pincee/.test(top)) return 'pincee';
  return 'piece';
};

// --- Main -------------------------------------------------------------------

const main = async () => {
  console.log('Reading recipes from Firestore...');
  const snap = await db.collection('recipes').get();
  console.log(`Found ${snap.size} recipes.`);

  /** @type {Map<string, { name: string, count: number, unitCounts: Record<string, number>, examples: Set<string>, recipeIds: Set<string> }>} */
  const bySlug = new Map();

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const recipeId = docSnap.id;
    const detailed = Array.isArray(data.ingredientsDetailed) ? data.ingredientsDetailed : [];
    const flat = Array.isArray(data.ingredients) ? data.ingredients : [];

    // Priorité aux ingredientsDetailed quand ils existent (déjà structurés)
    if (detailed.length) {
      detailed.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const rawName = typeof item.name === 'string' ? item.name : '';
        const parsed = parseIngredientLine(rawName);
        if (!parsed) return;
        const slug = slugify(parsed.name);
        if (!slug) return;
        const unit = typeof item.unit === 'string' ? item.unit : null;
        const existing = bySlug.get(slug) ?? {
          name: parsed.name,
          count: 0,
          unitCounts: {},
          examples: new Set(),
          recipeIds: new Set(),
        };
        existing.count += 1;
        if (unit) existing.unitCounts[unit] = (existing.unitCounts[unit] || 0) + 1;
        existing.examples.add(rawName.trim());
        existing.recipeIds.add(recipeId);
        bySlug.set(slug, existing);
      });
      return;
    }

    flat.forEach((rawLine) => {
      const parsed = parseIngredientLine(rawLine);
      if (!parsed) return;
      const slug = slugify(parsed.name);
      if (!slug) return;
      const existing = bySlug.get(slug) ?? {
        name: parsed.name,
        count: 0,
        unitCounts: {},
        examples: new Set(),
        recipeIds: new Set(),
      };
      existing.count += 1;
      if (parsed.unit) existing.unitCounts[parsed.unit] = (existing.unitCounts[parsed.unit] || 0) + 1;
      existing.examples.add(String(rawLine).trim());
      existing.recipeIds.add(recipeId);
      bySlug.set(slug, existing);
    });
  });

  const entries = Array.from(bySlug.entries())
    .map(([slug, info]) => ({
      id: slug,
      name: info.name,
      suggestedDefaultUnit: inferDefaultUnitFromOccurrences(info.unitCounts),
      occurrences: info.count,
      recipeCount: info.recipeIds.size,
      sampleUnits: info.unitCounts,
      examples: Array.from(info.examples).slice(0, 5),
      // À compléter manuellement :
      category: null,
      defaultUnit: null,
      kcalPer100: null,
      proteinPer100: null,
      carbsPer100: null,
      fatsPer100: null,
      aliases: [],
      tags: [],
      allergens: [],
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2), 'utf8');

  console.log(`Wrote ${entries.length} unique ingredient slugs to:\n  ${outputPath}`);
  console.log('\nNext steps:');
  console.log('  1. Open the file and review it (fusion of duplicates, fix typos, set `category` and `defaultUnit`).');
  console.log('  2. Rename it to data/ingredients-catalog.json once it is clean.');
  console.log('  3. Run `npm run seed:ingredients` to push it to Firestore.');
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Extraction failed:', err);
    process.exit(1);
  });
