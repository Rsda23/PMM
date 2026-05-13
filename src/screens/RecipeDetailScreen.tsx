import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import type { RootTabParamList } from '../components/Navbar';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { auth } from '../services/firebase/firebaseConfig';
import { deleteRecipe, getRecipeById, type Recipe } from '../services/api/recipesApi';
import { getAllIngredients, type Ingredient } from '../services/api/ingredientsApi';
import { getUserProfile } from '../services/api/userProfileApi';
import { useUserStore } from '../store/userStore';
import { computeMacrosFromIngredients, isUsableEstimate } from '../utils/nutrition';
import { enrichIngredientsForRecipe } from '../utils/ingredientParsing';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeDetail'>;
const iconArrowBack = require('../../assets/figma/profil/arrow-back.png');
const iconTime = require('../../assets/figma/recette/icon-time.png');
const iconDifficulty = require('../../assets/figma/recette/icon-difficulty.png');
const iconStar = require('../../assets/figma/recette/icon-star.png');
const iconStarWhite = require('../../assets/figma/recette/star-white.png');
const iconEdit = require('../../assets/figma/profil/icon-edit.png');
const iconTrash = require('../../assets/figma/home/icon-trash.png');
const MACRO_REFERENCE_GRAMS = {
  protein: 50,
  carbs: 260,
  fats: 70,
} as const;
const TAG_LABELS: Record<string, string> = {
  perte_poids: 'Perte de poids',
  prise_masse: 'Prise de masse',
  equilibre: 'Équilibré',
  vegetarien: 'Végétarien',
  riche_proteine: 'Protéines',
  rapide: 'Rapide',
  sans_gluten: 'Sans Gluten',
  faible_carb: 'Faible Carb',
  petit_dej: 'Petit-Dej',
  energie: 'Énergie',
};

const RecipeDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const source = route.params.source;
  const [recipe, setRecipe] = useState<Recipe>(() => {
    const { source: _s, ...rest } = route.params;
    return rest as Recipe;
  });

  const {
    id,
    title,
    calories,
    protein,
    carbs,
    fats,
    tags,
    ingredients,
    ingredientsDetailed,
    instructions,
    image,
    createdBy,
    difficulty,
    rating,
    prepMinutes,
  } = recipe;

  const isOwner = !!auth.currentUser && auth.currentUser.uid === createdBy;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getRecipeById(route.params.id).then((fresh) => {
        if (cancelled || !fresh) return;
        setRecipe(fresh);
      });
      return () => {
        cancelled = true;
      };
    }, [route.params.id]),
  );
  const removeFavorite = useUserStore((state) => state.removeFavorite);
  const toggleFavorite = useUserStore((state) => state.toggleFavorite);
  const favoriteRecipeIds = useUserStore((state) => state.favoriteRecipeIds);
  const isFavorite = favoriteRecipeIds.includes(id);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(auth.currentUser?.photoURL ?? null);

  const displayPrepMinutes = useMemo(
    () => (typeof prepMinutes === 'number' && prepMinutes > 0 ? Math.round(prepMinutes) : 15),
    [prepMinutes],
  );
  const macroCards = useMemo(() => {
    const proteinG = Math.max(Math.round(protein ?? 0), 0);
    const carbsG = Math.max(Math.round(carbs ?? 0), 0);
    const fatsG = Math.max(Math.round(fats ?? 0), 0);

    return [
      {
        key: 'protein',
        label: 'Protéines',
        value: proteinG,
        color: '#005B15',
        max: MACRO_REFERENCE_GRAMS.protein,
      },
      {
        key: 'carbs',
        label: 'Glucides',
        value: carbsG,
        color: '#004D99',
        max: MACRO_REFERENCE_GRAMS.carbs,
      },
      {
        key: 'fats',
        label: 'Lipides',
        value: fatsG,
        color: '#A83900',
        max: MACRO_REFERENCE_GRAMS.fats,
      },
    ].map((item) => ({
      ...item,
      ratio: Math.min(item.value / item.max, 1),
    }));
  }, [protein, carbs, fats]);
  const ingredientRows = useMemo(
    () => {
      if (ingredientsDetailed?.length) {
        return ingredientsDetailed.map((item) => ({
          name: item.name,
          portion: [item.amount, item.unit].filter(Boolean).join(' ') || '-',
        }));
      }
      return (ingredients ?? []).map((raw) => {
        const value = String(raw ?? '').trim();
        const separators = [' - ', ' : ', ' – ', ' — ', ', '];
        for (const sep of separators) {
          const idx = value.lastIndexOf(sep);
          if (idx > 0) {
            const left = value.slice(0, idx).trim();
            const right = value.slice(idx + sep.length).trim();
            if (left && right) {
              return { name: left, portion: right };
            }
          }
        }
        return { name: value, portion: '-' };
      });
    },
    [ingredients, ingredientsDetailed],
  );
  const avatarInitial = useMemo(() => {
    const raw = (auth.currentUser?.displayName ?? auth.currentUser?.email ?? '').trim();
    if (!raw) return '?';
    return (raw.includes('@') ? raw.split('@')[0] : raw).charAt(0).toUpperCase();
  }, [auth.currentUser?.displayName, auth.currentUser?.email]);

  useEffect(() => {
    getUserProfile().then((profile) => {
      setAvatarUrl(profile?.avatarUrl ?? auth.currentUser?.photoURL ?? null);
    });
  }, []);

  const [catalogIngredients, setCatalogIngredients] = useState<Ingredient[]>([]);
  useEffect(() => {
    getAllIngredients()
      .then(setCatalogIngredients)
      .catch(() => {
        // silencieux : sans catalogue on n'affiche simplement pas l'estimation
      });
  }, []);

  /**
   * Estimation des macros depuis le catalogue : on enrichit les ingrédients
   * (matching catalogue à la lecture, sans rien écrire en base), puis on
   * additionne les contributions des items comptabilisables.
   */
  const macroEstimate = useMemo(() => {
    if (catalogIngredients.length === 0) return null;
    const enriched = enrichIngredientsForRecipe(ingredientsDetailed, ingredients, catalogIngredients);
    return computeMacrosFromIngredients(enriched, catalogIngredients);
  }, [ingredientsDetailed, ingredients, catalogIngredients]);

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la recette',
      `Supprimer « ${title} » ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecipe(id);
              removeFavorite(id);
              navigation.goBack();
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Impossible de supprimer.';
              Alert.alert('Erreur', message);
            }
          },
        },
      ],
    );
  };

  const handleBack = () => {
    if (source === 'home') {
      const parent = navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
      parent?.navigate('Recettes', { screen: 'Recipes' });
      parent?.navigate('Accueil', { reTapToken: Date.now() });
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleBack} activeOpacity={0.75}>
            <Image source={iconArrowBack} style={styles.topIcon} />
          </TouchableOpacity>
          <View style={styles.topRight}>
            {isOwner && (
              <>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.navigate('CreateRecipe', { recipe })}
                  activeOpacity={0.8}
                >
                  <Image source={iconEdit} style={[styles.topIcon, styles.topIconEdit]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnDanger]}
                  onPress={handleDelete}
                  activeOpacity={0.8}
                >
                  <Image source={iconTrash} style={[styles.topIcon, styles.topIconDanger]} />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => toggleFavorite(id)}
              activeOpacity={0.8}
            >
              <Image source={iconStarWhite} style={[styles.topIcon, isFavorite && styles.topIconFavorite]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => navigation.getParent()?.navigate('Profil' as never)}
              activeOpacity={0.8}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hero}>
          {image ? (
            <Image source={{ uri: image }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]} />
          )}
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaItem}>
                  <Image source={iconTime} style={styles.heroMetaIcon} />
                  <Text style={styles.heroMetaText}>{displayPrepMinutes} min</Text>
                </View>
                {!!difficulty?.trim() && (
                  <View style={styles.heroMetaItem}>
                    <Image source={iconDifficulty} style={styles.heroMetaIcon} />
                    <Text style={styles.heroMetaText}>{difficulty.trim()}</Text>
                  </View>
                )}
                {typeof rating === 'number' && !Number.isNaN(rating) && (
                  <View style={styles.heroMetaItem}>
                    <Image source={iconStar} style={styles.heroMetaIcon} />
                    <Text style={styles.heroMetaText}>{rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.heroTitle} numberOfLines={3}>
                {title}
              </Text>
              <Text style={styles.heroKcalText}>{calories} kcal / portion</Text>

            </View>
          </View>
        </View>

        {tags && tags.length > 0 && (
          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{TAG_LABELS[tag] ?? tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.macroGrid}>
          {macroCards.map((macro) => (
            <View key={macro.key} style={styles.macroCard}>
              <Text style={styles.macroLabel}>{macro.label}</Text>
              <Text style={[styles.macroValue, { color: macro.color }]}>{macro.value}g</Text>
              <View style={styles.macroTrack}>
                <View style={[styles.macroFill, { width: `${macro.ratio * 100}%`, backgroundColor: macro.color }]} />
              </View>
            </View>
          ))}
        </View>

        {macroEstimate && isUsableEstimate(macroEstimate) ? (
          <View style={styles.estimateCard}>
            <View style={styles.estimateHeader}>
              <Text style={styles.estimateTag}>Estimé depuis les ingrédients</Text>
              <Text style={styles.estimateCoverage}>
                {macroEstimate.linkedCount}/{macroEstimate.linkedCount + macroEstimate.uncountedCount}
              </Text>
            </View>
            <View style={styles.estimateRow}>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateItemLabel}>kcal</Text>
                <Text style={styles.estimateItemValue}>{macroEstimate.kcal}</Text>
              </View>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateItemLabel}>Prot.</Text>
                <Text style={styles.estimateItemValue}>{macroEstimate.protein}g</Text>
              </View>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateItemLabel}>Gluc.</Text>
                <Text style={styles.estimateItemValue}>{macroEstimate.carbs}g</Text>
              </View>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateItemLabel}>Lip.</Text>
                <Text style={styles.estimateItemValue}>{macroEstimate.fats}g</Text>
              </View>
            </View>
          </View>
        ) : null}

        {!!ingredients?.length && (
          <View style={styles.ingredientsCard}>
            <View style={styles.ingredientsHeader}>
              <Text style={styles.ingredientsTitle}>Ingrédients</Text>
              <View style={styles.ingredientsCountBadge}>
              <Text style={styles.ingredientsCountText}>Portions</Text>
              </View>
            </View>
            <View style={styles.ingredientsList}>
              {ingredientRows.map((item, index) => (
                <View key={`${id}-ing-${index}`} style={styles.ingredientRow}>
                  <Text style={styles.ingredientName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.ingredientPortion} numberOfLines={1}>
                    {item.portion}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!!instructions?.length && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Préparation</Text>
            <View style={styles.sectionList}>
              {instructions.map((step, index) => (
                <View key={`${id}-step-${index}`} style={styles.stepRow}>
                  <Text style={styles.stepIndexText}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.listText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: '#111827',
  },
  topIconFavorite: {
    tintColor: '#FACC15',
  },
  topIconEdit: {
    tintColor: '#004D99',
  },
  iconBtnDanger: {
    borderColor: 'rgba(186,26,26,0.15)',
    backgroundColor: '#FFF5F5',
  },
  topIconDanger: {
    tintColor: '#BA1A1A',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hero: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroContent: {
    gap: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroMetaIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    tintColor: 'rgba(255,255,255,0.95)',
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  tagChip: {
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagChipText: {
    fontSize: 10,
    color: '#424752',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    fontWeight: '500',
  },
  macroGrid: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroCard: {
    width: '31.5%',
    minHeight: 112,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.15)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    justifyContent: 'space-between',
  },
  macroLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#424752',
    fontWeight: '300',
  },
  macroValue: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '300',
    marginTop: 2,
    marginBottom: 6,
  },
  macroTrack: {
    height: 6,
    width: '100%',
    borderRadius: 999,
    backgroundColor: '#E2E2E2',
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 999,
    minWidth: 3,
  },
  estimateCard: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EEF7F0',
    borderWidth: 1,
    borderColor: '#CDE8D4',
    gap: 10,
  },
  estimateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  estimateTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2F6A3F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  estimateCoverage: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  estimateItem: {
    flex: 1,
    alignItems: 'center',
  },
  estimateItemLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  estimateItemValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  heroKcalText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: '600',
    marginTop: -2,
  },
  heroPlaceholder: {
    backgroundColor: '#D1D5DB',
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,85,255,0.1)',
  },
  avatarImg: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCard: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1C1C',
  },
  sectionList: {
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 7,
    backgroundColor: '#1565C0',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 2,
  },
  stepIndexText: {
    width: 24,
    marginTop: 1,
    color: '#004D99',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: '#2A2E37',
  },
  ingredientsCard: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.18)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ingredientsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1C1C',
    letterSpacing: -0.2,
  },
  ingredientsCountBadge: {
    minWidth: 28,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  ingredientsCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#424752',
  },
  ingredientsList: {
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F6F7F8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  ingredientName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#2A2E37',
    fontWeight: '500',
    marginRight: 10,
  },
  ingredientPortion: {
    fontSize: 13,
    lineHeight: 18,
    color: '#727783',
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 62,
  },
});

export default RecipeDetailScreen;

