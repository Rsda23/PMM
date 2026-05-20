import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const readEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

const webClientId = readEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
const iosClientId = readEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');

/** Google natif désactivé tant que google-services.json n’est pas configuré (évite le crash APK au lancement). */
export const isGoogleSignInNativeAvailable = (): boolean => false;

export const getGoogleSignInSetupHelp = (): string => {
  if (isExpoGo) {
    return [
      'La connexion Google n’est pas disponible dans Expo Go.',
      'Utilise email / mot de passe, ou installe un APK rebuild après configuration Google.',
    ].join('\n');
  }

  const lines = [
    'Connexion Google temporairement désactivée sur l’APK pour éviter les crashs au démarrage.',
    '',
    'Pour la réactiver :',
    '1) Firebase Console > ajouter l’app Android (com.rsda.PMM) > télécharger google-services.json à la racine du projet',
    '2) Réinstaller @react-native-google-signin/google-signin + plugin dans app.config.js',
    '3) Variables EAS : EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (+ SHA-1 du certificat EAS dans Firebase)',
    '4) eas build --profile preview --platform android',
    '',
    'En attendant : connexion par email / mot de passe.',
  ];

  if (Platform.OS === 'ios' && !iosClientId) {
    lines.push('', 'iOS : EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID recommandé.');
  }

  return lines.join('\n');
};

export const getGoogleClientConfigError = (): string | null => {
  if (!webClientId) {
    return 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID manquant dans .env / variables EAS.';
  }
  return null;
};

export const isGoogleSignInConfigured = (): boolean => false;

export function useGoogleSignIn(onError?: (message: string) => void) {
  const [loading, setLoading] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      const msg = getGoogleSignInSetupHelp();
      onErrorRef.current?.(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    signIn,
    loading,
    isReady: false,
    isExpoGo,
  };
}
