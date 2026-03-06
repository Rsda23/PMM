# PMM – Application de recommandations de recettes

## Introduction
PMM est une application mobile qui aide les utilisateurs à améliorer leur alimentation en leur recommandant des recettes adaptées à leurs objectifs nutritionnels.
L'application combine simplicité d'utilisation, recommandations personnalisées et interface intuitive afin de faciliter l'adoption de bonnes habitudes alimentaires.
Les utilisateurs peuvent définir leurs objectifs (perte de poids, prise de masse, alimentation équilibrée) et recevoir des suggestions de recettes adaptées.


## Objectifs
- proposer des recommandations de recettes personnalisées
- simplifier la recherche de repas adaptés à un objectif nutritionnel
- offrir une interface fluide et intuitive
- encourager l'adoption d'habitudes alimentaires plus saines


## Fonctionnalités

### Recommandations personnalisées
L'application suggère des recettes selon :
- l'objectif nutritionnel
- les préférences alimentaires
- les restrictions alimentaires éventuelles

### Catalogue de recettes
Les utilisateurs peuvent :
- consulter des recettes
- voir les informations nutritionnelles
- consulter les ingrédients et instructions

### Profil utilisateur
Le profil permet de définir :
- l'objectif nutritionnel
- les préférences alimentaires
- les restrictions


## Stack technique

### Frontend
- React Native
- Expo
- TypeScript

### UI
- React Native Paper

### Backend
- Firebase Authentication
- Cloud Firestore

### Gestion d'état
- Zustand


## Architecture du projet

```text
src
 ├ components
 ├ screens
 │   ├ HomeScreen
 │   ├ RecipesScreen
 │   ├ RecipeDetailScreen
 │   └ ProfileScreen
 │
 ├ services
 │   ├ firebase
 │   └ api
 │
 ├ store
 │   └ userStore
 │
 └ navigation
```


## Structure de la base de données

### Collection `users`
```json
{
  "id": "userId",
  "objective": "perte_poids",
  "preferences": ["vegetarien"]
}
```

### Collection `recipes`
```json
{
  "name": "Salade quinoa",
  "ingredients": ["quinoa", "avocat"],
  "calories": 380,
  "tags": ["perte_poids"]
}
```


## Parcours utilisateur
1. L'utilisateur crée un compte
2. Il choisit son objectif nutritionnel
3. L'application propose des recettes adaptées
4. L'utilisateur consulte les détails des recettes


## Interface intuitive
L'application privilégie :
- une navigation simple
- un affichage visuel des recettes
- un accès rapide aux recommandations
- une expérience utilisateur fluide


## Installation (à compléter)

```bash
# Cloner le projet
git clone https://github.com/Rsda23/PMM.git
cd PMM

# Installer les dépendances
npm install

# Lancer l'application
npx expo start
```


## Roadmap (idées d'évolutions)
- ajout d'un filtre par temps de préparation
- ajout de plans alimentaires sur plusieurs jours
- système de favoris pour les recettes
- notifications de rappel (repas, hydratation, etc.)