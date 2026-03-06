import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import RecipesStack, { type RecipesStackParamList } from '../navigation/RecipesStack';
import SuiviStack from '../navigation/SuiviStack';
import ProfileScreen from '../screens/ProfileScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';

export type RootTabParamList = {
  Accueil: undefined;
  Recettes: NavigatorScreenParams<RecipesStackParamList>;
  Suivi: undefined;
  Profil: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const Navbar = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const name =
            route.name === 'Accueil'
              ? 'home'
              : route.name === 'Recettes'
                ? 'book'
                : route.name === 'Suivi'
                  ? 'stats-chart'
                  : 'person';
          return <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1565c0',
        tabBarInactiveTintColor: '#666',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} />
      <Tab.Screen name="Recettes" component={RecipesStack} />
      <Tab.Screen name="Suivi" component={SuiviStack} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default Navbar;
