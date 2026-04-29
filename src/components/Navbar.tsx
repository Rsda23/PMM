import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import RecipesStack, { type RecipesStackParamList } from '../navigation/RecipesStack';
import SuiviStack, { type SuiviStackParamList } from '../navigation/SuiviStack';
import ProfileScreen from '../screens/ProfileScreen';

const iconHome = require('../../assets/figma/navbar/tab-home.png');
const iconRecettes = require('../../assets/figma/navbar/tab-recettes.png');
const iconSuivi = require('../../assets/figma/navbar/tab-suivi.png');
const iconProfil = require('../../assets/figma/navbar/tab-profil.png');

const TAB_ICONS: Record<string, ReturnType<typeof require>> = {
  Accueil: iconHome,
  Recettes: iconRecettes,
  Suivi: iconSuivi,
  Profil: iconProfil,
};

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
        tabBarIcon: ({ focused }) => (
          <Image
            source={TAB_ICONS[route.name]}
            style={[styles.icon, { tintColor: focused ? '#1565C0' : '#9CA3AF' }]}
          />
        ),
        tabBarActiveTintColor: '#1565C0',
        tabBarInactiveTintColor: '#9CA3AF',
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
        options={{
          popToTopOnBlur: true,
        }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
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

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
});

export default Navbar;
