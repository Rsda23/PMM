import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { SuiviStackParamList } from '../navigation/SuiviStack';
import type { RootTabParamList } from '../components/Navbar';
import { getUserProfile, updateUserProfile } from '../services/api/userProfileApi';
import {
  getMealPlansForDateRange,
  getMealPlansForDay,
  groupEntriesByDate,
  totalCalories,
  type MealPlanEntry,
} from '../services/api/mealPlansApi';
import {
  getWeekStart,
  getWeekDays,
  addDays,
  toDateString,
} from '../utils/dateUtils';
import { auth } from '../services/firebase/firebaseConfig';

LocaleConfig.locales.fr = {
  monthNames: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  monthNamesShort: ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'],
  dayNames: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  dayNamesShort: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = 'fr';

type Nav = NativeStackNavigationProp<SuiviStackParamList, 'SuiviMain'>;
const DEFAULT_CALORIE_GOAL = 2000;
type ViewMode = 'week' | 'month';

const DAY_ABBR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
type MealKey = (typeof MEAL_ORDER)[number];
const iconEdit = require('../../assets/figma/suivi/icon-edit.png');
const iconCheckWhite = require('../../assets/figma/suivi/icon-check-white.png');
const iconCancelWhite = require('../../assets/figma/suivi/icon-cancel-white.png');
const iconMatin = require('../../assets/figma/suivi/icon-matin.png');
const iconMidi = require('../../assets/figma/suivi/icon-midi.png');
const iconCollation = require('../../assets/figma/suivi/icon-col.png');
const iconDinner = require('../../assets/figma/suivi/icon-din.png');
const iconLeft = require('../../assets/figma/suivi/left.png');
const iconRight = require('../../assets/figma/suivi/right.png');

type MealMeta = { label: string; icon: ReturnType<typeof require> };
const MEAL_META: Record<MealKey, MealMeta> = {
  breakfast: { label: 'Petit Déjeuner', icon: iconMatin },
  lunch: { label: 'Déjeuner', icon: iconMidi },
  snack: { label: 'Collation', icon: iconCollation },
  dinner: { label: 'Dîner', icon: iconDinner },
};

const SuiviScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<SuiviStackParamList, 'SuiviMain'>>();
  const scrollRef = useRef<ScrollView>(null);

  const [calorieGoal, setCalorieGoal] = useState(DEFAULT_CALORIE_GOAL);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<MealPlanEntry[]>([]);
  const [prevWeekEntries, setPrevWeekEntries] = useState<MealPlanEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthEntries, setMonthEntries] = useState<MealPlanEntry[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(auth.currentUser?.photoURL ?? null);
  const hasLoadedOnceRef = useRef(false);
  const todayStr = toDateString(new Date());

  const loadProfile = useCallback(async () => {
    const profile = await getUserProfile();
    if (profile?.calorieGoal != null && profile.calorieGoal > 0) {
      setCalorieGoal(profile.calorieGoal);
      setGoalInput(String(profile.calorieGoal));
    } else {
      setGoalInput(String(DEFAULT_CALORIE_GOAL));
    }
    if (profile?.avatarUrl) setAvatarUrl(profile.avatarUrl);
    else if (auth.currentUser?.photoURL) setAvatarUrl(auth.currentUser.photoURL);
  }, []);

  const loadWeek = useCallback(async () => {
    const end = addDays(weekStart, 6);
    const [current, prev] = await Promise.all([
      getMealPlansForDateRange(weekStart, end),
      getMealPlansForDateRange(addDays(weekStart, -7), addDays(weekStart, -1)),
    ]);
    setEntries(current);
    setPrevWeekEntries(prev);
  }, [weekStart]);

  const loadToday = useCallback(async () => {
    const data = await getMealPlansForDay(todayStr);
    setTodayEntries(data);
  }, [todayStr]);

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
        if (!hasLoadedOnceRef.current) {
          setLoading(true);
          await loadProfile();
          if (!cancelled) await Promise.all([loadWeek(), loadToday(), loadMonth()]);
          if (!cancelled) setLoading(false);
          hasLoadedOnceRef.current = true;
          return;
        }
        await Promise.all([loadProfile(), loadWeek(), loadToday(), loadMonth()]);
      })();
      return () => { cancelled = true; };
    }, [loadProfile, loadWeek, loadToday, loadMonth]),
  );

  useEffect(() => { loadWeek(); }, [weekStart]);
  useEffect(() => { loadToday(); }, [todayStr]);
  useEffect(() => { loadMonth(); }, [monthCursor]);

  useEffect(() => {
    if (!route.params?.reTapToken) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    Promise.all([loadProfile(), loadWeek(), loadToday(), loadMonth()]);
  }, [route.params?.reTapToken, loadProfile, loadWeek, loadToday, loadMonth]);

  const persistGoal = async (): Promise<boolean> => {
    const n = parseInt(goalInput, 10);
    if (isNaN(n) || n < 500 || n > 10000) {
      Alert.alert('Objectif invalide', 'Saisis un nombre entre 500 et 10 000 kcal.');
      return false;
    }
    setCalorieGoal(n);
    try {
      await updateUserProfile({ calorieGoal: n });
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'objectif.');
      return false;
    }
    return true;
  };

  const saveGoal = async () => {
    const ok = await persistGoal();
    if (ok) setEditingGoal(false);
  };

  const byDate = groupEntriesByDate(entries);
  const weekDays = getWeekDays(weekStart);
  const selectedDayEntries = byDate.get(selectedDate) ?? [];

  const todayConsumed = totalCalories(todayEntries, true);
  const todayPlanned = totalCalories(todayEntries, false);
  const todayGoalPct = calorieGoal > 0 ? Math.min(1, todayConsumed / calorieGoal) : 0;
  const todayGoalPctDisplay = Math.round(todayGoalPct * 100);

  const weekLabel = useMemo(() => {
    const start = new Date(weekStart);
    const end = addDays(weekStart, 6);
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(start);
    const endMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(end);
    if (startMonth === endMonth) return `${startDay} – ${endDay} ${startMonth}`;
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  }, [weekStart]);

  const selectedDayDetails = useMemo(() => {
    return MEAL_ORDER.map((mealType) => {
      const entriesForType = selectedDayEntries.filter((e) => e.mealType === mealType);
      const calories = entriesForType.reduce((sum, e) => sum + e.calories, 0);
      const recipeNames = entriesForType
        .map((e) => e.recipeTitle)
        .filter(Boolean)
        .slice(0, 2)
        .join(', ');

      return {
        mealType,
        calories,
        subtitle:
          recipeNames.length > 0
            ? recipeNames
            : mealType === 'dinner' && selectedDate > todayStr
              ? 'À planifier'
              : 'Aucun repas enregistré',
        isPlannedOnly: entriesForType.length > 0 && entriesForType.every((e) => e.status === 'planned'),
        hasData: entriesForType.length > 0,
      };
    });
  }, [selectedDayEntries, selectedDate, todayStr]);

  const selectedDayConsumed = totalCalories(selectedDayEntries, true);
  const selectedDayLabel = useMemo(() => {
    const d = new Date(selectedDate);
    const dayName = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
    const dayNum = d.getDate();
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(d);
    return `Détails du ${dayName} ${dayNum} ${month}`.toUpperCase();
  }, [selectedDate]);

  const markedDates = useMemo(() => {
    const map: Record<string, { dots?: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }> = {};
    const byDateMonth = groupEntriesByDate(monthEntries);
    for (const [dateStr, list] of byDateMonth.entries()) {
      const hasPlanned = list.some((e) => e.status === 'planned');
      const hasCompleted = list.some((e) => e.status === 'completed');
      const dots: { key: string; color: string }[] = [];
      if (hasPlanned) dots.push({ key: 'planned', color: '#004d99' });
      if (hasCompleted) dots.push({ key: 'completed', color: '#43a047' });
      map[dateStr] = { dots };
    }
    map[selectedDate] = { ...(map[selectedDate] ?? {}), selected: true, selectedColor: '#d6e3ff' };
    return map;
  }, [monthEntries, selectedDate]);

  const avatarInitial = useMemo(() => {
    const user = auth.currentUser;
    const raw = (user?.displayName ?? user?.email ?? '').trim();
    if (!raw) return '?';
    return (raw.includes('@') ? raw.split('@')[0] : raw).charAt(0).toUpperCase();
  }, [auth.currentUser?.displayName, auth.currentUser?.email]);

  const navigateToProfile = () => {
    const parent = navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
    parent?.navigate('Profil', undefined);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#004d99" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Suivi nutritionnel</Text>
        <TouchableOpacity style={styles.avatarBtn} onPress={navigateToProfile} activeOpacity={0.8}>
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
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Hero KPI Card ── */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiTop}>
            <View style={styles.kpiLeft}>
              <Text style={styles.kpiLabel}>Objectif Quotidien</Text>
              {editingGoal ? (
                <View style={styles.kpiEditRow}>
                  <TextInput
                    style={styles.kpiInput}
                    value={goalInput}
                    onChangeText={setGoalInput}
                    keyboardType="number-pad"
                    autoFocus
                    selectTextOnFocus
                  />
                  <Text style={styles.kpiUnit}>kcal</Text>
                  <TouchableOpacity style={styles.kpiSaveBtn} onPress={saveGoal}>
                    <Image source={iconCheckWhite} style={styles.kpiActionIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.kpiSaveBtn, styles.kpiCancelBtn]} onPress={() => setEditingGoal(false)}>
                    <Image source={iconCancelWhite} style={styles.kpiActionIcon} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.kpiNumberRow}>
                  <Text style={styles.kpiNumber}>{calorieGoal.toLocaleString('fr-FR')}</Text>
                  <Text style={styles.kpiUnit}>kcal</Text>
                </View>
              )}
            </View>
            {!editingGoal && (
              <TouchableOpacity
                style={styles.kpiEditBtn}
                onPress={() => { setGoalInput(String(calorieGoal)); setEditingGoal(true); }}
                activeOpacity={0.8}
              >
                <Image source={iconEdit} style={styles.kpiEditIcon} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.kpiProgressRow}>
            <View style={styles.kpiProgressTrack}>
              <View style={[styles.kpiProgressFill, { width: `${todayGoalPct * 100}%` as any }]} />
            </View>
            <Text style={styles.kpiPct}>{todayGoalPctDisplay}%</Text>
          </View>

          <Text style={styles.kpiConsumedHint}>
            {todayConsumed.toLocaleString('fr-FR')} consommés
            {todayPlanned > 0 ? ` · ${todayPlanned.toLocaleString('fr-FR')} prévus` : ''}
          </Text>
        </View>

        {/* ── Segmented control ── */}
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'week' && styles.segmentBtnActive]}
            onPress={() => setViewMode('week')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, viewMode === 'week' && styles.segmentTextActive]}>Semaine</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'month' && styles.segmentBtnActive]}
            onPress={() => setViewMode('month')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, viewMode === 'month' && styles.segmentTextActive]}>Mois</Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'week' ? (
          <>
            {/* ── Week header ── */}
            <View style={styles.weekHeader}>
              <Text style={styles.weekTitle}>Aperçu Hebdomadaire</Text>
              <View style={styles.weekNavRow}>
                <TouchableOpacity onPress={() => setWeekStart((d) => addDays(d, -7))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Image source={iconLeft} style={styles.weekSwitchIcon} />
                </TouchableOpacity>
                <Text style={styles.weekLabel}>{weekLabel}</Text>
                <TouchableOpacity onPress={() => setWeekStart((d) => addDays(d, 7))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Image source={iconRight} style={styles.weekSwitchIcon} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Day pills ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
              {weekDays.map(({ dateString }) => {
                const d = new Date(dateString);
                const dayAbbr = DAY_ABBR[d.getDay()];
                const dayNum = d.getDate();
                const today = selectedDate === dateString;
                return (
                  <TouchableOpacity
                    key={dateString}
                    style={[styles.pill, today && styles.pillActive]}
                    onPress={() => setSelectedDate(dateString)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.pillDayAbbr, today && styles.pillTextActive]}>{dayAbbr}</Text>
                    <Text style={[styles.pillDayNum, today && styles.pillTextActive]}>{dayNum}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.selectedHeader}>
              <Text style={styles.selectedHeaderTitle}>{selectedDayLabel}</Text>
              <Text style={styles.selectedHeaderKcal}>
                {selectedDayConsumed.toLocaleString('fr-FR')} / {calorieGoal.toLocaleString('fr-FR')} kcal
              </Text>
            </View>
            <View style={styles.detailList}>
              {selectedDayDetails.map((item) => {
                const isLunch = item.mealType === 'lunch';
                const isPlannedMeal = item.isPlannedOnly;
                return (
                  <TouchableOpacity
                    key={item.mealType}
                    style={[
                      styles.mealCard,
                      isLunch && styles.mealCardActive,
                      isPlannedMeal && styles.mealCardPlanned,
                    ]}
                    onPress={() => navigation.navigate('DayDetail', { date: selectedDate })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.mealCardLeft}>
                      <View style={[styles.mealIconWrap, isLunch && styles.mealIconWrapActive, isPlannedMeal && styles.mealIconWrapPlanned]}>
                        <Image
                          source={MEAL_META[item.mealType].icon}
                          style={[styles.mealTypeIcon, isPlannedMeal && styles.mealTypeIconPlanned]}
                        />
                      </View>
                      <View style={styles.mealTextWrap}>
                        <Text style={[styles.mealLabel, isPlannedMeal && styles.mealLabelPlanned]}>
                          {MEAL_META[item.mealType].label}
                        </Text>
                        <Text style={[styles.mealSubtitle, isPlannedMeal && styles.mealSubtitlePlanned]} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.mealKcalWrap}>
                      <Text style={[styles.mealKcal, isPlannedMeal && styles.mealLabelPlanned]}>
                        {item.hasData ? item.calories.toLocaleString('fr-FR') : '—'}
                      </Text>
                      <Text style={[styles.mealKcalUnit, isPlannedMeal && styles.mealSubtitlePlanned]}>KCAL</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <View style={styles.calendarCard}>
              <Calendar
                current={toDateString(monthCursor)}
                firstDay={1}
                hideExtraDays
                enableSwipeMonths
                markingType="multi-dot"
                markedDates={markedDates as any}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                onMonthChange={(m) => setMonthCursor(new Date(m.year, m.month - 1, 1))}
                theme={{
                  todayTextColor: '#004d99',
                  selectedDayTextColor: '#004d99',
                  arrowColor: '#004d99',
                  textSectionTitleColor: '#424752',
                  monthTextColor: '#1a1c1c',
                }}
              />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#004d99' }]} />
                  <Text style={styles.legendText}>Prévu</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#43a047' }]} />
                  <Text style={styles.legendText}>Consommé</Text>
                </View>
              </View>
            </View>

            <View style={styles.selectedHeader}>
              <Text style={styles.selectedHeaderTitle}>{selectedDayLabel}</Text>
              <Text style={styles.selectedHeaderKcal}>
                {selectedDayConsumed.toLocaleString('fr-FR')} / {calorieGoal.toLocaleString('fr-FR')} kcal
              </Text>
            </View>
            <View style={styles.detailList}>
              {selectedDayDetails.map((item) => {
                const isLunch = item.mealType === 'lunch';
                const isPlannedMeal = item.isPlannedOnly;
                return (
                  <TouchableOpacity
                    key={item.mealType}
                    style={[
                      styles.mealCard,
                      isLunch && styles.mealCardActive,
                      isPlannedMeal && styles.mealCardPlanned,
                    ]}
                    onPress={() => navigation.navigate('DayDetail', { date: selectedDate })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.mealCardLeft}>
                      <View style={[styles.mealIconWrap, isLunch && styles.mealIconWrapActive, isPlannedMeal && styles.mealIconWrapPlanned]}>
                        <Image
                          source={MEAL_META[item.mealType].icon}
                          style={[styles.mealTypeIcon, isPlannedMeal && styles.mealTypeIconPlanned]}
                        />
                      </View>
                      <View style={styles.mealTextWrap}>
                        <Text style={[styles.mealLabel, isPlannedMeal && styles.mealLabelPlanned]}>
                          {MEAL_META[item.mealType].label}
                        </Text>
                        <Text style={[styles.mealSubtitle, isPlannedMeal && styles.mealSubtitlePlanned]} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.mealKcalWrap}>
                      <Text style={[styles.mealKcal, isPlannedMeal && styles.mealLabelPlanned]}>
                        {item.hasData ? item.calories.toLocaleString('fr-FR') : '—'}
                      </Text>
                      <Text style={[styles.mealKcalUnit, isPlannedMeal && styles.mealSubtitlePlanned]}>KCAL</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 24,
  },
  /* ── KPI Hero Card ── */
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 2,
    gap: 16,
  },
  kpiTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  kpiLeft: {
    gap: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#424752',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    fontWeight: '500',
  },
  kpiNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  kpiNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1a1c1c',
    letterSpacing: -2.4,
    lineHeight: 56,
  },
  kpiUnit: {
    fontSize: 16,
    color: '#424752',
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  kpiEditBtn: {
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    padding: 8,
  },
  kpiEditIcon: {
    width: 15,
    height: 15,
    resizeMode: 'contain',
    tintColor: '#424752',
  },
  kpiEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  kpiInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1c1c',
    borderBottomWidth: 2,
    borderBottomColor: '#004d99',
    minWidth: 100,
    padding: 0,
  },
  kpiSaveBtn: {
    backgroundColor: '#004d99',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiCancelBtn: {
    backgroundColor: '#9CA3AF',
  },
  kpiActionIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  kpiProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kpiProgressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E2E2',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  kpiProgressFill: {
    height: '100%',
    backgroundColor: '#004d99',
    borderRadius: 9999,
  },
  kpiPct: {
    fontSize: 12,
    color: '#004d99',
    fontWeight: '600',
    minWidth: 34,
    textAlign: 'right',
  },
  kpiConsumedHint: {
    fontSize: 12,
    color: '#727783',
    marginTop: -8,
  },
  /* ── Segmented control ── */
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E8E8E8',
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    color: '#424752',
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#004d99',
    fontWeight: '600',
  },
  /* ── Week header ── */
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekLabel: {
    fontSize: 13,
    color: '#424752',
    fontWeight: '500',
  },
  weekSwitchIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: '#004d99',
  },
  /* ── Day pills ── */
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    width: 56,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    gap: 6,
  },
  pillActive: {
    backgroundColor: '#004d99',
  },
  pillDayAbbr: {
    fontSize: 10,
    color: '#424752',
    textTransform: 'uppercase',
    fontWeight: '500',
    opacity: 0.6,
  },
  pillDayNum: {
    fontSize: 18,
    color: '#424752',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFFFFF',
    opacity: 1,
  },
  /* ── Detail list ── */
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  selectedHeaderTitle: {
    fontSize: 14,
    color: '#004d99',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: '600',
  },
  selectedHeaderKcal: {
    fontSize: 12,
    color: '#424752',
    fontWeight: '500',
  },
  detailList: {
    gap: 12,
  },
  mealCard: {
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealCardActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(0,77,153,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    padding: 18,
  },
  mealCardPlanned: {
    opacity: 0.75,
  },
  mealCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
    minWidth: 0,
  },
  mealTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  mealIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealIconWrapActive: {
    backgroundColor: '#D6E3FF',
  },
  mealIconWrapPlanned: {
    backgroundColor: '#E2E2E2',
  },
  mealTypeIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#004d99',
  },
  mealTypeIconPlanned: {
    tintColor: '#6B7280',
  },
  mealLabel: {
    fontSize: 14,
    color: '#1a1c1c',
    fontWeight: '600',
    flexShrink: 1,
  },
  mealLabelPlanned: {
    color: '#424752',
  },
  mealSubtitle: {
    fontSize: 12,
    color: '#424752',
    marginTop: 1,
    flexShrink: 1,
  },
  mealSubtitlePlanned: {
    color: '#6B7280',
    fontStyle: 'italic',
  },
  mealKcalWrap: {
    alignItems: 'flex-end',
    marginLeft: 8,
    flexShrink: 0,
    minWidth: 56,
  },
  mealKcal: {
    fontSize: 28,
    color: '#1a1c1c',
    fontWeight: '700',
    lineHeight: 28,
  },
  mealKcalUnit: {
    fontSize: 10,
    color: '#424752',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  /* ── Calendar (month view) ── */
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#424752',
  },
});

export default SuiviScreen;
