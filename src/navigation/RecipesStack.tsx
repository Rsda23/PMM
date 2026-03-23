import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RecipesScreen from '../screens/RecipesScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import CreateRecipeScreen from '../screens/CreateRecipeScreen';
import type { Recipe } from '../services/api/recipesApi';

export type RecipesStackParamList = {
  Recipes: { reTapToken?: number } | undefined;
  RecipeDetail: Recipe;
  CreateRecipe: { recipe?: Recipe } | undefined;
};

const Stack = createNativeStackNavigator<RecipesStackParamList>();

const RecipesStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Recipes" component={RecipesScreen} />
      <Stack.Screen
        name="CreateRecipe"
        component={CreateRecipeScreen}
      />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
      />
    </Stack.Navigator>
  );
};

export default RecipesStack;
