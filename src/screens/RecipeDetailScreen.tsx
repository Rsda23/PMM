import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import { auth } from '../services/firebase/firebaseConfig';
import { deleteRecipe } from '../services/api/recipesApi';

type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeDetail'>;

const RecipeDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id, title, calories, tags, ingredients, instructions, image, createdBy } = route.params;
  const isOwner = !!auth.currentUser && auth.currentUser.uid === createdBy;

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la recette',
      `Supprimer « ${title} » ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecipe(id);
              navigation.goBack();
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Impossible de supprimer.';
              Alert.alert('Erreur', message);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Retour</Text>
      </TouchableOpacity>

      {image && <Image source={{ uri: image }} style={styles.image} />}

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{calories} kcal</Text>

      {tags && tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {ingredients && ingredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingrédients</Text>
          {ingredients.map((item, index) => (
            <Text key={`${id}-ing-${index}`} style={styles.listItem}>
              • {item}
            </Text>
          ))}
        </View>
      )}

      {instructions && instructions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {instructions.map((step, index) => (
            <Text key={`${id}-step-${index}`} style={styles.listItem}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>
      )}

      {isOwner && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('CreateRecipe', { recipe: route.params })}
          >
            <Text style={styles.editButtonText}>Modifier la recette</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#1565c0',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  listItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1565c0',
    fontWeight: '500',
  },
  actionsRow: {
    marginTop: 24,
    gap: 12,
  },
  editButton: {
    backgroundColor: '#1565c0',
    paddingVertical: 12,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: '#c62828',
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default RecipeDetailScreen;

