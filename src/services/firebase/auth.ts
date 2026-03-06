import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

export const login = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const register = async (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const sendPasswordReset = async (email: string) => {
  return sendPasswordResetEmail(auth, email);
};

export const logout = async () => {
  return signOut(auth);
};

/**
 * Vérifier si l'utilisateur est connecté / réagir aux changements d'état.
 * Retourne une fonction pour se désabonner.
 */
export const subscribeToAuthState = (callback: (user: User | null) => void): Unsubscribe => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('user connecté');
    }
    callback(user);
  });
};
