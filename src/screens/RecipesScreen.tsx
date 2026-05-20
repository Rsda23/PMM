import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import type { RootTabParamList } from '../components/Navbar';
import {
  fetchRecipesUpTo,
  getRecipesDisplayCount,
  getRecipesPage,
  RECIPES_PAGE_SIZE,
  type Recipe,
  type RecipesPageCursor,
} from '../services/api/recipesApi';
import { useUserStore } from '../store/userStore';
import { auth } from '../services/firebase/firebaseConfig';
import { getUserProfile } from '../services/api/userProfileApi';

/** En « mes créations », le premier chargement ne doit pas s’arrêter à 4 docs : les filtres (tags) sont dérivés des recettes chargées ; sinon des tags absents des premiers ids n’apparaissent pas. */
const MINE_INITIAL_FETCH_TARGET = 200;
const MINE_PAGE_SIZE = 40;

const iconSearch = require('../../assets/figma/navbar/tab-search.png');
const iconPlus = require('../../assets/figma/recette/plus.png');
const iconStarWhite = require('../../assets/figma/recette/star-white.png');
const iconTime = require('../../assets/figma/recette/icon-time.png');
const iconFire = require('../../assets/figma/recette/icon-fire.png');

type RecipesNavProp = NativeStackNavigationProp<RecipesStackParamList, 'Recipes'>;

type FilterKey = 'all' | 'favoris' | string;

const TAG_LABELS: Record<string, string> = {
  perte_poids: 'Perte de poids',
  prise_masse: 'Prise de masse',
  equilibre: 'Équilibré',
  vegetarien: 'Végétarien',
  riche_proteine: 'Protéines',
  rapide: 'Rapide',
  sans_gluten: 'Sans gluten',
  faible_carb: 'Faible carb',
  petit_dej: 'Petit-déj',
  energie: 'Énergie',
  midi: 'Midi',
  soir: 'Soir',
  matin: 'Matin',
  dejeuner: 'Déjeuner',
  dinner: 'Dîner',
  lunch: 'Déjeuner',
  breakfast: 'Petit-déjeuner',
  snack: 'Collation',
};

const formatTagLabel = (tag: string) => TAG_LABELS[tag] ?? tag.replace(/_/g, ' ');

