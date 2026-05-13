/**
 * Pousse `data/ingredients-catalog.json` (version curée manuellement) vers
 * la collection Firestore `ingredients`.
 *
 * Chaque entrée du JSON est attendue avec au minimum :
 *   - id (slug, sert d'ID du document)
 *   - name (nom canonique)
 *
 * Tous les autres champs sont optionnels. Les ingrédients officiels sont
 * écrits avec `createdBy = null` ; les règles Firestore les rendent
 * lisibles par tous les users connectés et non modifiables côté client.
 *
 * Utilise `set(..., { merge: true })` => relancer le script met à jour les
 * documents existants sans écraser les éventuels champs ajoutés à la main.
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
const catalogPath = path.join(projectRoot, 'data', 'ingredients-catalog.json');

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
if (!fs.existsSync(catalogPath)) {
  console.error(`Catalog file not found: ${catalogPath}`);
  console.error('Run `npm run extract:ingredients` first, then curate and rename the draft.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedServiceAccountPath, 'utf8'));
const projectId = readEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID') || serviceAccount.project_id;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId,
});
const db = admin.firestore();
const ingredientsCollection = db.collection('ingredients');

const ALLOWED_UNITS = new Set([
  'g', 'ml', 'piece', 'cuillere_a_soupe', 'cuillere_a_cafe', 'pincee',
]);
const ALLOWED_CATEGORIES = new Set([
  'viande', 'poisson', 'oeuf_laitier', 'legume', 'fruit', 'feculent',
  'legumineuse', 'matiere_grasse', 'epice_aromate', 'sauce_condiment',
  'boisson', 'sucre_chocolat', 'autre',
]);

const STRIP_FIELDS = new Set([
  'suggestedDefaultUnit', 'occurrences', 'recipeCount', 'sampleUnits', 'examples',
]);

const sanitize = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!id || !name) return null;

  const payload = {
    name,
    createdBy: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (Array.isArray(entry.aliases) && entry.aliases.length) {
    payload.aliases = entry.aliases.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (entry.category && ALLOWED_CATEGORIES.has(entry.category)) {
    payload.category = entry.category;
  }
  if (entry.defaultUnit && ALLOWED_UNITS.has(entry.defaultUnit)) {
    payload.defaultUnit = entry.defaultUnit;
  }
  for (const key of ['kcalPer100', 'proteinPer100', 'carbsPer100', 'fatsPer100']) {
    if (typeof entry[key] === 'number' && Number.isFinite(entry[key])) {
      payload[key] = entry[key];
    }
  }
  if (Array.isArray(entry.tags) && entry.tags.length) {
    payload.tags = entry.tags.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(entry.allergens) && entry.allergens.length) {
    payload.allergens = entry.allergens.map(String).map((s) => s.trim()).filter(Boolean);
  }

  // Garde-fou : on retire silencieusement les champs purement d'aide à la curation
  for (const k of STRIP_FIELDS) delete entry[k];

  return { id, payload };
};

const main = async () => {
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(raw)) {
    console.error('Catalog file must contain a JSON array.');
    process.exit(1);
  }

  const cleaned = raw.map(sanitize).filter(Boolean);
  console.log(`Loaded ${cleaned.length}/${raw.length} valid ingredients from catalog.`);

  if (!cleaned.length) {
    console.warn('Nothing to seed.');
    return;
  }

  // Vérification anti-doublons d'id avant écriture
  const seen = new Set();
  const dupes = [];
  for (const { id } of cleaned) {
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  }
  if (dupes.length) {
    console.error(`Duplicate ids detected, fix the catalog first:\n  ${dupes.join('\n  ')}`);
    process.exit(1);
  }

  // Création initiale : on ajoute createdAt uniquement si le document n'existe pas
  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {
    const slice = cleaned.slice(i, i + BATCH_SIZE);
    const refs = slice.map(({ id }) => ingredientsCollection.doc(id));
    const snapshots = await db.getAll(...refs);

    const batch = db.batch();
    slice.forEach(({ id, payload }, idx) => {
      const snap = snapshots[idx];
      const body = { ...payload };
      if (!snap.exists) {
        body.createdAt = admin.firestore.FieldValue.serverTimestamp();
      }
      batch.set(ingredientsCollection.doc(id), body, { merge: true });
    });
    await batch.commit();
    written += slice.length;
    console.log(`Committed ${written}/${cleaned.length}`);
  }

  console.log(`Done. Seeded ${written} official ingredients into "ingredients".`);
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
