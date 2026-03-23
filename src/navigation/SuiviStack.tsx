import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SuiviScreen from '../screens/SuiviScreen';
import DayDetailScreen from '../screens/DayDetailScreen';
import AddMealScreen from '../screens/AddMealScreen';

export type SuiviStackParamList = {
  SuiviMain: { reTapToken?: number } | undefined;
  DayDetail: { date: string }; // "YYYY-MM-DD"
  AddMeal: { date: string; mealType?: import('../services/api/mealPlansApi').MealType };
};

const Stack = createNativeStackNavigator<SuiviStackParamList>();

const SuiviStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuiviMain" component={SuiviScreen} />
      <Stack.Screen name="DayDetail" component={DayDetailScreen} />
      <Stack.Screen name="AddMeal" component={AddMealScreen} />
    </Stack.Navigator>
  );
};

export default SuiviStack;
