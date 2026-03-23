import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import RecipeCard from '../components/RecipeCard';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../components/Navbar';
import {
  getRecommendedRecipes,
  type Recipe,
} from '../services/api/recipesApi';
import {
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
import { useUserStore } from '../store/userStore';
import { addDays, getWeekDays, getWeekStart, isToday, toDateString } from '../utils/dateUtils';

type HomeScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Accueil'>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute<RouteProp<RootTabParamList, 'Accueil'>>();
  const scrollRef = useRef<ScrollView>(null);
  const [recommendedRecipes, setRecommendedRecipes] = useState<Recipe[]>([]);
  const [todayEntries, setTodayEntries] = useState<MealPlanEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<MealPlanEntry[]>([]);
  const [updatingMealIds, setUpdatingMealIds] = useState<string[]>([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
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
  const statusLabel = consumed >= calorieGoal ? 'Objectif atteint' : 'En cours';

  const mealsByType = useMemo(() => {
    const byType = new Map<MealType, MealPlanEntry[]>();
    for (const entry of todayEntries) {
      const list = byType.get(entry.mealType) ?? [];
      list.push(entry);
      byType.set(entry.mealType, list);
    }
    const order: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
    return order.map((type) => {
      const items = byType.get(type) ?? [];
      return { type, items: items.slice(0, 2), moreCount: Math.max(items.length - 2, 0) };
    });
  }, [todayEntries]);

  const toggleMealStatus = async (entryId: string) => {
    const current = todayEntries.find((e) => e.id === entryId);
    if (!current) return;
    if (updatingMealIds.includes(entryId)) return;
    const nextStatus: MealPlanStatus = current.status === 'completed' ? 'planned' : 'completed';

    setUpdatingMealIds((ids) => [...ids, entryId]);
    const prevToday = todayEntries;
    const prevWeek = weekEntries;

    setTodayEntries((list) =>
      list.map((e) => (e.id === entryId ? { ...e, status: nextStatus } : e)),
    );
    setWeekEntries((list) =>
      list.map((e) => (e.id === entryId ? { ...e, status: nextStatus } : e)),
    );

    try {
      await updateMealPlanStatus(entryId, nextStatus);
    } catch {
      setTodayEntries(prevToday);
      setWeekEntries(prevWeek);
    } finally {
      setUpdatingMealIds((ids) => ids.filter((id) => id !== entryId));
    }
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
        planned,
        consumed: dayConsumed,
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

  const today = toDateString(new Date());

  useEffect(() => {
    if (!route.params?.reTapToken) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    loadDashboard();
  }, [route.params?.reTapToken, loadDashboard]);

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Accueil</Text>

      <View style={[styles.todayCard, consumed >= calorieGoal && styles.todayCardReached]}>
        <Text style={styles.todayCardLabel}>Aujourd&apos;hui</Text>
        <Text style={styles.todayCardMain}>
          {consumed} / {calorieGoal} kcal
        </Text>
        <Text style={styles.todayCardStatus}>{statusLabel}</Text>

        <View style={styles.todayActions}>
          <TouchableOpacity
            style={styles.addMealButton}
            onPress={() => navigation.navigate('Suivi', { screen: 'AddMeal', params: { date: today } })}
          >
            <Text style={styles.addMealButtonText}>+ Ajouter un repas</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Suivi', { screen: 'SuiviMain' })}>
            <Text style={styles.viewSuiviLink}>Voir Suivi</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Repas du jour</Text>
      <View style={styles.mealsCard}>
        {todayEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Aucun repas prévu aujourd&apos;hui</Text>
            <Text style={styles.emptyStateText}>Ajoute ton premier repas pour démarrer ton suivi.</Text>
            <TouchableOpacity
              style={styles.emptyStateAction}
              onPress={() => navigation.navigate('Suivi', { screen: 'AddMeal', params: { date: today } })}
            >
              <Text style={styles.emptyStateActionText}>+ Ajouter un repas</Text>
            </TouchableOpacity>
          </View>
        ) : (
          mealsByType.map(({ type, items, moreCount }) => (
            <View key={type} style={styles.mealBlock}>
              <Text style={styles.mealType}>{MEAL_TYPE_LABELS[type]}</Text>
              {items.length === 0 ? (
                <Text style={styles.mealEmpty}>-</Text>
              ) : (
                <>
                  {items.map((item) => {
                    const checked = item.status === 'completed';
                    const loadingToggle = updatingMealIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.mealItemRow}
                        onPress={() => toggleMealStatus(item.id)}
                        activeOpacity={0.8}
                        disabled={loadingToggle}
                      >
                        <View style={[styles.mealCheckbox, checked && styles.mealCheckboxChecked]}>
                          {checked && <Text style={styles.mealCheckboxTick}>✓</Text>}
                        </View>
                        <Text
                          style={[styles.mealItem, checked && styles.mealItemChecked]}
                          numberOfLines={1}
                        >
                          {item.recipeTitle}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {moreCount > 0 && <Text style={styles.mealMore}>+{moreCount} autres</Text>}
                </>
              )}
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Résumé semaine</Text>
      <View style={styles.weekCard}>
        <View style={styles.weekLegendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1565c0' }]} />
            <Text style={styles.legendText}>Prévu</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#43a047' }]} />
            <Text style={styles.legendText}>Consommé</Text>
          </View>
        </View>
        <View style={styles.weekBarsRow}>
          {weekSummary.map((day) => (
            <TouchableOpacity
              key={day.dateString}
              style={styles.weekBarItem}
              onPress={() => navigation.navigate('Suivi', { screen: 'DayDetail', params: { date: day.dateString } })}
              activeOpacity={0.8}
            >
              <View style={[styles.miniTrack, day.isToday && styles.miniTrackToday]}>
                <View style={[styles.miniBarPlanned, { height: `${day.plannedRatio * 100}%` }]} />
                <View style={[styles.miniBarConsumed, { height: `${day.consumedRatio * 100}%` }]} />
              </View>
              <Text style={[styles.weekBarLabel, day.isToday && styles.weekBarLabelToday]}>{day.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recommandations pour toi</Text>

      {sortedRecommendedRecipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          id={recipe.id}
          title={recipe.title}
          calories={recipe.calories}
          tags={recipe.tags}
          image={recipe.image}
          onPress={() => navigation.navigate('Recettes', { screen: 'RecipeDetail', params: recipe })}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  todayCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  todayCardReached: {
    borderColor: '#a5d6a7',
    backgroundColor: '#e8f5e9',
  },
  todayCardLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  todayCardMain: {
    fontSize: 24,
    fontWeight: '700',
  },
  todayCardStatus: {
    marginTop: 2,
    fontSize: 13,
    color: '#555',
  },
  todayActions: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  addMealButton: {
    backgroundColor: '#1565c0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addMealButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  viewSuiviLink: {
    color: '#1565c0',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  mealsCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  mealBlock: {
    marginBottom: 10,
  },
  mealType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  mealItem: {
    fontSize: 13,
    color: '#666',
  },
  mealItemChecked: {
    color: '#2e7d32',
  },
  mealItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  mealCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#b0bec5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  mealCheckboxChecked: {
    backgroundColor: '#43a047',
    borderColor: '#43a047',
  },
  mealCheckboxTick: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  mealEmpty: {
    fontSize: 13,
    color: '#999',
  },
  mealMore: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    paddingVertical: 8,
    alignItems: 'flex-start',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#666',
  },
  emptyStateAction: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  emptyStateActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  weekCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  weekLegendRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  weekBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  weekBarItem: {
    alignItems: 'center',
    width: 34,
  },
  miniTrack: {
    width: 14,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#eef1f4',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  miniTrackToday: {
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  miniBarPlanned: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#1565c0',
    opacity: 0.35,
  },
  miniBarConsumed: {
    width: '100%',
    backgroundColor: '#43a047',
  },
  weekBarLabel: {
    fontSize: 11,
    color: '#666',
  },
  weekBarLabelToday: {
    color: '#1565c0',
    fontWeight: '700',
  },
});

export default HomeScreen;

