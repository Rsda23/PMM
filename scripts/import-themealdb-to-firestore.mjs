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
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
};

const envFromFile = readEnvFile(envPath);
const readEnv = (key) => process.env[key] || envFromFile[key] || '';

const serviceAccountPath = readEnv('FIREBASE_SERVICE_ACCOUNT_PATH');
if (!serviceAccountPath) {
  console.error(
    'Missing FIREBASE_SERVICE_ACCOUNT_PATH in .env (path to service account JSON).',
  );
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
const recipesCollection = db.collection('recipes');
const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeTag = (raw) => normalizeText(raw).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'autre';

const splitInstructions = (raw) =>
  String(raw || '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const extractIngredients = (meal) => {
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const ingredient = String(meal[`strIngredient${i}`] || '').trim();
    const measure = String(meal[`strMeasure${i}`] || '').trim();
    if (!ingredient) continue;
    ingredients.push(measure ? `${measure} ${ingredient}`.trim() : ingredient);
  }
  return ingredients;
};

const estimateCalories = (meal) => {
  const title = normalizeText(meal.strMeal);
  if (title.includes('salad') || title.includes('soup')) return 320;
  if (title.includes('beef') || title.includes('pasta') || title.includes('burger')) return 620;
  if (title.includes('fish') || title.includes('chicken')) return 460;
  return 430;
};

const inferDifficulty = (instructions) => {
  if (instructions.length >= 9) return 'Moyen';
  if (instructions.length >= 5) return 'Facile';
  return 'Rapide';
};

const inferObjectiveTags = (meal) => {
  const haystack = [
    normalizeText(meal.strMeal),
    normalizeText(meal.strCategory),
    normalizeText(meal.strArea),
    normalizeText(meal.strTags),
    normalizeText(meal.strInstructions),
  ].join(' ');

  const tags = [];
  if (/(salad|vegetable|vegan|light|healthy)/.test(haystack)) tags.push('perte_poids');
  if (/(beef|pasta|rice|protein|chicken)/.test(haystack)) tags.push('prise_masse');
  if (/(soup|fish|seafood|breakfast|egg)/.test(haystack)) tags.push('equilibre');
  return tags.length ? tags : ['equilibre'];
};

const mapMealToFirestoreDoc = (meal) => {
  const instructions = splitInstructions(meal.strInstructions);
  const sourceTags = [
    meal.strCategory,
    meal.strArea,
    ...(String(meal.strTags || '').split(',').map((v) => v.trim()).filter(Boolean)),
  ]
    .filter(Boolean)
    .map(normalizeTag);

  const tags = Array.from(new Set([...sourceTags, ...inferObjectiveTags(meal)]));
  const ratingSeed = Number.parseInt(String(meal.idMeal).slice(-1), 10);
  const rating = Number.isNaN(ratingSeed) ? 4.5 : Number((4.4 + (ratingSeed % 6) * 0.1).toFixed(1));

  return {
    title: String(meal.strMeal || '').trim() || 'Recette',
    name: String(meal.strMeal || '').trim() || 'Recette',
    calories: estimateCalories(meal),
    tags,
    ingredients: extractIngredients(meal),
    instructions: instructions.length ? instructions : [],
    image: String(meal.strMealThumb || '').trim() || null,
    createdBy: null,
    difficulty: inferDifficulty(instructions),
    rating,
    source: 'themealdb',
    sourceId: String(meal.idMeal),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  return res.json();
};

const getAllMealIds = async () => {
  const categoriesPayload = await fetchJson(`${THEMEALDB_BASE_URL}/categories.php`);
  const categories = Array.isArray(categoriesPayload.categories) ? categoriesPayload.categories : [];
  const ids = new Set();

  for (const cat of categories) {
    const catName = encodeURIComponent(cat.strCategory);
    const payload = await fetchJson(`${THEMEALDB_BASE_URL}/filter.php?c=${catName}`);
    const meals = Array.isArray(payload.meals) ? payload.meals : [];
    meals.forEach((meal) => ids.add(String(meal.idMeal)));
    await sleep(80);
  }

  return Array.from(ids);
};

const fetchMealDetails = async (ids, concurrency = 8) => {
  const results = [];
  let index = 0;

  const worker = async () => {
    while (index < ids.length) {
      const current = ids[index];
      index += 1;
      try {
        const payload = await fetchJson(`${THEMEALDB_BASE_URL}/lookup.php?i=${encodeURIComponent(current)}`);
        const meal = Array.isArray(payload.meals) ? payload.meals[0] : null;
        if (meal) results.push(meal);
      } catch (error) {
        console.warn(`Lookup failed for meal ${current}:`, error.message);
      }
      await sleep(60);
    }
  };

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
};

const loadExistingSourceIds = async () => {
  const existing = new Set();
  const snap = await recipesCollection.where('source', '==', 'themealdb').get();
  snap.forEach((docSnap) => {
    const sourceId = docSnap.get('sourceId');
    if (sourceId) existing.add(String(sourceId));
  });
  return existing;
};

const writeInBatches = async (docs, batchSize = 400) => {
  let written = 0;
  for (let i = 0; i < docs.length; i += batchSize) {
    const slice = docs.slice(i, i + batchSize);
    const batch = db.batch();
    slice.forEach((docData) => {
      const docRef = recipesCollection.doc();
      batch.set(docRef, docData);
    });
    await batch.commit();
    written += slice.length;
    console.log(`Committed ${written}/${docs.length}`);
  }
};

const main = async () => {
  console.log('Starting TheMealDB import...');
  const allIds = await getAllMealIds();
  console.log(`Fetched ${allIds.length} meal ids from TheMealDB categories.`);

  const allMeals = await fetchMealDetails(allIds, 8);
  console.log(`Fetched details for ${allMeals.length} meals.`);

  const existingSourceIds = await loadExistingSourceIds();
  console.log(`Found ${existingSourceIds.size} existing TheMealDB recipes in Firestore.`);

  const docsToInsert = allMeals
    .filter((meal) => !existingSourceIds.has(String(meal.idMeal)))
    .map(mapMealToFirestoreDoc);

  if (!docsToInsert.length) {
    console.log('Nothing to import. Firestore is already up to date for TheMealDB.');
    return;
  }

  await writeInBatches(docsToInsert, 400);
  console.log(`Import completed. Inserted ${docsToInsert.length} recipes into "recipes".`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
