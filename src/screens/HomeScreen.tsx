import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import RecipeCard from '../components/RecipeCard';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../components/Navbar';
import {
  getRecommendedRecipes,
  type Recipe,
} from '../services/api/recipesApi';
import { useUserStore } from '../store/userStore';

type HomeScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Accueil'>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [recommendedRecipes, setRecommendedRecipes] = useState<Recipe[]>([]);
  const objective = useUserStore((state) => state.objective);

  useEffect(() => {
    const loadRecipes = async () => {
      const data = await getRecommendedRecipes(objective);
      setRecommendedRecipes(data);
    };

    loadRecipes();
  }, [objective]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Accueil</Text>
      <Text style={styles.subtitle}>Recommandations pour toi</Text>

      {recommendedRecipes.map((recipe) => (
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
});

export default HomeScreen;

