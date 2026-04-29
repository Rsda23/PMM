import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { User } from 'firebase/auth';
import { subscribeToAuthState } from './src/services/firebase/auth';
import { preloadAppAssets } from './src/assets/preloadAssets';
import Navbar from './src/components/Navbar';
import AuthStack from './src/navigation/AuthStack';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    preloadAppAssets()
      .catch((e) => {
        console.warn('Asset preload failed:', e);
      })
      .finally(() => {
        setAssetsReady(true);
      });

    const timer = setTimeout(() => {
      try {
        unsubscribe = subscribeToAuthState((u) => {
          setUser(u);
          setAuthReady(true);
        });
      } catch (e) {
        console.warn('Auth subscription failed:', e);
        setAuthReady(true);
      }
    }, 100);
    return () => {
      clearTimeout(timer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (!authReady || !assetsReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1565c0" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
          <StatusBar style="dark" />
          <NavigationContainer>
            {user ? <Navbar /> : <AuthStack />}
          </NavigationContainer>
        </SafeAreaView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});