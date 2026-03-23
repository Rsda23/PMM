import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import RecipesStack, { type RecipesStackParamList } from '../navigation/RecipesStack';
import SuiviStack, { type SuiviStackParamList } from '../navigation/SuiviStack';
import ProfileScreen from '../screens/ProfileScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';

export type RootTabParamList = {
  Accueil: { reTapToken?: number } | undefined;
  Recettes: NavigatorScreenParams<RecipesStackParamList>;
  Suivi: NavigatorScreenParams<SuiviStackParamList>;
  Profil: { reTapToken?: number } | undefined;
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
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const isActive = navigation.isFocused();
            if (!isActive) return;
            e.preventDefault();
            navigation.navigate('Accueil', { reTapToken: Date.now() });
          },
        })}
      />
      <Tab.Screen
        name="Recettes"
        component={RecipesStack}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const isActive = navigation.isFocused();
            if (!isActive) return;
            e.preventDefault();
            navigation.navigate('Recettes', {
              screen: 'Recipes',
              params: { reTapToken: Date.now() },
            });
          },
        })}
      />
      <Tab.Screen
        name="Suivi"
        component={SuiviStack}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const isActive = navigation.isFocused();
            if (!isActive) return;
            e.preventDefault();
            navigation.navigate('Suivi', {
              screen: 'SuiviMain',
              params: { reTapToken: Date.now() },
            });
          },
        })}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            const isActive = navigation.isFocused();
            if (!isActive) return;
            e.preventDefault();
            navigation.navigate('Profil', { reTapToken: Date.now() });
          },
        })}
      />
    </Tab.Navigator>
  );
};

export default Navbar;
