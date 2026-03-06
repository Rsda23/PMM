import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RecipeCard from '../components/RecipeCard';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import { getAllRecipes, type Recipe } from '../services/api/recipesApi';
import { useUserStore } from '../store/userStore';

type RecipesScreenNavigationProp = NativeStackNavigationProp<
  RecipesStackParamList,
  'Recipes'
>;

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
  const navigation = useNavigation<RecipesScreenNavigationProp>();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const objective = useUserStore((state) => state.objective);
  const favoriteRecipeIds = useUserStore((state) => state.favoriteRecipeIds);

  const loadRecipes = async () => {
    const data = await getAllRecipes();
    setRecipes(data);
  };

  useEffect(() => { loadRecipes(); }, []);
  useFocusEffect(React.useCallback(() => { loadRecipes(); }, []));

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

  const renderRecipeCard = (recipe: Recipe) => (
    <RecipeCard
      key={recipe.id}
      id={recipe.id}
      title={recipe.title}
      calories={recipe.calories}
      tags={recipe.tags}
      image={recipe.image}
      onPress={() => navigation.navigate('RecipeDetail', recipe)}
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Rechercher une recette ou un tag..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#999"
      />

      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Recettes</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateRecipe')}
        >
          <Text style={styles.createButtonText}>+ Créer</Text>
        </TouchableOpacity>
      </View>

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
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.resultCount}>
        {displayedRecipes.length} recette{displayedRecipes.length !== 1 ? 's' : ''}
      </Text>

      {displayedRecipes.length === 0 ? (
        <Text style={styles.emptySection}>Aucune recette ne correspond à ce filtre.</Text>
      ) : (
        displayedRecipes.map(renderRecipeCard)
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  searchBar: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#1565c0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#1565c0',
    borderColor: '#1565c0',
  },
  filterChipText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  resultCount: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  emptySection: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});

export default RecipesScreen;
