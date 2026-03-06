import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuiviStackParamList } from '../navigation/SuiviStack';
import { useFocusEffect } from '@react-navigation/native';
import {
  getMealPlansForDay,
  totalCalories,
  updateMealPlanStatus,
  deleteMealPlan,
  MEAL_TYPE_LABELS,
  type MealPlanEntry,
  type MealType,
} from '../services/api/mealPlansApi';
import { getUserProfile } from '../services/api/userProfileApi';
import { formatDayLong } from '../utils/dateUtils';

type Props = NativeStackScreenProps<SuiviStackParamList, 'DayDetail'>;

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

const DayDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { date } = route.params;
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [profile, rangeEntries] = await Promise.all([
      getUserProfile(),
      getMealPlansForDay(date),
    ]);
    if (profile?.calorieGoal) setCalorieGoal(profile.calorieGoal);
    setEntries(rangeEntries);
    setLoading(false);
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byType = new Map<MealType, MealPlanEntry[]>();
  for (const e of entries) {
    const list = byType.get(e.mealType) ?? [];
    list.push(e);
    byType.set(e.mealType, list);
  }
  const consumedTotal = totalCalories(entries, true);
  const plannedTotal = totalCalories(entries, false);

  const handleToggleStatus = async (entry: MealPlanEntry) => {
    try {
      await updateMealPlanStatus(entry.id, entry.status === 'completed' ? 'planned' : 'completed');
      load();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de modifier.');
    }
  };

  const handleDelete = (entry: MealPlanEntry) => {
    Alert.alert(
      'Supprimer le repas',
      `Retirer « ${entry.recipeTitle} » de ce jour ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMealPlan(entry.id);
              load();
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de supprimer.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1565c0" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Retour</Text>
      </TouchableOpacity>

      <Text style={styles.dayTitle}>{formatDayLong(date)}</Text>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Consommé</Text>
        <Text style={styles.summaryKcal}>
          {consumedTotal} / {calorieGoal} kcal
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (consumedTotal / calorieGoal) * 100)}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.mealsSection}>
        {MEAL_ORDER.map((mealType) => {
          const list = byType.get(mealType) ?? [];
          return (
            <View key={mealType} style={styles.mealBlock}>
              <Text style={styles.mealTypeTitle}>{MEAL_TYPE_LABELS[mealType]}</Text>
              {list.length === 0 ? (
                <Text style={styles.emptyMeal}>—</Text>
              ) : (
                list.map((entry) => {
                  const done = entry.status === 'completed';
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={[styles.mealRow, done && styles.mealRowDone]}
                      onPress={() => handleToggleStatus(entry)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, done && styles.checkboxDone]}>
                        {done && <Text style={styles.checkIcon}>✓</Text>}
                      </View>
                      <View style={styles.mealInfo}>
                        <Text style={[styles.mealName, done && styles.mealNameDone]}>
                          {entry.recipeTitle}
                        </Text>
                        <Text style={[styles.mealKcal, done && styles.mealKcalDone]}>
                          {entry.calories} kcal
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDelete(entry)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={styles.deleteBtn}
                      >
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddMeal', { date })}
      >
        <Text style={styles.addButtonText}>+ Ajouter un repas</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1565c0',
    fontWeight: '500',
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#1565c0',
    marginBottom: 4,
  },
  summaryKcal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0d47a1',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#bbdefb',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1565c0',
    borderRadius: 4,
  },
  mealsSection: {
    marginBottom: 24,
  },
  mealBlock: {
    marginBottom: 16,
  },
  mealTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyMeal: {
    fontSize: 14,
    color: '#999',
    marginLeft: 4,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  mealRowDone: {
    backgroundColor: '#e8f5e9',
    borderColor: '#a5d6a7',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxDone: {
    backgroundColor: '#43a047',
    borderColor: '#43a047',
  },
  checkIcon: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 15,
    fontWeight: '500',
  },
  mealNameDone: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  mealKcal: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  mealKcalDone: {
    color: '#999',
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    fontSize: 16,
    color: '#c62828',
  },
  addButton: {
    backgroundColor: '#1565c0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DayDetailScreen;
