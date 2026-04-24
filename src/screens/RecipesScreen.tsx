import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import RecipeCard from '../components/RecipeCard';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import type { RootTabParamList } from '../components/Navbar';
import { getAllRecipes, type Recipe } from '../services/api/recipesApi';
import { useUserStore } from '../store/userStore';
import { auth } from '../services/firebase/firebaseConfig';
import { getUserProfile } from '../services/api/userProfileApi';

const iconSearch = require('../../assets/figma/navbar/tab-search.png');
const iconPlus = require('../../assets/figma/recette/plus.png');
const iconStarWhite = require('../../assets/figma/recette/star-white.png');
const iconTime = require('../../assets/figma/recette/icon-time.png');
const iconFire = require('../../assets/figma/recette/icon-fire.png');

type RecipesNavProp = NativeStackNavigationProp<RecipesStackParamList, 'Recipes'>;

type FilterKey =
  | 'all'
  | 'recommendation'
  | 'favoris'
  | 'perte_poids'
  | 'prise_masse'
  | 'equilibre'
  | 'vegetarien';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'recommendation', label: 'Recommandations' },
  { key: 'favoris', label: 'Favoris' },
  { key: 'perte_poids', label: 'Perte de poids' },
  { key: 'prise_masse', label: 'Prise de masse' },
  { key: 'equilibre', label: 'Équilibré' },
  { key: 'vegetarien', label: 'Végétarien' },
];

const RecipesScreen = () => {
  const navigation = useNavigation<RecipesNavProp>();
  const route = useRoute<RouteProp<RecipesStackParamList, 'Recipes'>>();
  const scrollRef = useRef<ScrollView>(null);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    auth.currentUser?.photoURL ?? null,
  );

  const objective = useUserStore((state) => state.objective);
  const favoriteRecipeIds = useUserStore((state) => state.favoriteRecipeIds);
  const toggleFavorite = useUserStore((state) => state.toggleFavorite);

  const loadData = useCallback(async () => {
    const [data, profile] = await Promise.all([getAllRecipes(), getUserProfile()]);
    setRecipes(data);
    if (profile?.avatarUrl) {
      setAvatarUrl(profile.avatarUrl);
    } else if (auth.currentUser?.photoURL) {
      setAvatarUrl(auth.currentUser.photoURL);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

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

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    const q = searchQuery.trim().toLowerCase();
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [recipes, searchQuery]);

  const displayedRecipes = useMemo(() => {
    switch (activeFilter) {
      case 'recommendation':
        return searchFiltered.filter((r) => r.tags.includes(objective));
      case 'favoris':
        return searchFiltered.filter((r) => favoriteRecipeIds.includes(r.id));
      case 'perte_poids':
      case 'prise_masse':
      case 'equilibre':
      case 'vegetarien':
        return searchFiltered.filter((r) => r.tags.includes(activeFilter));
      default:
        return searchFiltered;
    }
  }, [searchFiltered, activeFilter, objective, favoriteRecipeIds]);

  const featuredRecipe = useMemo<Recipe | null>(() => {
    if (activeFilter !== 'all' || searchQuery.trim()) return null;
    const recommended = recipes.filter((r) => r.tags.includes(objective) && r.image);
    return recommended[0] ?? recipes.find((r) => !!r.image) ?? recipes[0] ?? null;
  }, [recipes, objective, activeFilter, searchQuery]);

  const listRecipes = useMemo(() => {
    if (!featuredRecipe) return displayedRecipes;
    return displayedRecipes.filter((r) => r.id !== featuredRecipe.id);
  }, [displayedRecipes, featuredRecipe]);

  const isFeaturedFav = featuredRecipe
    ? favoriteRecipeIds.includes(featuredRecipe.id)
    : false;

  const navigateToProfile = () => {
    const parent = navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
    parent?.navigate('Profil', undefined);
  };

  const showHero = !!featuredRecipe && activeFilter === 'all' && !searchQuery.trim();
  const sectionLabel =
    showHero
      ? 'Populaire en ce moment'
      : `${listRecipes.length} recette${listRecipes.length !== 1 ? 's' : ''}`;

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
          {FILTERS.map((f) => {
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

        {/* ── Hero "Recette du jour" ── */}
        {showHero && featuredRecipe && (
          <TouchableOpacity
            style={styles.hero}
            onPress={() => navigation.navigate('RecipeDetail', featuredRecipe)}
            activeOpacity={0.92}
          >
            {featuredRecipe.image ? (
              <Image
                source={{ uri: featuredRecipe.image }}
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
              <View style={styles.heroContent}>
                <View style={styles.heroLeft}>
                  <Text style={styles.heroLabel}>Recette du jour</Text>
                  <Text style={styles.heroTitle} numberOfLines={3}>
                    {featuredRecipe.title}
                  </Text>
                  <View style={styles.heroMeta}>
                    <View style={styles.heroMetaItem}>
                      <Image source={iconTime} style={styles.heroMetaIcon} />
                      <Text style={styles.heroMetaText}>15 min</Text>
                    </View>
                    <View style={styles.heroMetaItem}>
                      <Image source={iconFire} style={styles.heroMetaIcon} />
                      <Text style={styles.heroMetaText}>{featuredRecipe.calories} kcal</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.heroBookmark}
                  onPress={() => toggleFavorite(featuredRecipe.id)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={iconStarWhite}
                    style={[styles.heroBookmarkIcon, isFeaturedFav && styles.heroBookmarkIconActive]}
                  />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── Section header ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionLabel}</Text>
          {showHero && (
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Recipe list ── */}
        <View style={styles.listWrapper}>
          {listRecipes.length === 0 ? (
            <Text style={styles.empty}>Aucune recette ne correspond.</Text>
          ) : (
            listRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                calories={recipe.calories}
                tags={recipe.tags}
                image={recipe.image}
                rating={recipe.rating}
                difficulty={recipe.difficulty}
                onPress={() => navigation.navigate('RecipeDetail', recipe)}
              />
            ))
          )}
        </View>
      </ScrollView>
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
    paddingVertical: 18,
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
    color: '#18181B',
    padding: 0,
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
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    height: 320,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBookmarkIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: 'rgba(255,255,255,0.7)',
  },
  heroBookmarkIconActive: {
    tintColor: '#FFFFFF',
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
  seeAll: {
    fontSize: 14,
    color: '#004D99',
    fontWeight: '500',
  },
  /* ── List ── */
  listWrapper: {
    paddingHorizontal: 24,
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});

export default RecipesScreen;
