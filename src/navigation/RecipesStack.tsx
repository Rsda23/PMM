import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import RecipesScreen from '../screens/RecipesScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import CreateRecipeScreen from '../screens/CreateRecipeScreen';
import type { Recipe } from '../services/api/recipesApi';

export type RecipesStackParamList = {
  Recipes: undefined;
  RecipeDetail: Recipe;
  CreateRecipe: { recipe?: Recipe } | undefined;
};

const Stack = createNativeStackNavigator<RecipesStackParamList>();

const RecipesStack = () => {
  const navigation = useNavigation();
  const parent = navigation.getParent();

  useEffect(() => {
    if (!parent) return;
    const unsubscribe = parent.addListener('tabPress', () => {
      navigation.navigate('Recipes');
    });
    return unsubscribe;
  }, [parent, navigation]);

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
