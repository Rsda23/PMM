import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

export const getAuthErrorMessage = (error: unknown): string => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: string }).code)
      : undefined;

  switch (code) {
    case 'auth/account-exists-with-different-credential':
      return 'Un compte existe déjà avec cet email via une autre méthode de connexion.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Identifiants incorrects.';
    case 'auth/user-not-found':
      return 'Aucun compte trouvé avec cet email.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessaie plus tard.';
    case 'auth/popup-closed-by-user':
      return 'Connexion annulée.';
    default:
      break;
  }

  return error instanceof Error ? error.message : 'Connexion impossible';
};

export const login = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signInWithGoogleIdToken = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
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
