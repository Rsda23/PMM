import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SuiviStackParamList } from '../navigation/SuiviStack';
import { getUserProfile, updateUserProfile } from '../services/api/userProfileApi';
import {
  getMealPlansForDateRange,
  groupEntriesByDate,
  totalCalories,
  type MealPlanEntry,
} from '../services/api/mealPlansApi';
import {
  getWeekStart,
  getWeekDays,
  addDays,
  toDateString,
  isToday,
  formatDayLong,
} from '../utils/dateUtils';

type Nav = NativeStackNavigationProp<SuiviStackParamList, 'SuiviMain'>;

const DEFAULT_CALORIE_GOAL = 2000;

const SuiviScreen = () => {
  const navigation = useNavigation<Nav>();
  const [calorieGoal, setCalorieGoal] = useState<number>(DEFAULT_CALORIE_GOAL);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);

  const loadProfile = useCallback(async () => {
    const profile = await getUserProfile();
    if (profile?.calorieGoal != null && profile.calorieGoal > 0) {
      setCalorieGoal(profile.calorieGoal);
      setGoalInput(String(profile.calorieGoal));
    } else {
      setGoalInput(String(DEFAULT_CALORIE_GOAL));
    }
  }, []);

  const loadWeek = useCallback(async () => {
    const start = weekStart;
    const end = addDays(start, 6);
    const data = await getMealPlansForDateRange(start, end);
    setEntries(data);
  }, [weekStart]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        await loadProfile();
        if (!cancelled) await loadWeek();
        if (!cancelled) setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [loadProfile, loadWeek]),
  );

  useEffect(() => {
    loadWeek();
  }, [weekStart]);

  const saveGoal = async () => {
    const n = parseInt(goalInput, 10);
    if (isNaN(n) || n < 500 || n > 10000) {
      Alert.alert('Objectif invalide', 'Saisis un nombre entre 500 et 10000 kcal.');
      return;
    }
    setEditingGoal(false);
    setCalorieGoal(n);
    try {
      await updateUserProfile({ calorieGoal: n });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d’enregistrer l’objectif.');
    }
  };

  const byDate = groupEntriesByDate(entries);
  const todayStr = toDateString(new Date());
  const todayEntries = byDate.get(todayStr) ?? [];
  const todayTotal = totalCalories(todayEntries, true);
  const weekDays = getWeekDays(weekStart);

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1565c0" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Suivi nutritionnel</Text>

      <View style={styles.goalCard}>
        <Text style={styles.goalLabel}>Objectif calorique journalier</Text>
        {editingGoal ? (
          <View style={styles.goalRow}>
            <TextInput
              style={styles.goalInput}
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="number-pad"
              placeholder="ex: 2500"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.goalButton} onPress={saveGoal}>
              <Text style={styles.goalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingGoal(true)}>
            <Text style={styles.goalValue}>{calorieGoal} kcal / jour</Text>
            <Text style={styles.goalHint}>Appuie pour modifier</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Aujourd'hui</Text>
      <TouchableOpacity
        style={styles.todayCard}
        onPress={() => navigation.navigate('DayDetail', { date: todayStr })}
        activeOpacity={0.8}
      >
        <Text style={styles.todayLabel}>{formatDayLong(todayStr)}</Text>
        <Text style={styles.todayKcal}>
          {todayTotal} / {calorieGoal} kcal
        </Text>
        <Text style={styles.todaySub}>
          {todayTotal >= calorieGoal ? 'Objectif atteint' : 'Consommé'}
        </Text>
      </TouchableOpacity>

      <View style={styles.semaineRow}>
        <Text style={styles.sectionTitle}>Semaine</Text>
        <TouchableOpacity
          style={styles.addButtonInline}
          onPress={() => navigation.navigate('AddMeal', { date: todayStr })}
        >
          <Text style={styles.addButtonInlineText}>+ Ajouter un repas</Text>
        </TouchableOpacity>
      </View>
      {weekDays.map(({ dateString, label }) => {
        const dayEntries = byDate.get(dateString) ?? [];
        const total = totalCalories(dayEntries, true);
        const today = isToday(dateString);
        return (
          <TouchableOpacity
            key={dateString}
            style={[styles.dayRow, today && styles.dayRowToday]}
            onPress={() => navigation.navigate('DayDetail', { date: dateString })}
            activeOpacity={0.8}
          >
            <Text style={styles.dayRowLabel}>{label}</Text>
            <Text style={styles.dayRowKcal}>
              {total} / {calorieGoal} kcal
            </Text>
          </TouchableOpacity>
        );
      })}
      <View style={styles.weekHeader}>
        <TouchableOpacity onPress={goPrevWeek} style={styles.weekNav}>
          <Text style={styles.weekNavText}>← Semaine précédente</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goNextWeek} style={styles.weekNav}>
          <Text style={styles.weekNavText}>Semaine suivante →</Text>
        </TouchableOpacity>
      </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  goalCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  goalLabel: {
    fontSize: 14,
    color: '#1565c0',
    marginBottom: 6,
  },
  goalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0d47a1',
  },
  goalHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalInput: {
    borderWidth: 1,
    borderColor: '#1565c0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 18,
    minWidth: 100,
  },
  goalButton: {
    backgroundColor: '#1565c0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  goalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  semaineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addButtonInline: {
    backgroundColor: '#1565c0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonInlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  todayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  todayLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  todayKcal: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  todaySub: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  weekNav: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  weekNavText: {
    fontSize: 14,
    color: '#1565c0',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  dayRowToday: {
    borderColor: '#1565c0',
    backgroundColor: '#e3f2fd',
  },
  dayRowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  dayRowKcal: {
    fontSize: 15,
    color: '#666',
  },
});

export default SuiviScreen;
