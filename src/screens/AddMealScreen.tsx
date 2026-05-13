import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuiviStackParamList } from '../navigation/SuiviStack';
import type { RootTabParamList } from '../components/Navbar';
import { getAllRecipes, type Recipe } from '../services/api/recipesApi';
import { addMealPlan, MEAL_TYPE_LABELS, type MealType } from '../services/api/mealPlansApi';
import { auth } from '../services/firebase/firebaseConfig';
import { getUserProfile } from '../services/api/userProfileApi';

type Props = NativeStackScreenProps<SuiviStackParamList, 'AddMeal'>;

type MealFilterType = 'all' | MealType;
const MEAL_CHIP_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};
const MEAL_FILTER_CHIP_LABELS: Record<MealFilterType, string> = {
  all: 'Tous',
  ...MEAL_CHIP_LABELS,
};
const MEAL_FILTER_ORDER: MealFilterType[] = ['all', 'breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_TYPE_TAG_ALIASES: Record<MealType, string[]> = {
  breakfast: ['breakfast', 'petit-dejeuner', 'petit déjeuner', 'matin'],
  lunch: ['lunch', 'dejeuner', 'déjeuner', 'midi'],
  dinner: ['dinner', 'souper', 'soir'],
  snack: ['snack', 'collation', 'encas', 'en-cas'],
};

const iconArrowBack = require('../../assets/figma/profil/arrow-back.png');
const iconSearch = require('../../assets/figma/navbar/tab-search.png');
const iconCheckWhite = require('../../assets/figma/suivi/icon-check-white.png');

