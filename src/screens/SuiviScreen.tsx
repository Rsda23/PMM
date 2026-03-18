import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SuiviStackParamList } from '../navigation/SuiviStack';
import { getUserProfile, updateUserProfile } from '../services/api/userProfileApi';
import {
  getMealPlansForDateRange,
  getMealPlansForDay,
  groupEntriesByDate,
  MEAL_TYPE_LABELS,
  totalCalories,
  type MealPlanEntry,
  type MealType,
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
type ViewMode = 'week' | 'month';

// Locale FR pour react-native-calendars
LocaleConfig.locales.fr = {
  monthNames: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],
  monthNamesShort: [
    'Jan',
    'Fév',
    'Mar',
    'Avr',
    'Mai',
    'Juin',
    'Juil',
    'Aoû',
    'Sep',
    'Oct',
    'Nov',
    'Déc',
  ],
  dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  dayNamesShort: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = 'fr';

const SuiviScreen = () => {
  const navigation = useNavigation<Nav>();
  const [calorieGoal, setCalorieGoal] = useState<number>(DEFAULT_CALORIE_GOAL);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<MealPlanEntry[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthEntries, setMonthEntries] = useState<MealPlanEntry[]>([]);

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

  const loadToday = useCallback(async () => {
    const today = toDateString(new Date());
    const data = await getMealPlansForDay(today);
    setTodayEntries(data);
  }, []);

  const loadMonth = useCallback(async () => {
    const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const data = await getMealPlansForDateRange(start, end);
    setMonthEntries(data);
  }, [monthCursor]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        await loadProfile();
        if (!cancelled) await Promise.all([loadWeek(), loadToday(), loadMonth()]);
        if (!cancelled) setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [loadProfile, loadWeek, loadToday, loadMonth]),
  );

  useEffect(() => {
    loadWeek();
  }, [weekStart]);

  useEffect(() => {
    loadToday();
  }, []);

  useEffect(() => {
    loadMonth();
  }, [monthCursor]);

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
  const todayPlanned = totalCalories(todayEntries, false);
  const todayConsumed = totalCalories(todayEntries, true);
  const weekDays = getWeekDays(weekStart);

  const todayPlannedPreview = useMemo(() => {
    const planned = todayEntries.filter((e) => e.status === 'planned' || e.status === 'completed');
    if (planned.length === 0) return [];
    const byType = new Map<MealType, string[]>();
    for (const e of planned) {
      const list = byType.get(e.mealType) ?? [];
      list.push(e.recipeTitle);
      byType.set(e.mealType, list);
    }
    const order: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
    return order
      .map((t) => {
        const items = byType.get(t);
        if (!items || items.length === 0) return null;
        const unique = Array.from(new Set(items)).slice(0, 2);
        const suffix = items.length > 2 ? ` +${items.length - 2}` : '';
        return `${MEAL_TYPE_LABELS[t]} : ${unique.join(' • ')}${suffix}`;
      })
      .filter((x): x is string => Boolean(x));
  }, [todayEntries]);

  const goPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goNextWeek = () => setWeekStart((d) => addDays(d, 7));

  const markedDates = useMemo(() => {
    const map: Record<string, { dots?: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }> = {};
    const byDateMonth = groupEntriesByDate(monthEntries);
    for (const [dateStr, list] of byDateMonth.entries()) {
      const hasPlanned = list.some((e) => e.status === 'planned');
      const hasCompleted = list.some((e) => e.status === 'completed');
      const dots: { key: string; color: string }[] = [];
      if (hasPlanned) dots.push({ key: 'planned', color: '#1565c0' });
      if (hasCompleted) dots.push({ key: 'completed', color: '#43a047' });
      map[dateStr] = { dots };
    }
    // Met en évidence aujourd'hui
    map[todayStr] = {
      ...(map[todayStr] ?? {}),
      selected: true,
      selectedColor: '#e3f2fd',
    };
    return map;
  }, [monthEntries, todayStr]);

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
        <View style={styles.todayStats}>
          <Text style={styles.todayStat}>
            <Text style={styles.todayStatLabel}>Prévu : </Text>
            {todayPlanned} kcal
          </Text>
          <Text style={styles.todayStat}>
            <Text style={styles.todayStatLabel}>Consommé : </Text>
            {todayConsumed} kcal
          </Text>
        </View>
        <Text style={styles.todayKcal}>
          {todayConsumed} / {calorieGoal} kcal
          {todayPlanned > 0 && (
            <Text style={styles.todayPrevu}> ({todayConsumed} / {todayPlanned} prévu)</Text>
          )}
        </Text>
        {todayPlannedPreview.length > 0 && (
          <View style={styles.todayPreview}>
            {todayPlannedPreview.map((line) => (
              <Text key={line} style={styles.todayPreviewLine} numberOfLines={1}>
                {line}
              </Text>
            ))}
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'week' && styles.tabActive]}
          onPress={() => setViewMode('week')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, viewMode === 'week' && styles.tabTextActive]}>
            Semaine
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'month' && styles.tabActive]}
          onPress={() => setViewMode('month')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, viewMode === 'month' && styles.tabTextActive]}>
            Mois
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'month' ? (
        <>
          <View style={styles.calendarCard}>
            <Calendar
              current={toDateString(monthCursor)}
              firstDay={1}
              hideExtraDays
              enableSwipeMonths
              markingType="multi-dot"
              markedDates={markedDates as any}
              onDayPress={(day) => navigation.navigate('DayDetail', { date: day.dateString })}
              onMonthChange={(m) => setMonthCursor(new Date(m.year, m.month - 1, 1))}
              theme={{
                todayTextColor: '#1565c0',
                selectedDayTextColor: '#1565c0',
                arrowColor: '#1565c0',
                textSectionTitleColor: '#666',
                monthTextColor: '#333',
              }}
            />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#1565c0' }]} />
                <Text style={styles.legendText}>Prévu</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#43a047' }]} />
                <Text style={styles.legendText}>Consommé</Text>
              </View>
            </View>
          </View>
        </>
      ) : (
        <>
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
            const planned = totalCalories(dayEntries, false);
            const consumed = totalCalories(dayEntries, true);
            const today = isToday(dateString);
            const ratio = calorieGoal > 0 ? consumed / calorieGoal : 0;
            const pct = Math.max(0, Math.min(1, ratio));
            const over = ratio >= 1;
            return (
              <TouchableOpacity
                key={dateString}
                style={[styles.dayRow, today && styles.dayRowToday]}
                onPress={() => navigation.navigate('DayDetail', { date: dateString })}
                activeOpacity={0.8}
              >
                <View style={styles.dayRowLeft}>
                  <Text style={styles.dayRowLabel}>{label}</Text>
                  <View style={styles.dayProgressTrack}>
                    <View
                      style={[
                        styles.dayProgressFill,
                        over && styles.dayProgressFillOver,
                        { width: `${pct * 100}%` },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.dayRowStats}>
                  <Text style={styles.dayRowKcal}>
                    {consumed} / {calorieGoal} kcal
                  </Text>
                  {planned > 0 && (
                    <Text style={styles.dayRowPrevu}>Prévu : {planned}</Text>
                  )}
                </View>
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
        </>
      )}
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
    marginBottom: 8,
  },
  todayStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  todayStat: {
    fontSize: 14,
    color: '#333',
  },
  todayStatLabel: {
    color: '#666',
    fontWeight: '500',
  },
  todayKcal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  todayPrevu: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#666',
  },
  todayPreview: {
    marginTop: 10,
    gap: 4,
  },
  todayPreviewLine: {
    fontSize: 13,
    color: '#666',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#1565c0',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 10,
    marginBottom: 20,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
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
  dayRowLeft: {
    flex: 1,
    paddingRight: 12,
  },
  dayRowToday: {
    borderColor: '#1565c0',
    backgroundColor: '#e3f2fd',
  },
  dayRowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  dayProgressTrack: {
    height: 6,
    backgroundColor: '#eee',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  dayProgressFill: {
    height: '100%',
    backgroundColor: '#1565c0',
    borderRadius: 999,
  },
  dayProgressFillOver: {
    backgroundColor: '#c62828',
  },
  dayRowStats: {
    alignItems: 'flex-end',
  },
  dayRowKcal: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  dayRowPrevu: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

export default SuiviScreen;
