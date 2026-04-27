import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Objective } from '../services/api/recipesApi';

type UserState = {
  objective: Objective;
  setObjective: (objective: Objective) => void;
  favoriteRecipeIds: string[];
  toggleFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  pruneFavorites: (validRecipeIds: string[]) => void;
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // Valeur par défaut provisoire
      objective: 'perte_poids',
      setObjective: (objective) => set({ objective }),
      favoriteRecipeIds: [],
      toggleFavorite: (id) =>
        set((state) => {
          const isFav = state.favoriteRecipeIds.includes(id);
          return {
            favoriteRecipeIds: isFav
              ? state.favoriteRecipeIds.filter((favId) => favId !== id)
              : [...state.favoriteRecipeIds, id],
          };
        }),
      removeFavorite: (id) =>
        set((state) => ({
          favoriteRecipeIds: state.favoriteRecipeIds.filter((favId) => favId !== id),
        })),
      pruneFavorites: (validRecipeIds) =>
        set((state) => {
          if (state.favoriteRecipeIds.length === 0) return state;
          const valid = new Set(validRecipeIds);
          const next = state.favoriteRecipeIds.filter((favId) => valid.has(favId));
          if (next.length === state.favoriteRecipeIds.length) return state;
          return { favoriteRecipeIds: next };
        }),
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

