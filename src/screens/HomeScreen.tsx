import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../components/Navbar';
import { getAllRecipes, getRecommendedRecipes, type Recipe } from '../services/api/recipesApi';
import {
  deleteMealPlan,
  getMealPlansForDateRange,
  getMealPlansForDay,
  groupEntriesByDate,
  MEAL_TYPE_LABELS,
  totalCalories,
  updateMealPlanStatus,
  type MealPlanEntry,
  type MealPlanStatus,
  type MealType,
} from '../services/api/mealPlansApi';
import { getUserProfile } from '../services/api/userProfileApi';
import { auth } from '../services/firebase/firebaseConfig';
import { useUserStore } from '../store/userStore';
import { addDays, getWeekDays, getWeekStart, isToday, toDateString } from '../utils/dateUtils';

type HomeScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Accueil'>;
type SeasonTag = 'hiver' | 'printemps' | 'ete' | 'automne';

const iconPlusWhite = require('../../assets/figma/home/icon-plus-white.png');
const iconPlusBlue = require('../../assets/figma/home/icon-plus-blue.png');
const iconCheck = require('../../assets/figma/home/icon-check.png');
const iconTrash = require('../../assets/figma/home/icon-trash.png');

const normalizeTag = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getCurrentSeasonTag = (date: Date): SeasonTag => {
  const month = date.getMonth() + 1;
  if (month === 12 || month === 1 || month === 2) return 'hiver';
  if (month >= 3 && month <= 5) return 'printemps';
  if (month >= 6 && month <= 8) return 'ete';
  return 'automne';
};

const SEASON_LABELS: Record<SeasonTag, string> = {
  hiver: 'HIVER',
  printemps: 'PRINTEMPS',
  ete: 'ETE',
  automne: 'AUTOMNE',
};

