import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import { createRecipe, updateRecipe } from '../services/api/recipesApi';

type Props = NativeStackScreenProps<RecipesStackParamList, 'CreateRecipe'>;

const TAG_OPTIONS = [
  'perte_poids',
  'prise_masse',
  'equilibre',
  'vegetarien',
  'riche_proteine',
] as const;

const CreateRecipeScreen: React.FC<Props> = ({ navigation, route }) => {
  const existingRecipe = route.params?.recipe;
  const isEditMode = !!existingRecipe;

  const [title, setTitle] = useState(existingRecipe?.title ?? '');
  const [image, setImage] = useState(existingRecipe?.image ?? '');
  const [calories, setCalories] = useState(
    existingRecipe ? String(existingRecipe.calories) : '',
  );
  const [tags, setTags] = useState<string[]>(existingRecipe?.tags ?? []);
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(existingRecipe?.ingredients ?? []);
  const [instructionInput, setInstructionInput] = useState('');
  const [instructions, setInstructions] = useState<string[]>(existingRecipe?.instructions ?? []);
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  const addIngredient = () => {
    const value = ingredientInput.trim();
    if (!value) return;
    setIngredients((prev) => [...prev, value]);
    setIngredientInput('');
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const addInstruction = () => {
    const value = instructionInput.trim();
    if (!value) return;
    setInstructions((prev) => [...prev, value]);
    setInstructionInput('');
  };

  const removeInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errors: string[] = [];
    if (!title.trim()) errors.push('Titre obligatoire');
    const cal = Number(calories);
    if (!calories || Number.isNaN(cal) || cal <= 0) errors.push('Calories invalides');
    if (ingredients.length === 0) errors.push('Ajoute au moins un ingrédient');
    if (tags.length === 0) errors.push('Sélectionne au moins un tag');

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validate();
    if (errors.length > 0) {
      Alert.alert('Formulaire incomplet', errors.join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      const cal = Number(calories);
      if (isEditMode && existingRecipe) {
        await updateRecipe(existingRecipe.id, {
          title: title.trim(),
          image: image.trim() || undefined,
          calories: cal,
          tags,
          ingredients,
          instructions: instructions.length > 0 ? instructions : undefined,
        });
      } else {
        await createRecipe({
          title: title.trim(),
          image: image.trim() || undefined,
          calories: cal,
          tags,
          ingredients,
          instructions: instructions.length > 0 ? instructions : undefined,
        });
      }

      Alert.alert('Succès', isEditMode ? 'Recette mise à jour.' : 'Recette créée avec succès.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);

      // reset local state
      setTitle('');
      setImage('');
      setCalories('');
      setTags([]);
      setIngredientInput('');
      setIngredients([]);
      setInstructionInput('');
      setInstructions([]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Impossible de créer la recette.';
      Alert.alert('Erreur', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {isEditMode ? 'Modifier la recette' : 'Créer une recette'}
        </Text>

        <Text style={styles.label}>Titre</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Salade de quinoa"
        />

        <Text style={styles.label}>Image (URL) (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={image}
          onChangeText={setImage}
          placeholder="https://..."
          autoCapitalize="none"
        />

        <Text style={styles.label}>Calories</Text>
        <TextInput
          style={styles.input}
          value={calories}
          onChangeText={setCalories}
          placeholder="380"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Tags</Text>
        <View style={styles.tagsRow}>
          {TAG_OPTIONS.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagChip,
                tags.includes(tag) && styles.tagChipSelected,
              ]}
              onPress={() => toggleTag(tag)}
            >
              <Text
                style={[
                  styles.tagChipText,
                  tags.includes(tag) && styles.tagChipTextSelected,
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Ingrédients</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            value={ingredientInput}
            onChangeText={setIngredientInput}
            placeholder="quinoa"
          />
          <TouchableOpacity style={styles.smallButton} onPress={addIngredient}>
            <Text style={styles.smallButtonText}>Ajouter</Text>
          </TouchableOpacity>
        </View>
        {ingredients.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.listRow}>
            <Text style={styles.listText}>• {item}</Text>
            <TouchableOpacity onPress={() => removeIngredient(index)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.label}>Instructions (optionnel)</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            value={instructionInput}
            onChangeText={setInstructionInput}
            placeholder="Cuire le quinoa"
          />
          <TouchableOpacity style={styles.smallButton} onPress={addInstruction}>
            <Text style={styles.smallButtonText}>Ajouter</Text>
          </TouchableOpacity>
        </View>
        {instructions.map((step, index) => (
          <View key={`${step}-${index}`} style={styles.listRow}>
            <Text style={styles.listText}>
              {index + 1}. {step}
            </Text>
            <TouchableOpacity onPress={() => removeInstruction(index)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting
              ? 'Enregistrement…'
              : isEditMode
              ? 'Mettre à jour la recette'
              : 'Enregistrer la recette'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderWidth: 1,
    borderColor: '#1565c0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  tagChipSelected: {
    backgroundColor: '#1565c0',
  },
  tagChipText: {
    color: '#1565c0',
    fontSize: 14,
  },
  tagChipTextSelected: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  smallButton: {
    backgroundColor: '#1565c0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  listText: {
    fontSize: 14,
  },
  removeText: {
    color: '#c62828',
    fontSize: 16,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#1565c0',
    paddingVertical: 14,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CreateRecipeScreen;

