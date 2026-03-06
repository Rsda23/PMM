import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  initializeAuth,
  // @ts-expect-error export présent à l'exécution pour React Native, absent des types
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  // Vérifie dans Firebase Console > Paramètres du projet que la clé est correcte (souvent H1ch → Hlch en cas d’erreur)
  apiKey: "AIzaSyCQXBe32Nb7f7KHG_YEaP09wgHlchwfDWM",
  authDomain: "planmymeal-1a5f6.firebaseapp.com",
  projectId: "planmymeal-1a5f6",
  storageBucket: "planmymeal-1a5f6.firebasestorage.app",
  messagingSenderId: "469313332856",
  appId: "1:469313332856:web:af8a90d7986032c5baaf8d",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// React Native : persistance avec AsyncStorage pour que la connexion survive au redémarrage de l’app
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export default app;
