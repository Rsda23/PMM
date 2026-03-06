import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Objective } from '../services/api/recipesApi';

type UserState = {
  objective: Objective;
  setObjective: (objective: Objective) => void;
  favoriteRecipeIds: string[];
  toggleFavorite: (id: string) => void;
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
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

