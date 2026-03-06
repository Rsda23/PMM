import React, { useEffect, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuiviStackParamList } from '../navigation/SuiviStack';
import { getAllRecipes, type Recipe } from '../services/api/recipesApi';
import { addMealPlan, MEAL_TYPE_LABELS, type MealType } from '../services/api/mealPlansApi';
import { formatDayLong } from '../utils/dateUtils';

type Props = NativeStackScreenProps<SuiviStackParamList, 'AddMeal'>;

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

const AddMealScreen: React.FC<Props> = ({ route, navigation }) => {
  const { date, mealType: initialMealType } = route.params;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    initialMealType ?? 'lunch',
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllRecipes().then(setRecipes).finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(search.trim().toLowerCase()) ||
          r.tags.some((t) => t.toLowerCase().includes(search.trim().toLowerCase())),
      )
    : recipes;

  const toggleRecipe = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasSelection = selectedIds.size > 0;

  const handleAddSelected = async () => {
    const toAdd = recipes.filter((r) => selectedIds.has(r.id));
    if (toAdd.length === 0) return;
    setSaving(true);
    try {
      const promises = toAdd.map((recipe) =>
        addMealPlan({
          date,
          mealType: selectedMealType,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          calories: recipe.calories,
        }),
      );
      await Promise.all(promises);
      navigation.goBack();
    } catch (e) {
      console.warn('addMealPlan error:', e);
      Alert.alert('Erreur', 'Impossible d\'ajouter les repas.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1565c0" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Ajouter un repas</Text>
        <Text style={styles.dateLabel}>{formatDayLong(date)}</Text>

        <Text style={styles.label}>Type de repas</Text>
        <View style={styles.mealTypeRow}>
          {MEAL_TYPES.map((mt) => (
            <TouchableOpacity
              key={mt}
              style={[styles.mealTypeBtn, selectedMealType === mt && styles.mealTypeBtnActive]}
              onPress={() => setSelectedMealType(mt)}
            >
              <Text
                style={[
                  styles.mealTypeBtnText,
                  selectedMealType === mt && styles.mealTypeBtnTextActive,
                ]}
              >
                {MEAL_TYPE_LABELS[mt]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Choisir une ou plusieurs recettes</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#999"
        />

        {filtered.length === 0 ? (
          <Text style={styles.empty}>Aucune recette trouvée.</Text>
        ) : (
          filtered.map((recipe) => {
            const isSelected = selectedIds.has(recipe.id);
            return (
              <TouchableOpacity
                key={recipe.id}
                style={[styles.recipeRow, isSelected && styles.recipeRowSelected]}
                onPress={() => toggleRecipe(recipe.id)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={[styles.recipeTitle, isSelected && styles.recipeTitleSelected]}>
                  {recipe.title}
                </Text>
                <View style={styles.recipeRight}>
                  <Text style={[styles.recipeKcal, isSelected && styles.recipeKcalSelected]}>
                    {recipe.calories} kcal
                  </Text>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {hasSelection && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.addSelectedButton, saving && styles.addSelectedButtonDisabled]}
            onPress={handleAddSelected}
            disabled={saving}
          >
            <Text style={styles.addSelectedButtonText}>
              {saving
                ? 'Ajout en cours…'
                : `Ajouter ${selectedIds.size} recette${selectedIds.size > 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 16,
    paddingBottom: 100,
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  mealTypeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  mealTypeBtnActive: {
    backgroundColor: '#1565c0',
  },
  mealTypeBtnText: {
    fontSize: 14,
    color: '#333',
  },
  mealTypeBtnTextActive: {
    color: '#fff',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  recipeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
  },
  recipeRowSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1565c0',
  },
  recipeTitle: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  recipeTitleSelected: {
    fontWeight: '600',
    color: '#0d47a1',
  },
  recipeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recipeKcal: {
    fontSize: 14,
    color: '#666',
  },
  recipeKcalSelected: {
    color: '#1565c0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#1565c0',
    borderColor: '#1565c0',
  },
  checkIcon: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addSelectedButton: {
    backgroundColor: '#1565c0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addSelectedButtonDisabled: {
    opacity: 0.7,
  },
  addSelectedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    fontSize: 14,
    color: '#999',
    paddingVertical: 20,
  },
});

export default AddMealScreen;
