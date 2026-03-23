import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useUserStore } from '../store/userStore';
import { getAllRecipes, type Recipe } from '../services/api/recipesApi';
import { logout } from '../services/firebase/auth';
import { auth } from '../services/firebase/firebaseConfig';
import { getUserProfile, updateUserProfile } from '../services/api/userProfileApi';
import RecipeCard from '../components/RecipeCard';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../components/Navbar';

type ProfileScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Profil'>;

const OBJECTIVE_OPTIONS = [
  { key: 'perte_poids' as const, label: 'Perte de poids', icon: 'trending-down' },
  { key: 'prise_masse' as const, label: 'Prise de masse', icon: 'trending-up' },
  { key: 'equilibre' as const, label: 'Équilibré', icon: 'swap-horizontal' },
];

const ProfileScreen = () => {
  const objective = useUserStore((state) => state.objective);
  const setObjective = useUserStore((state) => state.setObjective);
  const favoriteRecipeIds = useUserStore((state) => state.favoriteRecipeIds);
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [calorieGoal, setCalorieGoal] = useState<string>('');
  const [calorieGoalSaving, setCalorieGoalSaving] = useState(false);

  const user = auth.currentUser;
  const email = user?.email ?? '';
  const initial = email ? email[0].toUpperCase() : '?';

  useFocusEffect(
    React.useCallback(() => {
      getUserProfile().then((p) => {
        if (p?.calorieGoal) setCalorieGoal(String(p.calorieGoal));
        else setCalorieGoal('2000');
      });
    }, []),
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (e) {
      console.warn('Déconnexion échouée:', e);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSaveCalories = async () => {
    const n = parseInt(calorieGoal, 10);
    if (isNaN(n) || n < 500 || n > 10000) {
      Alert.alert('Invalide', 'Entre 500 et 10 000 kcal.');
      return;
    }
    setCalorieGoalSaving(true);
    try {
      await updateUserProfile({ calorieGoal: n });
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer.');
    } finally {
      setCalorieGoalSaving(false);
    }
  };

  useEffect(() => {
    const loadFavorites = async () => {
      const all = await getAllRecipes();
      setFavoriteRecipes(all.filter((r) => favoriteRecipeIds.includes(r.id)));
    };
    loadFavorites();
  }, [favoriteRecipeIds]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* ── Avatar + infos ── */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.memberSince}>
          Membre depuis {user?.metadata.creationTime
            ? new Date(user.metadata.creationTime).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
            : '—'}
        </Text>
      </View>

      {/* ── Stats rapides ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="heart" size={20} color="#c62828" />
          <Text style={styles.statNumber}>{favoriteRecipeIds.length}</Text>
          <Text style={styles.statLabel}>Favoris</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="flame" size={20} color="#e65100" />
          <Text style={styles.statNumber}>{calorieGoal || '—'}</Text>
          <Text style={styles.statLabel}>kcal / jour</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="fitness" size={20} color="#1565c0" />
          <Text style={styles.statNumber}>
            {objective === 'perte_poids' ? 'Perte' : objective === 'prise_masse' ? 'Masse' : 'Équi.'}
          </Text>
          <Text style={styles.statLabel}>Objectif</Text>
        </View>
      </View>

      {/* ── Section Objectif ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Objectif nutritionnel</Text>
        <View style={styles.objectiveRow}>
          {OBJECTIVE_OPTIONS.map((opt) => {
            const active = objective === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.objectiveBtn, active && styles.objectiveBtnActive]}
                onPress={() => setObjective(opt.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={active ? opt.icon : `${opt.icon}-outline`}
                  size={22}
                  color={active ? '#fff' : '#1565c0'}
                />
                <Text style={[styles.objectiveBtnText, active && styles.objectiveBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Section Calories ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Objectif calorique journalier</Text>
        <View style={styles.calorieRow}>
          <TextInput
            style={styles.calorieInput}
            value={calorieGoal}
            onChangeText={setCalorieGoal}
            keyboardType="number-pad"
            placeholder="ex: 2500"
            placeholderTextColor="#999"
          />
          <Text style={styles.calorieUnit}>kcal / jour</Text>
          <TouchableOpacity
            style={[styles.calorieSaveBtn, calorieGoalSaving && styles.disabled]}
            disabled={calorieGoalSaving}
            onPress={handleSaveCalories}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Section Favoris ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recettes favorites</Text>
          <Text style={styles.sectionBadge}>{favoriteRecipes.length}</Text>
        </View>
        {favoriteRecipes.length === 0 ? (
          <View style={styles.emptyFavorites}>
            <Ionicons name="heart-outline" size={40} color="#ccc" />
            <Text style={styles.emptyFavoritesText}>Aucune recette en favori</Text>
            <Text style={styles.emptyFavoritesSub}>
              Appuie sur l'étoile d'une recette pour l'ajouter ici
            </Text>
          </View>
        ) : (
          favoriteRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              title={recipe.title}
              calories={recipe.calories}
              tags={recipe.tags}
              image={recipe.image}
              onPress={() => navigation.navigate('Recettes', { screen: 'RecipeDetail', params: recipe })}
            />
          ))
        )}
      </View>

      {/* ── Déconnexion ── */}
      <TouchableOpacity
        style={[styles.logoutButton, loggingOut && styles.disabled]}
        onPress={handleLogout}
        disabled={loggingOut}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={20} color="#c62828" />
        <Text style={styles.logoutButtonText}>
          {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1565c0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberSince: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
  },

  // ── Sections ──
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },

  // ── Objectif ──
  objectiveRow: {
    gap: 10,
  },
  objectiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  objectiveBtnActive: {
    backgroundColor: '#1565c0',
    borderColor: '#1565c0',
  },
  objectiveBtnText: {
    fontSize: 15,
    color: '#1565c0',
    fontWeight: '500',
  },
  objectiveBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // ── Calories ──
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calorieInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#fff',
  },
  calorieUnit: {
    fontSize: 14,
    color: '#666',
  },
  calorieSaveBtn: {
    backgroundColor: '#43a047',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },

  // ── Favoris vide ──
  emptyFavorites: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fafafa',
    borderRadius: 12,
  },
  emptyFavoritesText: {
    fontSize: 15,
    color: '#999',
    marginTop: 8,
  },
  emptyFavoritesSub: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
  },

  // ── Déconnexion ──
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c62828',
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c62828',
  },
});

export default ProfileScreen;