const RecipesScreen = () => {
  const navigation = useNavigation<RecipesNavProp>();
  const route = useRoute<RouteProp<RecipesStackParamList, 'Recipes'>>();
  const scrollRef = useRef<ScrollView>(null);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [lastCursor, setLastCursor] = useState<RecipesPageCursor>(null);
  const [hasMoreRecipes, setHasMoreRecipes] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreLockRef = useRef(false);
  const hasUserScrolledRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [showPublicRecipes, setShowPublicRecipes] = useState(true);
  const toggleLockRef = useRef(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    auth.currentUser?.photoURL ?? null,
  );
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filteredTotalCount, setFilteredTotalCount] = useState<number | null>(null);

  const favoriteRecipeIds = useUserStore((state) => state.favoriteRecipeIds);
  const toggleFavorite = useUserStore((state) => state.toggleFavorite);
  const pruneFavorites = useUserStore((state) => state.pruneFavorites);

  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;
  const favoriteRecipeIdsRef = useRef(favoriteRecipeIds);
  favoriteRecipeIdsRef.current = favoriteRecipeIds;

  const refreshFilteredTotalCount = useCallback(async () => {
    const n = await getRecipesDisplayCount({
      onlyMine: !showPublicRecipes,
      activeFilter: activeFilterRef.current,
      favoriteRecipeIds: favoriteRecipeIdsRef.current,
    });
    setFilteredTotalCount(n);
  }, [showPublicRecipes]);

  const loadFirstPage = useCallback(async () => {
    const onlyMine = !showPublicRecipes;
    hasUserScrolledRef.current = false;
    setLoadingInitial(true);
    setFilteredTotalCount(null);
    setRecipes([]);
    setLastCursor(null);
    setHasMoreRecipes(true);
    try {
      const [page, profile] = await Promise.all([
        fetchRecipesUpTo(
          onlyMine ? MINE_INITIAL_FETCH_TARGET : RECIPES_PAGE_SIZE,
          null,
          onlyMine,
          onlyMine ? MINE_PAGE_SIZE : RECIPES_PAGE_SIZE,
        ),
        getUserProfile(),
      ]);
      setRecipes(page.recipes);
      setLastCursor(page.cursor);
      setHasMoreRecipes(page.hasMore);
      pruneFavorites(page.recipes.map((recipe) => recipe.id));
      await refreshFilteredTotalCount();
      if (profile?.avatarUrl) {
        setAvatarUrl(profile.avatarUrl);
      } else if (auth.currentUser?.photoURL) {
        setAvatarUrl(auth.currentUser.photoURL);
      }
    } finally {
      setLoadingInitial(false);
    }
  }, [pruneFavorites, refreshFilteredTotalCount, showPublicRecipes]);

  const loadMoreRecipes = useCallback(async () => {
    if (!hasMoreRecipes || loadMoreLockRef.current || loadingInitial || loadingMore) return;
    if (lastCursor === null) return;

    loadMoreLockRef.current = true;
    setLoadingMore(true);
    try {
      const onlyMine = !showPublicRecipes;
      const page = await getRecipesPage(
        onlyMine ? MINE_PAGE_SIZE : RECIPES_PAGE_SIZE,
        lastCursor,
        onlyMine,
      );
      setRecipes((prev) => {
        const merged = [...prev, ...page.recipes];
        pruneFavorites(merged.map((r) => r.id));
        return merged;
      });
      setLastCursor(page.cursor);
      setHasMoreRecipes(page.hasMore);
    } finally {
      loadMoreLockRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMoreRecipes, lastCursor, loadingInitial, loadingMore, pruneFavorites, showPublicRecipes]);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
    }, [loadFirstPage]),
  );

  useEffect(() => {
    if (loadingInitial) return;
    void refreshFilteredTotalCount();
  }, [activeFilter, favoriteRecipeIds, loadingInitial, refreshFilteredTotalCount]);

  useEffect(() => {
    if (!route.params?.reTapToken) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [route.params?.reTapToken]);

  const avatarInitial = useMemo(() => {
    const user = auth.currentUser;
    const raw = (user?.displayName ?? user?.email ?? '').trim();
    if (!raw) return '?';
    return (raw.includes('@') ? raw.split('@')[0] : raw).charAt(0).toUpperCase();
  }, [auth.currentUser?.displayName, auth.currentUser?.email]);
  const currentUserId = auth.currentUser?.uid ?? null;

  const visibilityFiltered = useMemo(() => {
    if (showPublicRecipes) return recipes;
    if (!currentUserId) return [];
    return recipes.filter(
      (recipe) => recipe.createdBy != null && recipe.createdBy === currentUserId,
    );
  }, [recipes, showPublicRecipes, currentUserId]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const recipe of visibilityFiltered) {
      for (const tag of recipe.tags ?? []) {
        const trimmed = tag.trim();
        if (trimmed) tagSet.add(trimmed);
      }
    }
    return Array.from(tagSet).sort((a, b) =>
      formatTagLabel(a).localeCompare(formatTagLabel(b), 'fr'),
    );
  }, [visibilityFiltered]);

  const filters = useMemo(
    () => [
      { key: 'all' as const, label: 'Tous' },
      { key: 'favoris' as const, label: 'Favoris' },
      ...availableTags.map((tag) => ({ key: tag, label: formatTagLabel(tag) })),
    ],
    [availableTags],
  );

  useEffect(() => {
    if (loadingInitial) return;
    if (
      activeFilter !== 'all' &&
      activeFilter !== 'favoris' &&
      !availableTags.includes(activeFilter)
    ) {
      setActiveFilter('all');
    }
  }, [activeFilter, availableTags, loadingInitial]);

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return visibilityFiltered;
    const q = searchQuery.trim().toLowerCase();
    return visibilityFiltered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [visibilityFiltered, searchQuery]);

  const displayedRecipes = useMemo(() => {
    if (activeFilter === 'favoris') {
      return searchFiltered.filter((r) => favoriteRecipeIds.includes(r.id));
    }
    if (activeFilter !== 'all') {
      return searchFiltered.filter((r) => r.tags.includes(activeFilter));
    }
    return searchFiltered;
  }, [searchFiltered, activeFilter, favoriteRecipeIds]);

  const navigateToProfile = () => {
    const parent = navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
    parent?.navigate('Profil', undefined);
  };

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      if (offsetY > 48) {
        hasUserScrolledRef.current = true;
      }
      setShowScrollTop((prev) => {
        if (offsetY > 320 && !prev) return true;
        if (offsetY <= 320 && prev) return false;
        return prev;
      });

      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const paddingToBottom = 420;
      const nearBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
      if (
        hasUserScrolledRef.current &&
        nearBottom &&
        hasMoreRecipes &&
        !loadingInitial &&
        !loadingMore
      ) {
        void loadMoreRecipes();
      }
    },
    [hasMoreRecipes, loadingInitial, loadingMore, loadMoreRecipes],
  );

  const heroRecipes = displayedRecipes;
  const sectionLabel = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0;
    const n = hasSearch
      ? displayedRecipes.length
      : (filteredTotalCount ?? displayedRecipes.length);
    return `${n} recette${n !== 1 ? 's' : ''}`;
  }, [searchQuery, filteredTotalCount, displayedRecipes.length]);
  const getRecipeBadgeLabel = useCallback(
    (recipe: Recipe) => {
      if (recipe.difficulty?.trim()) return recipe.difficulty.trim();

      const tags = recipe.tags ?? [];
      if (tags.length === 0) return 'Recette';

      const preferredTag =
        activeFilter !== 'all' &&
        activeFilter !== 'favoris' &&
        tags.includes(activeFilter)
          ? activeFilter
          : tags.find((tag) => TAG_LABELS[tag]) ?? tags[0];

      return formatTagLabel(preferredTag);
    },
    [activeFilter],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Recettes</Text>
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={navigateToProfile}
          activeOpacity={0.8}
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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ── Search + Create ── */}
        <View style={styles.searchSection}>
          <View style={styles.searchWrapper}>
            <Image source={iconSearch} style={styles.searchIconImg} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#6B7280"
            />
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('CreateRecipe')}
            activeOpacity={0.85}
          >
            <Image source={iconPlus} style={styles.plusIcon} />
            <Text style={styles.createBtnText}>Créer</Text>
          </TouchableOpacity>
        </View>

        {/* ── Filters ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {filters.map((f) => {
            const active = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Section header ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionLabel}</Text>
          <TouchableOpacity
            style={styles.glassToggleWrap}
            onPress={() => {
              if (toggleLockRef.current) return;
              toggleLockRef.current = true;
              setShowPublicRecipes((prev) => !prev);
              setTimeout(() => { toggleLockRef.current = false; }, 400);
            }}
            activeOpacity={0.85}
            accessibilityRole="switch"
            accessibilityState={{ checked: showPublicRecipes }}
            accessibilityLabel={
              showPublicRecipes
                ? 'Affichage : toutes les recettes, catalogue inclus'
                : 'Affichage : uniquement mes créations'
            }
            accessibilityHint="Active pour voir aussi les recettes du catalogue partagé. Désactive pour ne voir que tes recettes."
          >
            <Text style={styles.glassToggleLabel} numberOfLines={2}>
              {showPublicRecipes ? 'Catalogue inclus' : 'Mes créations'}
            </Text>
            <View style={[styles.glassTrack, showPublicRecipes && styles.glassTrackOn]}>
              <View style={[styles.glassThumb, showPublicRecipes && styles.glassThumbOn]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Recipe list ── */}
        <View style={styles.listWrapper}>
          {loadingInitial && recipes.length === 0 ? (
            <View style={styles.initialLoading}>
              <ActivityIndicator size="large" color="#1565c0" />
            </View>
          ) : heroRecipes.length === 0 ? (
            <Text style={styles.empty}>Aucune recette ne correspond.</Text>
          ) : (
            heroRecipes.map((recipe) => {
              const isFavorite = favoriteRecipeIds.includes(recipe.id);
              return (
                <TouchableOpacity
                  key={recipe.id}
                  style={[styles.hero, styles.heroListItem]}
                  onPress={() => navigation.navigate('RecipeDetail', recipe)}
                  activeOpacity={0.92}
                >
                  {recipe.image ? (
                    <Image
                      source={{ uri: recipe.image }}
                      style={styles.heroImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.heroImage, styles.heroPlaceholder]} />
                  )}
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.82)']}
                    locations={[0, 0.4, 1]}
                    style={styles.heroGradient}
                  >
                    <TouchableOpacity
                      style={styles.heroBookmark}
                      onPress={() => toggleFavorite(recipe.id)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={iconStarWhite}
                        style={[styles.heroBookmarkIcon, isFavorite && styles.heroBookmarkIconActive]}
                      />
                    </TouchableOpacity>
                    <View style={styles.heroContent}>
                      <View style={styles.heroLeft}>
                        <Text style={styles.heroLabel}>
                          {getRecipeBadgeLabel(recipe)}
                        </Text>
                        <Text style={styles.heroTitle} numberOfLines={3}>
                          {recipe.title}
                        </Text>
                        <View style={styles.heroMeta}>
                          <View style={styles.heroMetaItem}>
                            <Image source={iconTime} style={styles.heroMetaIcon} />
                            <Text style={styles.heroMetaText}>
                              {(recipe.prepMinutes != null && recipe.prepMinutes > 0
                                ? Math.round(recipe.prepMinutes)
                                : 15)}{' '}
                              min
                            </Text>
                          </View>
                          <View style={styles.heroMetaItem}>
                            <Image source={iconFire} style={styles.heroMetaIcon} />
                            <Text style={styles.heroMetaText}>{recipe.calories} kcal</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          )}
          {loadingMore ? (
            <View style={styles.loadMoreFooter}>
              <ActivityIndicator size="small" color="#1565c0" />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopButton}
          activeOpacity={0.9}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <Text style={styles.scrollTopButtonText}>↑</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    zIndex: 10,
  },
  topTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.5,
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
  /* ── Scroll ── */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  /* ── Search + Create ── */
  searchSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    paddingLeft: 16,
    paddingRight: 16,
    minHeight: 56,
  },
  searchIconImg: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#6B7280',
    marginRight: 10,
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#004D99',
    borderRadius: 8,
    paddingVertical: 16,
    gap: 8,
  },
  plusIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  /* ── Filters ── */
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 9999,
    backgroundColor: '#E8E8E8',
  },
  chipActive: {
    backgroundColor: '#FC6018',
  },
  chipText: {
    fontSize: 14,
    color: '#424752',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#531800',
    fontWeight: '600',
  },
  /* ── Hero card ── */
  hero: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    height: 320,
  },
  heroListItem: {
    marginTop: 16,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  heroPlaceholder: {
    backgroundColor: '#D1D5DB',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: 24,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    marginRight: 16,
    gap: 6,
  },
  heroLabel: {
    fontSize: 12,
    color: '#98F994',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 34,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 2,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    tintColor: 'rgba(255,255,255,0.9)',
  },
  heroMetaText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  heroBookmark: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBookmarkIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: 'rgba(255,255,255,0.7)',
  },
  heroBookmarkIconActive: {
    tintColor: '#FACC15',
  },
  /* ── Section header ── */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1C1C',
  },
  glassToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  glassToggleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#424752',
    letterSpacing: 0.2,
    textAlign: 'right',
    maxWidth: 108,
    lineHeight: 14,
  },
  glassTrack: {
    width: 36,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  glassTrackOn: {
    backgroundColor: '#FC6018',
  },
  glassThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    alignSelf: 'flex-start',
  },
  glassThumbOn: {
    alignSelf: 'flex-end',
  },
  seeAll: {
    fontSize: 14,
    color: '#004D99',
    fontWeight: '500',
  },
  /* ── List ── */
  listWrapper: {
    paddingHorizontal: 24,
  },
  initialLoading: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
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
  scrollTopButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
  },
});

export default RecipesScreen;
