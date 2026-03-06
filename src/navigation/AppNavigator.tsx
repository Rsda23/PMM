import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import RecipesScreen from '../screens/RecipesScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { Recipe } from '../services/api/recipesApi';

export type RootStackParamList = {
  Home: undefined;
  Recipes: undefined;
  RecipeDetail: Recipe;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Stack.Screen name="Recipes" component={RecipesScreen} options={{ title: 'Recettes' }} />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{ title: 'Détail recette' }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Stack.Navigator>
  );
};

export default AppNavigator;

