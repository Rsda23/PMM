import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { User } from 'firebase/auth';
import { subscribeToAuthState } from './src/services/firebase/auth';
import Navbar from './src/components/Navbar';
import AuthStack from './src/navigation/AuthStack';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const timer = setTimeout(() => {
      try {
        unsubscribe = subscribeToAuthState((u) => {
          setUser(u);
          setLoading(false);
        });
      } catch (e) {
        console.warn('Auth subscription failed:', e);
        setLoading(false);
      }
    }, 100);
    return () => {
      clearTimeout(timer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1565c0" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
        <StatusBar style="dark" />
        <NavigationContainer>
          {user ? <Navbar /> : <AuthStack />}
        </NavigationContainer>
      </SafeAreaView>
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