const ratioToStep = (ratio: number): number => {
  if (ratio <= 0) return 0;
  if (ratio < 0.1) return 1;
  if (ratio < 0.2) return 2;
  if (ratio < 0.3) return 3;
  if (ratio < 0.4) return 4;
  if (ratio < 0.5) return 5;
  if (ratio < 0.6) return 6;
  if (ratio < 0.7) return 7;
  if (ratio < 0.8) return 8;
  if (ratio < 0.9) return 9;
  return 10;
};

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute<RouteProp<RootTabParamList, 'Accueil'>>();
  const scrollRef = useRef<ScrollView>(null);
  const [recommendedRecipes, setRecommendedRecipes] = useState<Recipe[]>([]);
  const [todayEntries, setTodayEntries] = useState<MealPlanEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<MealPlanEntry[]>([]);
  const [updatingMealIds, setUpdatingMealIds] = useState<string[]>([]);
  const [deletingMealIds, setDeletingMealIds] = useState<string[]>([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(auth.currentUser?.photoURL ?? null);
  const objective = useUserStore((state) => state.objective);

  const loadDashboard = useCallback(async () => {
    const today = toDateString(new Date());
    const weekStart = getWeekStart(new Date());
    const weekEnd = addDays(weekStart, 6);
    const [recipesData, profile, mealsData, weekData] = await Promise.all([
      getRecommendedRecipes(objective),
      getUserProfile(),
      getMealPlansForDay(today),
      getMealPlansForDateRange(weekStart, weekEnd),
    ]);
    setRecommendedRecipes(recipesData);
    setTodayEntries(mealsData);
    setWeekEntries(weekData);
    if (profile?.calorieGoal && profile.calorieGoal > 0) {
      setCalorieGoal(profile.calorieGoal);
    }
    if (profile?.avatarUrl) {
      setAvatarUrl(profile.avatarUrl);
    } else if (auth.currentUser?.photoURL) {
      setAvatarUrl(auth.currentUser.photoURL);
    }
  }, [objective]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const consumed = totalCalories(todayEntries, true);

  const toggleMealStatus = async (entryId: string) => {
    const current = todayEntries.find((e) => e.id === entryId);
    if (!current) return;
    if (updatingMealIds.includes(entryId)) return;
    const nextStatus: MealPlanStatus = current.status === 'completed' ? 'planned' : 'completed';

    setUpdatingMealIds((ids) => [...ids, entryId]);
    const prevToday = todayEntries;
    const prevWeek = weekEntries;

    setTodayEntries((list) => list.map((e) => (e.id === entryId ? { ...e, status: nextStatus } : e)));
    setWeekEntries((list) => list.map((e) => (e.id === entryId ? { ...e, status: nextStatus } : e)));

    try {
      await updateMealPlanStatus(entryId, nextStatus);
    } catch {
      setTodayEntries(prevToday);
      setWeekEntries(prevWeek);
    } finally {
      setUpdatingMealIds((ids) => ids.filter((id) => id !== entryId));
    }
  };

  const deleteMeal = async (entryId: string) => {
    if (deletingMealIds.includes(entryId)) return;
    setDeletingMealIds((ids) => [...ids, entryId]);
    const prevToday = todayEntries;
    const prevWeek = weekEntries;
    setTodayEntries((list) => list.filter((e) => e.id !== entryId));
    setWeekEntries((list) => list.filter((e) => e.id !== entryId));
    try {
      await deleteMealPlan(entryId);
    } catch {
      setTodayEntries(prevToday);
      setWeekEntries(prevWeek);
    } finally {
      setDeletingMealIds((ids) => ids.filter((id) => id !== entryId));
    }
  };

  const openMealRecipeDetail = async (entry: MealPlanEntry) => {
    if (!entry.recipeId) return;
    const allRecipes = await getAllRecipes();
    const fullRecipe = allRecipes.find((recipe) => recipe.id === entry.recipeId);

    if (fullRecipe) {
      navigation.navigate('Recettes', {
        screen: 'RecipeDetail',
        params: {
          ...fullRecipe,
          source: 'home',
        },
      });
      return;
    }

    navigation.navigate('Recettes', {
      screen: 'RecipeDetail',
      params: {
        id: entry.recipeId,
        title: entry.recipeTitle,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        tags: [],
        ingredients: [],
        instructions: [],
        image: undefined,
        createdBy: undefined,
        difficulty: undefined,
        rating: undefined,
        source: 'home',
      },
    });
  };

  const weekSummary = useMemo(() => {
    const start = getWeekStart(new Date());
    const days = getWeekDays(start);
    const byDate = groupEntriesByDate(weekEntries);
    return days.map((d) => {
      const entries = byDate.get(d.dateString) ?? [];
      const planned = totalCalories(entries, false);
      const dayConsumed = totalCalories(entries, true);
      return {
        dateString: d.dateString,
        label: d.label.split(' ')[0],
        plannedRatio: calorieGoal > 0 ? Math.min(planned / calorieGoal, 1) : 0,
        consumedRatio: calorieGoal > 0 ? Math.min(dayConsumed / calorieGoal, 1) : 0,
        isToday: isToday(d.dateString),
      };
    });
  }, [weekEntries, calorieGoal]);

  const sortedRecommendedRecipes = useMemo(() => {
    const remainingCalories = Math.max(calorieGoal - consumed, 0);
    const objectiveWeight = (recipe: Recipe) => (recipe.tags.includes(objective) ? 0 : 10000);

    const kcalScore = (recipe: Recipe): number => {
      const kcal = recipe.calories ?? 0;
      if (objective === 'perte_poids') {
        if (remainingCalories <= 0) return kcal;
        return Math.max(kcal - remainingCalories, 0) * 2 + Math.abs(remainingCalories - kcal);
      }
      if (objective === 'prise_masse') {
        if (remainingCalories <= 0) return -kcal;
        return -Math.min(kcal, remainingCalories) + Math.abs(remainingCalories - kcal) * 0.3;
      }
      if (remainingCalories <= 0) return Math.abs(kcal - 450);
      return Math.abs(remainingCalories - kcal);
    };

    return [...recommendedRecipes].sort((a, b) => {
      const scoreA = objectiveWeight(a) + kcalScore(a);
      const scoreB = objectiveWeight(b) + kcalScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.title.localeCompare(b.title);
    });
  }, [recommendedRecipes, objective, calorieGoal, consumed]);

  const macroRows = useMemo(() => {
    const consumedEntries = todayEntries.filter((entry) => entry.status === 'completed');
    const carbsKcal = consumedEntries.reduce((sum, entry) => sum + Math.max(entry.carbs ?? 0, 0) * 4, 0);
    const fatsKcal = consumedEntries.reduce((sum, entry) => sum + Math.max(entry.fats ?? 0, 0) * 9, 0);
    const proteinKcal = consumedEntries.reduce((sum, entry) => sum + Math.max(entry.protein ?? 0, 0) * 4, 0);
    const unknownKcal = consumedEntries.reduce((sum, entry) => {
      const known = Math.max(entry.carbs ?? 0, 0) * 4 + Math.max(entry.fats ?? 0, 0) * 9 + Math.max(entry.protein ?? 0, 0) * 4;
      return sum + Math.max((entry.calories ?? 0) - known, 0);
    }, 0);

    const protein = Math.round(proteinKcal / 4);
    const carbs = Math.round(carbsKcal / 4);
    const fats = Math.round(fatsKcal / 9);
    const unknown = Math.round(unknownKcal);

    const proteinGoal = Math.max(Math.round((calorieGoal * 0.3) / 4), 1);
    const carbsGoal = Math.max(Math.round((calorieGoal * 0.4) / 4), 1);
    const fatsGoal = Math.max(Math.round((calorieGoal * 0.3) / 9), 1);

    return [
      { key: 'protein', label: 'PROT', value: protein, goal: proteinGoal, ratio: protein / proteinGoal, fillStyle: styles.macroFillProtein, labelStyle: styles.macroTextProtein },
      { key: 'carbs', label: 'GLUC', value: carbs, goal: carbsGoal, ratio: carbs / carbsGoal, fillStyle: styles.macroFillCarbs, labelStyle: styles.macroTextCarbs },
      { key: 'fats', label: 'LIP', value: fats, goal: fatsGoal, ratio: fats / fatsGoal, fillStyle: styles.macroFillFats, labelStyle: styles.macroTextFats },
      { key: 'unknown', label: 'NON IND', value: unknown, goal: calorieGoal, ratio: calorieGoal > 0 ? unknown / calorieGoal : 0, fillStyle: styles.macroFillUnknown, labelStyle: styles.macroTextUnknown, isKcal: true as const },
    ];
  }, [todayEntries, calorieGoal]);

  const mealHighlights = useMemo(() => {
    return todayEntries
      .slice()
      .sort((a, b) => {
        const order: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
        return order.indexOf(a.mealType) - order.indexOf(b.mealType);
      })
      .slice(0, 2);
  }, [todayEntries]);

  const seasonTag = useMemo<SeasonTag>(() => getCurrentSeasonTag(new Date()), []);
  const seasonRecipes = useMemo(() => {
    const acceptedTags = new Set([seasonTag, `saison_${seasonTag}`]);
    return sortedRecommendedRecipes.filter((recipe) =>
      recipe.tags.some((tag) => acceptedTags.has(normalizeTag(tag))),
    );
  }, [seasonTag, sortedRecommendedRecipes]);
  const featuredRecipe = seasonRecipes[0] ?? sortedRecommendedRecipes[0];
  const featuredTagLabel = SEASON_LABELS[seasonTag];
  const today = toDateString(new Date());
  const consumedPct = calorieGoal > 0 ? Math.round((consumed / calorieGoal) * 100) : 0;
  const accountName = useMemo(() => {
    const user = auth.currentUser;
    const rawName = (user?.displayName ?? user?.email ?? '').trim();
    if (!rawName) return 'Utilisateur';
    const fromEmail = rawName.includes('@') ? rawName.split('@')[0] : rawName;
    const firstChunk = fromEmail.split(/[._\-\s]/).filter(Boolean)[0] ?? fromEmail;
    return firstChunk.charAt(0).toUpperCase() + firstChunk.slice(1);
  }, [auth.currentUser?.displayName, auth.currentUser?.email]);
  const avatarInitial = useMemo(() => {
    const user = auth.currentUser;
    const raw = (user?.displayName ?? user?.email ?? '').trim();
    if (!raw) return '?';
    return (raw.includes('@') ? raw.split('@')[0] : raw).charAt(0).toUpperCase();
  }, [auth.currentUser?.displayName, auth.currentUser?.email]);
  const widthStyleByStep = (step: number) => {
    const map = [styles.w0, styles.w10, styles.w20, styles.w30, styles.w40, styles.w50, styles.w60, styles.w70, styles.w80, styles.w90, styles.w100];
    return map[Math.max(0, Math.min(step, 10))];
  };
  const heightStyleByStep = (step: number) => {
    const map = [styles.h0, styles.h10, styles.h20, styles.h30, styles.h40, styles.h50, styles.h60, styles.h70, styles.h80, styles.h90, styles.h100];
    return map[Math.max(0, Math.min(step, 10))];
  };

  useEffect(() => {
    if (!route.params?.reTapToken) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    loadDashboard();
  }, [route.params?.reTapToken, loadDashboard]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.topNav}>
        <Text style={styles.brand}>PMM</Text>
        <View style={styles.topIcons}>
          <TouchableOpacity
            style={[styles.iconCircle, styles.iconCircleAvatar]}
            onPress={() => navigation.navigate('Profil', undefined)}
            activeOpacity={0.8}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.profilIcon} />
            ) : (
              <Text style={styles.profilInitial}>{avatarInitial}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.greeting}>Bonjour, {accountName}</Text>
      <Text style={styles.subtitle}>
        {'Vous êtes à '}
        <Text style={styles.subtitleHighlight}>{consumedPct}%</Text>
        {' de votre objectif journalier.'}
      </Text>

      <View style={styles.caloriesCard}>
        <View style={styles.ringWrap}>
          <Svg width={140} height={140}>
            <Circle cx={70} cy={70} r={58} stroke="#EEF2F7" strokeWidth={12} fill="none" />
            <Circle
              cx={70}
              cy={70}
              r={58}
              stroke="#2563EB"
              strokeWidth={12}
              fill="none"
              strokeDasharray={`${2 * Math.PI * 58}`}
              strokeDashoffset={`${2 * Math.PI * 58 * (1 - Math.min(consumedPct, 100) / 100)}`}
              strokeLinecap="round"
              rotation={-90}
              origin="70, 70"
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringMain}>{consumed.toLocaleString('fr-FR')}</Text>
            <Text style={styles.ringSub}>kcal</Text>
          </View>
        </View>

        <View style={styles.macrosList}>
          {macroRows.map((macro) => (
            <View key={macro.key} style={styles.macroRow}>
              <View style={styles.macroRowTop}>
                <Text style={[styles.macroLabel, macro.labelStyle]}>{macro.label}</Text>
                <Text style={[styles.macroValue, macro.labelStyle]}>
                  {macro.value}/{macro.goal}{' '}
                  {'isKcal' in macro && macro.isKcal ? 'kcal' : 'g'}
                </Text>
              </View>
              <View style={styles.macroTrack}>
                <View style={[styles.macroFillBase, macro.fillStyle, widthStyleByStep(ratioToStep(Math.min(macro.ratio, 1)))]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Activité Hebdomadaire</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Suivi', { screen: 'SuiviMain' })}>
          <Text style={styles.sectionLink}>Dernier 7 jours</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.activityCard}>
        <View style={styles.activityBars}>
          {weekSummary.map((day) => (
            <TouchableOpacity
              key={day.dateString}
              style={styles.activityBarItem}
              onPress={() => navigation.navigate('Suivi', { screen: 'DayDetail', params: { date: day.dateString } })}
            >
              <View style={[styles.activityTrack, day.isToday && styles.activityTrackToday]}>
                <View style={[styles.activityPlanned, heightStyleByStep(ratioToStep(day.plannedRatio))]} />
                <View style={[styles.activityConsumed, heightStyleByStep(ratioToStep(day.consumedRatio))]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.activityLegend}>
          <View style={styles.legendChip}>
            <View style={styles.legendBlue} />
            <Text style={styles.legendText}>Prévus</Text>
          </View>
          <View style={styles.legendChip}>
            <View style={styles.legendGreen} />
            <Text style={styles.legendText}>Consommé</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Repas du jour</Text>
          {todayEntries.length > 0 && (
            <View style={styles.mealCountBadge}>
              <Text style={styles.mealCountText}>
                {todayEntries.length} ENREGISTRÉ{todayEntries.length > 1 ? 'S' : ''}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Suivi', { screen: 'SuiviMain' })}>
          <Text style={styles.sectionLink}>Voir l&apos;ensemble</Text>
        </TouchableOpacity>
      </View>

      {(['breakfast', 'lunch', 'snack', 'dinner'] as MealType[]).map((mealType) => {
        const entries = todayEntries.filter((e) => e.mealType === mealType);
        const slotKcal = entries.reduce((sum, e) => sum + e.calories, 0);

        if (entries.length === 0) {
          return (
            <TouchableOpacity
              key={mealType}
              style={styles.mealEmptySlot}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('Suivi', {
                  screen: 'AddMeal',
                  params: { date: today, mealType, source: 'home' },
                })
              }
            >
              <View style={styles.addMealButton}>
                <Image source={iconPlusWhite} style={styles.addMealPlusIcon} />
              </View>
              <Text style={styles.mealEmptyType}>{MEAL_TYPE_LABELS[mealType]}</Text>
              <Text style={styles.mealEmptyHint}>Ajouter votre repas</Text>
            </TouchableOpacity>
          );
        }

        return (
          <View key={mealType} style={styles.mealSlot}>
            <View style={styles.mealSlotHeader}>
              <View style={styles.mealSlotLeft}>
                <Text style={styles.mealType}>{MEAL_TYPE_LABELS[mealType]}</Text>
                <TouchableOpacity
                  style={styles.mealSlotAdd}
                  onPress={() =>
                    navigation.navigate('Suivi', {
                      screen: 'AddMeal',
                      params: { date: today, mealType, source: 'home' },
                    })
                  }
                >
                  <Image source={iconPlusBlue} style={styles.mealSlotAddIcon} />
                </TouchableOpacity>
              </View>
              <Text style={styles.mealKcal}>{slotKcal} kcal</Text>
            </View>
            {entries.map((entry) => {
              const checked = entry.status === 'completed';
              const loadingToggle = updatingMealIds.includes(entry.id);
              const loadingDelete = deletingMealIds.includes(entry.id);
              return (
                <View key={entry.id} style={styles.mealRow}>
                  <TouchableOpacity
                    style={[styles.checkCircle, checked && styles.checkCircleDone]}
                    onPress={() => toggleMealStatus(entry.id)}
                    disabled={loadingToggle}
                  >
                    {checked && <Image source={iconCheck} style={styles.checkIcon} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mealTitleBtn}
                    onPress={() => {
                      openMealRecipeDetail(entry).catch((error) => {
                        console.warn('openMealRecipeDetail failed:', error);
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.mealTitle} numberOfLines={1}>{entry.recipeTitle}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteMeal(entry.id)}
                    disabled={loadingDelete}
                    style={styles.mealDeleteBtn}
                  >
                    <Image source={iconTrash} style={[styles.trashIcon, loadingDelete && styles.trashIconDisabled]} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      })}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Inspiration de saison</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Recettes', { screen: 'Recipes' })}>
          <Text style={styles.sectionLink}>Explorer →</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={seasonRecipes.length > 0 ? seasonRecipes : sortedRecommendedRecipes.slice(0, 6)}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.slider}
        contentContainerStyle={styles.sliderContent}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.slideCard}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Recettes', { screen: 'RecipeDetail', params: item })}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.slideImage} resizeMode="cover" />
            ) : (
              <View style={styles.slidePlaceholder}>
                <Ionicons name="leaf-outline" size={28} color="#FFFFFF" />
              </View>
            )}
            {index === 0 && (
              <View style={styles.slideBadge}>
                <Text style={styles.slideBadgeText}>POPULAIRE</Text>
              </View>
            )}
            <View style={styles.slideOverlay}>
              <Text style={styles.slideTag}>
                {featuredTagLabel}{item.calories ? ` • ${item.calories} kcal` : ''}
              </Text>
              <Text style={styles.slideTitle} numberOfLines={2}>{item.title}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  topNav: {
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
  brand: {
    color: '#2563EB',
    fontWeight: '900',
    letterSpacing: -0.5,
    fontSize: 20,
    lineHeight: 28,
  },
  topIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8E8',
  },
  iconCircleAvatar: {
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0,85,255,0.1)',
  },
  profilIcon: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  profilInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
    backgroundColor: '#F7F8FA',
  },
  greeting: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 2,
    marginBottom: 14,
    fontSize: 13,
    color: '#9CA3AF',
  },
  subtitleHighlight: {
    color: '#2563EB',
    fontWeight: '700',
  },
  caloriesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECEFF3',
  },
  ringWrap: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    marginBottom: 10,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMain: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  ringSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  macrosList: {
    gap: 8,
  },
  macroRow: {
    gap: 3,
  },
  macroRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.4,
  },
  macroValue: {
    fontSize: 10,
    color: '#6B7280',
  },
  macroTrack: {
    width: '100%',
    height: 5,
    borderRadius: 999,
    backgroundColor: '#EEF2F7',
    overflow: 'hidden',
  },
  macroFillBase: {
    height: '100%',
    borderRadius: 999,
  },
  macroFillProtein: {
    backgroundColor: '#2563EB',
  },
  macroFillCarbs: {
    backgroundColor: '#F59E0B',
  },
  macroFillFats: {
    backgroundColor: '#16A34A',
  },
  macroFillUnknown: {
    backgroundColor: '#64748B',
  },
  macroTextProtein: { color: '#2563EB' },
  macroTextCarbs: { color: '#F59E0B' },
  macroTextFats: { color: '#16A34A' },
  macroTextUnknown: { color: '#64748B' },
  sectionRow: {
    marginTop: 6,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    padding: 12,
    marginBottom: 12,
  },
  activityBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  activityBarItem: {
    width: 24,
    alignItems: 'center',
  },
  activityTrack: {
    width: 18,
    height: 68,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  activityTrackToday: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  activityPlanned: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#3B82F6',
    opacity: 0.4,
  },
  activityConsumed: {
    width: '100%',
    backgroundColor: '#2563EB',
  },
  activityLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBlue: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#3B82F6',
  },
  legendGreen: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealCountBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  mealCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.3,
  },
  mealEmptySlot: {
    backgroundColor: '#EEF4FF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#C7D7F5',
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  mealEmptyType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealEmptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 3,
  },
  mealSlot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    marginBottom: 12,
  },
  mealSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealSlotAdd: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  mealType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mealTitle: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  mealTitleBtn: {
    flex: 1,
    minWidth: 0,
  },
  mealKcal: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  mealDeleteBtn: {
    padding: 4,
    flexShrink: 0,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleDone: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  addMealButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMealPlusIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  mealSlotAddIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  checkIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  trashIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  trashIconDisabled: {
    opacity: 0.35,
  },
  slider: {
    marginHorizontal: -16,
    marginBottom: 8,
  },
  sliderContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  slideCard: {
    width: 220,
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slidePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  slideBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  slideOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
  slideTag: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  slideTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  w0: { width: '0%' },
  w10: { width: '10%' },
  w20: { width: '20%' },
  w30: { width: '30%' },
  w40: { width: '40%' },
  w50: { width: '50%' },
  w60: { width: '60%' },
  w70: { width: '70%' },
  w80: { width: '80%' },
  w90: { width: '90%' },
  w100: { width: '100%' },
  h0: { height: '0%' },
  h10: { height: '10%' },
  h20: { height: '20%' },
  h30: { height: '30%' },
  h40: { height: '40%' },
  h50: { height: '50%' },
  h60: { height: '60%' },
  h70: { height: '70%' },
  h80: { height: '80%' },
  h90: { height: '90%' },
  h100: { height: '100%' },
});

export default HomeScreen;

