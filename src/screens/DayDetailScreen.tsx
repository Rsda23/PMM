import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { SuiviStackParamList } from '../navigation/SuiviStack';
import {
  deleteMealPlan,
  getMealPlansForDay,
  MEAL_TYPE_LABELS,
  totalCalories,
  updateMealPlanStatus,
  type MealPlanEntry,
  type MealType,
} from '../services/api/mealPlansApi';
import { auth } from '../services/firebase/firebaseConfig';
import { getUserProfile } from '../services/api/userProfileApi';

const iconCheckWhite = require('../../assets/figma/suivi/icon-check-white.png');
const iconPlusWhite = require('../../assets/figma/home/icon-plus-white.png');
const iconPlusBlue = require('../../assets/figma/home/icon-plus-blue.png');
const iconTrash = require('../../assets/figma/home/icon-trash.png');
const iconArrowBack = require('../../assets/figma/profil/arrow-back.png');

type Props = NativeStackScreenProps<SuiviStackParamList, 'DayDetail'>;

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

const DayDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { date } = route.params;
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(auth.currentUser?.photoURL ?? null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [profile, dayEntries] = await Promise.all([getUserProfile(), getMealPlansForDay(date)]);
    if (profile?.calorieGoal && profile.calorieGoal > 0) setCalorieGoal(profile.calorieGoal);
    setAvatarUrl(profile?.avatarUrl ?? auth.currentUser?.photoURL ?? null);
    setEntries(dayEntries);
    setLoading(false);
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const byType = useMemo(() => {
    const map = new Map<MealType, MealPlanEntry[]>();
    for (const e of entries) {
      const list = map.get(e.mealType) ?? [];
      list.push(e);
      map.set(e.mealType, list);
    }
    return map;
  }, [entries]);

  const consumedTotal = totalCalories(entries, true);
  const consumedRatio = calorieGoal > 0 ? Math.min(consumedTotal / calorieGoal, 1) : 0;
  const consumedEntries = useMemo(
    () => entries.filter((entry) => entry.status === 'completed'),
    [entries],
  );

  const macroKcal = useMemo(() => {
    let carbs = 0;
    let fats = 0;
    let proteins = 0;
    let unknown = 0;

    for (const entry of consumedEntries) {
      const c = Math.max(entry.carbs ?? 0, 0);
      const f = Math.max(entry.fats ?? 0, 0);
      const p = Math.max(entry.protein ?? 0, 0);

      const entryKnown = c * 4 + f * 9 + p * 4;
      const entryUnknown = Math.max((entry.calories ?? 0) - entryKnown, 0);

      carbs += c * 4;
      fats += f * 9;
      proteins += p * 4;
      unknown += entryUnknown;
    }

    const total = Math.max(carbs + fats + proteins + unknown, 1);
    return { carbs, fats, proteins, unknown, total };
  }, [consumedEntries]);

  const macroGrams = useMemo(
    () => ({
      carbs: Math.round(macroKcal.carbs / 4),
      fats: Math.round(macroKcal.fats / 9),
      proteins: Math.round(macroKcal.proteins / 4),
      unknown: Math.round(macroKcal.unknown),
    }),
    [macroKcal],
  );

  const displayDate = useMemo(() => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [date]);

  const avatarInitial = useMemo(() => {
    const raw = (auth.currentUser?.displayName ?? auth.currentUser?.email ?? '').trim();
    if (!raw) return '?';
    return (raw.includes('@') ? raw.split('@')[0] : raw).charAt(0).toUpperCase();
  }, [auth.currentUser?.displayName, auth.currentUser?.email]);

  const handleToggleStatus = async (entry: MealPlanEntry) => {
    try {
      const next = entry.status === 'completed' ? 'planned' : 'completed';
      await updateMealPlanStatus(entry.id, next);
      load();
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier ce repas.');
    }
  };

  const handleDelete = (entry: MealPlanEntry) => {
    Alert.alert('Supprimer le repas', `Retirer « ${entry.recipeTitle} » de cette journée ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMealPlan(entry.id);
            load();
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer ce repas.');
          }
        },
      },
    ]);
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
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <Image source={iconArrowBack} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{displayDate}</Text>
        </View>
        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.avatarBtn}
            activeOpacity={0.8}
            onPress={() => navigation.getParent()?.navigate('Profil', undefined)}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>Calories consommées</Text>
              <Text style={styles.summaryMain}>{consumedTotal.toLocaleString('fr-FR')}</Text>
            </View>
            <View style={styles.summaryGoalWrap}>
              <Text style={styles.summaryGoalLabel}>Objectif</Text>
              <Text style={styles.summaryGoalValue}>
                {calorieGoal.toLocaleString('fr-FR')} <Text style={styles.summaryGoalUnit}>kcal</Text>
              </Text>
            </View>
          </View>

          <View style={styles.macroTrack}>
            <View style={[styles.macroFillWrap, { width: `${consumedRatio * 100}%` }]}>
            <View style={[styles.macroPartProteins, { flex: macroKcal.proteins / macroKcal.total }]} />
            <View style={[styles.macroPartCarbs, { flex: macroKcal.carbs / macroKcal.total }]} />
            <View style={[styles.macroPartFats, { flex: macroKcal.fats / macroKcal.total }]} />
              <View style={[styles.macroPartUnknown, { flex: macroKcal.unknown / macroKcal.total }]} />
            </View>
          </View>

          <View style={styles.macroLegend}>
            <Text style={[styles.macroLegendText, styles.macroLegendCarbs]}>● Glucides {macroGrams.carbs}g</Text>
            <Text style={[styles.macroLegendText, styles.macroLegendFats]}>● Lipides {macroGrams.fats}g</Text>
            <Text style={[styles.macroLegendText, styles.macroLegendProteins]}>● Protéines {macroGrams.proteins}g</Text>
            {macroGrams.unknown > 0 ? (
              <Text style={[styles.macroLegendText, styles.macroLegendUnknown]}>● Non indiqué {macroGrams.unknown} kcal</Text>
            ) : null}
          </View>

        </View>

        {MEAL_ORDER.map((mealType) => {
          const list = byType.get(mealType) ?? [];
          const slotKcal = list.reduce((sum, e) => sum + e.calories, 0);

          if (list.length === 0) {
            return (
              <TouchableOpacity
                key={mealType}
                style={styles.mealEmptySlot}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AddMeal', { date, mealType })}
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
                    onPress={() => navigation.navigate('AddMeal', { date, mealType })}
                  >
                    <Image source={iconPlusBlue} style={styles.mealSlotAddIcon} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.mealKcal}>{slotKcal} kcal</Text>
              </View>
              {list.map((entry) => {
                const checked = entry.status === 'completed';
                return (
                  <View key={entry.id} style={styles.mealRow}>
                    <TouchableOpacity
                      style={[styles.checkCircle, checked && styles.checkCircleDone]}
                      onPress={() => handleToggleStatus(entry)}
                    >
                      {checked && <Image source={iconCheckWhite} style={styles.checkIcon} />}
                    </TouchableOpacity>
                    <Text style={styles.mealTitle} numberOfLines={1} ellipsizeMode="tail">
                      {entry.recipeTitle}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDelete(entry)}
                      style={styles.mealDeleteBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Image source={iconTrash} style={styles.trashIcon} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9F9F9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
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
  topTitle: { fontSize: 18, fontWeight: '700', color: '#18181B', flexShrink: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  avatarImg: { width: 40, height: 40, resizeMode: 'cover' },
  avatarInitial: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 30, gap: 24 },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#424752',
  },
  summaryMain: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
    color: '#1A1C1C',
    letterSpacing: -2.4,
  },
  summaryGoalWrap: { alignItems: 'flex-end', paddingBottom: 6 },
  summaryGoalLabel: {
    fontSize: 12,
    color: '#424752',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  summaryGoalValue: { marginTop: 2, fontSize: 20, color: '#004D99', fontWeight: '800' },
  summaryGoalUnit: { fontSize: 14, color: '#424752', fontWeight: '500' },
  macroTrack: {
    marginTop: 12,
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E2E2E2',
  },
  macroFillWrap: {
    height: '100%',
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
  },
  macroPartProteins: { backgroundColor: '#2563EB' },
  macroPartCarbs: { backgroundColor: '#F59E0B' },
  macroPartFats: { backgroundColor: '#16A34A' },
  macroPartUnknown: { backgroundColor: '#64748B' },
  macroLegend: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
    columnGap: 10,
  },
  macroLegendText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  macroLegendProteins: { color: '#2563EB' },
  macroLegendCarbs: { color: '#F59E0B' },
  macroLegendFats: { color: '#16A34A' },
  macroLegendUnknown: { color: '#64748B' },
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
  mealSlotAddIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  mealType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mealKcal: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
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
  checkIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  mealTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    marginRight: 6,
  },
  mealDeleteBtn: {
    padding: 4,
    flexShrink: 0,
  },
  trashIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
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
});

export default DayDetailScreen;