const AddMealScreen: React.FC<Props> = ({ route, navigation }) => {
  const { date, mealType: initialMealType, source } = route.params;
  const targetMealType: MealType = initialMealType ?? 'lunch';
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMealFilter, setSelectedMealFilter] = useState<MealFilterType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(auth.currentUser?.photoURL ?? null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    Promise.all([getAllRecipes(), getUserProfile()])
      .then(([allRecipes, profile]) => {
        setRecipes(allRecipes);
        setAvatarUrl(profile?.avatarUrl ?? auth.currentUser?.photoURL ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const query = normalize(search);
    const selectedAliases =
      selectedMealFilter === 'all'
        ? []
        : MEAL_TYPE_TAG_ALIASES[selectedMealFilter].map(normalize);

    return recipes.filter((r) => {
      const normalizedTags = (r.tags ?? []).map(normalize);
      const hasMealTypeTag =
        selectedMealFilter === 'all'
          ? true
          : normalizedTags.some((tag) =>
              selectedAliases.some((alias) => tag.includes(alias) || alias.includes(tag)),
            );

      if (!hasMealTypeTag) return false;
      if (!query) return true;

      const titleMatch = normalize(r.title).includes(query);
      const tagMatch = normalizedTags.some((tag) => tag.includes(query));
      return titleMatch || tagMatch;
    });
  }, [recipes, search, selectedMealFilter]);

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => selectedIds.has(r.id)),
    [recipes, selectedIds],
  );

  const toggleRecipe = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasSelection = selectedIds.size > 0;
  const selectedCount = selectedRecipes.length;

  const dateText = useMemo(() => {
    const day = new Date(date);
    const formatted = day.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [date]);

  const headingTitle = useMemo(
    () => `Ajout au ${MEAL_CHIP_LABELS[targetMealType]}`,
    [targetMealType],
  );


  const avatarInitial = useMemo(() => {
    const raw = (auth.currentUser?.displayName ?? auth.currentUser?.email ?? '').trim();
    if (!raw) return '?';
    return (raw.includes('@') ? raw.split('@')[0] : raw).charAt(0).toUpperCase();
  }, [auth.currentUser?.displayName, auth.currentUser?.email]);

  const handleBack = () => {
    if (source === 'home') {
      navigation.getParent()?.dispatch(
        CommonActions.navigate({
          name: 'Accueil' as keyof RootTabParamList,
          params: { reTapToken: Date.now() },
        }),
      );
      return;
    }

    navigation.goBack();
  };

  const handleAddSelected = async () => {
    const toAdd = selectedRecipes;
    if (toAdd.length === 0) return;
    setSaving(true);
    try {
      const promises = toAdd.map((recipe) =>
        addMealPlan({
          date,
          mealType: targetMealType,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fats: recipe.fats,
        }),
      );
      await Promise.all(promises);
      handleBack();
    } catch (e) {
      console.warn('addMealPlan error:', e);
      Alert.alert('Erreur', 'Impossible d\'ajouter les repas.');
    } finally {
      setSaving(false);
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 320 && !showScrollTop) {
      setShowScrollTop(true);
    } else if (offsetY <= 320 && showScrollTop) {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1565c0" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <Image source={iconArrowBack} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Ajouter un repas</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarBtn}
          activeOpacity={0.8}
          onPress={() => navigation.getParent()?.navigate('Profil' as never)}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarInitial}>{avatarInitial}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, hasSelection && styles.containerWithFooter]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.dateLine}>{dateText}</Text>
        <Text style={styles.heading}>{headingTitle}</Text>

        <View style={styles.searchWrap}>
          <Image source={iconSearch} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une recette ou un ingrédient..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#727783"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mealTypeRow}
        >
          {MEAL_FILTER_ORDER.map((mt) => (
            <TouchableOpacity
              key={mt}
              style={[styles.mealTypeBtn, selectedMealFilter === mt && styles.mealTypeBtnActive]}
              onPress={() => setSelectedMealFilter(mt)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.mealTypeBtnText,
                  selectedMealFilter === mt && styles.mealTypeBtnTextActive,
                ]}
              >
                {MEAL_FILTER_CHIP_LABELS[mt]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recettes suggérées</Text>
        </View>

        {filtered.length === 0 ? (
          <Text style={styles.empty}>Aucune recette trouvée.</Text>
        ) : (
          filtered.map((recipe) => {
            const isSelected = selectedIds.has(recipe.id);
            return (
              <TouchableOpacity
                key={recipe.id}
                style={[styles.recipeRow, isSelected && styles.recipeRowSelected]}
                onPress={() => toggleRecipe(recipe.id)}
                disabled={saving}
                activeOpacity={0.85}
              >
                <View style={styles.recipeLeft}>
                  {recipe.image ? (
                    <Image source={{ uri: recipe.image }} style={styles.recipeThumb} />
                  ) : (
                    <View style={[styles.recipeThumb, styles.recipeThumbPlaceholder]} />
                  )}
                  <View style={styles.recipeTextWrap}>
                    <Text style={[styles.recipeTitle, isSelected && styles.recipeTitleSelected]} numberOfLines={1}>
                      {recipe.title}
                    </Text>
                    <Text style={styles.recipeMeta}>
                      {recipe.calories} kcal •{' '}
                      {recipe.prepMinutes != null && recipe.prepMinutes > 0
                        ? Math.round(recipe.prepMinutes)
                        : 15}{' '}
                      min
                    </Text>
                  </View>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && (
                    <Image source={iconCheckWhite} style={styles.checkIconImg} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

      </ScrollView>

      {showScrollTop && (
        <TouchableOpacity
          style={[styles.scrollTopButton, hasSelection && styles.scrollTopButtonWithFooter]}
          activeOpacity={0.9}
          onPress={scrollToTop}
        >
          <Text style={styles.scrollTopButtonText}>↑</Text>
        </TouchableOpacity>
      )}

      {hasSelection && (
        <View style={styles.footer}>
          <View style={styles.footerTop}>
            <Text style={styles.footerCount}>{selectedCount} recette{selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}</Text>
            <TouchableOpacity onPress={clearSelection} activeOpacity={0.8}>
              <Text style={styles.clearText}>Tout effacer</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.addSelectedButton, saving && styles.addSelectedButtonDisabled]}
            onPress={handleAddSelected}
            disabled={saving}
            activeOpacity={0.9}
          >
            <Text style={styles.addSelectedButtonText}>
              {saving
                ? 'Ajout en cours…'
                : `Ajouter ${selectedCount} recette(s)`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: '#111827',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.45,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0,85,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 22,
  },
  containerWithFooter: {
    paddingBottom: 160,
  },
  dateLine: {
    fontSize: 14,
    color: '#424752',
    letterSpacing: 0.35,
    marginBottom: -12,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: '#111827',
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 24,
  },
  mealTypeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#E8E8E8',
  },
  mealTypeBtnActive: {
    backgroundColor: '#FC6018',
  },
  mealTypeBtnText: {
    fontSize: 14,
    color: '#424752',
    fontWeight: '600',
  },
  mealTypeBtnTextActive: {
    color: '#531800',
  },
  searchWrap: {
    backgroundColor: '#E8E8E8',
    borderRadius: 12,
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#727783',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: '#18181B',
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1C1C',
    lineHeight: 38,
  },
  recipeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F3F3F3',
  },
  recipeRowSelected: {
    borderWidth: 1,
    borderColor: '#004D99',
  },
  recipeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  recipeThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  recipeThumbPlaceholder: {
    backgroundColor: '#D1D5DB',
  },
  recipeTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  recipeTitle: {
    fontSize: 16,
    color: '#1A1C1C',
    fontWeight: '700',
  },
  recipeTitleSelected: {
    color: '#0D47A1',
  },
  recipeMeta: {
    fontSize: 12,
    color: '#424752',
    marginTop: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#C2C6D4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F3F3',
  },
  checkboxSelected: {
    backgroundColor: '#004D99',
    borderColor: '#004D99',
  },
  checkIconImg: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
    gap: 12,
  },
  footerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  footerCount: {
    fontSize: 14,
    color: '#424752',
    fontWeight: '500',
  },
  clearText: {
    fontSize: 14,
    color: '#BA1A1A',
    fontWeight: '700',
  },
  addSelectedButton: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565C0',
  },
  addSelectedButtonDisabled: {
    opacity: 0.7,
  },
  addSelectedButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  empty: {
    fontSize: 14,
    color: '#999',
    paddingVertical: 20,
  },
  scrollTopButton: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#004D99',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  scrollTopButtonWithFooter: {
    bottom: 132,
  },
  scrollTopButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
  },
});

export default AddMealScreen;
