import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootTabParamList } from '../components/Navbar';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import { createRecipe, getAllRecipes, updateRecipe, type IngredientItem } from '../services/api/recipesApi';
import { auth } from '../services/firebase/firebaseConfig';
import { getUserProfile, updateUserProfile } from '../services/api/userProfileApi';

type Props = NativeStackScreenProps<RecipesStackParamList, 'CreateRecipe'>;
const iconArrowBack = require('../../assets/figma/profil/arrow-back.png');
const iconPlus = require('../../assets/figma/recette/plus.png');
const iconPhoto = require('../../assets/figma/recette/icon-photo.png');
const iconTrash = require('../../assets/figma/home/icon-trash.png');

const TAG_OPTIONS = [
  'perte_poids',
  'prise_masse',
  'equilibre',
  'vegetarien',
  'riche_proteine',
] as const;
const TAG_LABELS: Record<(typeof TAG_OPTIONS)[number], string> = {
  perte_poids: 'Perte de poids',
  prise_masse: 'Prise de masse',
  equilibre: 'Equilibre',
  vegetarien: 'Vegetarien',
  riche_proteine: 'Proteines',
};

const CreateRecipeScreen: React.FC<Props> = ({ navigation, route }) => {
  const existingRecipe = route.params?.recipe;
  const isEditMode = !!existingRecipe;
  const initialDetailedIngredients: IngredientItem[] =
    existingRecipe?.ingredientsDetailed?.length
      ? existingRecipe.ingredientsDetailed
      : (existingRecipe?.ingredients ?? []).map((item) => ({ name: item }));

  const [title, setTitle] = useState(existingRecipe?.title ?? '');
  const [image, setImage] = useState(existingRecipe?.image ?? '');
  const [calories, setCalories] = useState(
    existingRecipe ? String(existingRecipe.calories) : '',
  );
  const [prepTime, setPrepTime] = useState('');
  const [tags, setTags] = useState<string[]>(existingRecipe?.tags ?? []);
  const [customTagLibrary, setCustomTagLibrary] = useState<string[]>([]);
  const [userIngredientLibrary, setUserIngredientLibrary] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showCreateTagInput, setShowCreateTagInput] = useState(false);
  const [ingredientsDetailed, setIngredientsDetailed] = useState<IngredientItem[]>(
    initialDetailedIngredients,
  );
  const [knownIngredientNames, setKnownIngredientNames] = useState<string[]>([]);
  const [focusedIngredientIndex, setFocusedIngredientIndex] = useState<number | null>(null);
  const [instructions, setInstructions] = useState<string[]>(existingRecipe?.instructions ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [imageSourceType, setImageSourceType] = useState<'picker' | 'url'>('picker');
  const avatarUrl = auth.currentUser?.photoURL ?? null;
  const avatarInitial = useMemo(() => {
    const raw = (auth.currentUser?.displayName ?? auth.currentUser?.email ?? '').trim();
    if (!raw) return '?';
    return (raw.includes('@') ? raw.split('@')[0] : raw).charAt(0).toUpperCase();
  }, [auth.currentUser?.displayName, auth.currentUser?.email]);
  const availableTags = useMemo(
    () => Array.from(new Set([...TAG_OPTIONS, ...customTagLibrary])),
    [customTagLibrary],
  );
  const ingredientLibrary = useMemo(
    () => Array.from(new Set([...userIngredientLibrary, ...knownIngredientNames])),
    [userIngredientLibrary, knownIngredientNames],
  );

  useEffect(() => {
    getUserProfile().then((profile) => {
      setCustomTagLibrary(profile?.customRecipeTags ?? []);
      setUserIngredientLibrary(profile?.customIngredients ?? []);
    });

    getAllRecipes().then((allRecipes) => {
      const names = new Set<string>();
      allRecipes.forEach((recipe) => {
        (recipe.ingredientsDetailed ?? []).forEach((item) => {
          const name = item.name?.trim();
          if (name) names.add(name);
        });
        (recipe.ingredients ?? []).forEach((raw) => {
          const value = String(raw ?? '').trim();
          if (!value) return;
          const separators = [' - ', ' : ', ' – ', ' — ', ', '];
          const matchSep = separators.find((sep) => value.includes(sep));
          const guessed = matchSep ? value.split(matchSep)[0].trim() : value;
          if (guessed) names.add(guessed);
        });
      });
      setKnownIngredientNames(Array.from(names).sort((a, b) => a.localeCompare(b, 'fr')));
    });
  }, []);

  const ingredientSuggestions = useMemo(() => {
    if (focusedIngredientIndex === null) return [];
    const query = (ingredientsDetailed[focusedIngredientIndex]?.name ?? '').trim().toLowerCase();
    if (!query) return [];
    return ingredientLibrary
      .filter((name) => name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [focusedIngredientIndex, ingredientsDetailed, ingredientLibrary]);

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  const addCustomTag = () => {
    const normalized = customTagInput.trim().replace(/\s+/g, '_');
    if (!normalized) return;
    setTags((current) =>
      current.some((tag) => tag.toLowerCase() === normalized.toLowerCase()) ? current : [...current, normalized],
    );
    setCustomTagLibrary((current) => {
      if (current.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) return current;
      const next = [...current, normalized];
      updateUserProfile({ customRecipeTags: next }).catch(() => {
        // no-op UI; save best effort
      });
      return next;
    });
    setCustomTagInput('');
    setShowCreateTagInput(false);
  };

  const toPersistedTags = (inputTags: string[]) => {
    const uid = auth.currentUser?.uid;
    return inputTags.map((tag) =>
      TAG_OPTIONS.includes(tag as (typeof TAG_OPTIONS)[number]) || !uid ? tag : `private:${uid}:${tag}`,
    );
  };

  const addIngredientRow = () => {
    setIngredientsDetailed((prev) => [...prev, { name: '', amount: '' }]);
  };

  const updateIngredient = (index: number, patch: Partial<IngredientItem>) => {
    setIngredientsDetailed((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const removeIngredient = (index: number) => {
    setIngredientsDetailed((prev) => prev.filter((_, i) => i !== index));
    setFocusedIngredientIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  };

  const addInstructionStep = () => {
    setInstructions((prev) => [...prev, '']);
  };

  const updateInstruction = (index: number, value: string) => {
    setInstructions((prev) => prev.map((step, i) => (i === index ? value : step)));
  };

  const removeInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const pickImageFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorise la galerie pour ajouter une image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;
    setImage(result.assets[0].uri);
  };

  const handleImageUrlChange = (value: string) => setImage(value);

  const clearImageSource = () => {
    setImage('');
  };

  const switchImageSource = (next: 'picker' | 'url') => {
    if (imageSourceType === next) return;
    setImage('');
    setImageSourceType(next);
  };

  const validate = () => {
    const errors: string[] = [];
    if (!title.trim()) errors.push('Titre obligatoire');
    const cal = Number(calories);
    if (!calories || Number.isNaN(cal) || cal <= 0) errors.push('Calories invalides');
    if (ingredientsDetailed.filter((item) => item.name?.trim()).length === 0)
      errors.push('Ajoute au moins un ingrédient');
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
      const cleanedInstructions = instructions.map((step) => step.trim()).filter(Boolean);
      const cleanedIngredientsDetailed = ingredientsDetailed
        .map((item) => ({
          name: item.name?.trim() ?? '',
          amount: item.amount?.trim() || undefined,
        }))
        .filter((item) => item.name);
      const nextIngredientLibrary = Array.from(
        new Set([
          ...userIngredientLibrary,
          ...cleanedIngredientsDetailed.map((item) => item.name),
        ]),
      ).sort((a, b) => a.localeCompare(b, 'fr'));
      const legacyIngredients = cleanedIngredientsDetailed.map((item) => {
        const right = [item.amount, item.unit].filter(Boolean).join(' ').trim();
        return right ? `${item.name} - ${right}` : item.name;
      });
      if (isEditMode && existingRecipe) {
        await updateRecipe(existingRecipe.id, {
          title: title.trim(),
          image: image.trim() || undefined,
          calories: cal,
          tags: toPersistedTags(tags),
          ingredients: legacyIngredients,
          ingredientsDetailed: cleanedIngredientsDetailed,
          instructions: cleanedInstructions.length > 0 ? cleanedInstructions : undefined,
        });
      } else {
        await createRecipe({
          title: title.trim(),
          image: image.trim() || undefined,
          calories: cal,
          tags: toPersistedTags(tags),
          ingredients: legacyIngredients,
          ingredientsDetailed: cleanedIngredientsDetailed,
          instructions: cleanedInstructions.length > 0 ? cleanedInstructions : undefined,
        });
      }
      setUserIngredientLibrary(nextIngredientLibrary);
      updateUserProfile({ customIngredients: nextIngredientLibrary }).catch(() => {
        // best effort sync for personal ingredient library
      });

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
      setIngredientsDetailed([]);
      setFocusedIngredientIndex(null);
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
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Image source={iconArrowBack} style={styles.backIcon} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>{isEditMode ? 'Modifier la recette' : 'Creer une recette'}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            activeOpacity={0.8}
            onPress={() => navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('Profil')}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={styles.label}>Image</Text>
            <View style={styles.imageSourceTabs}>
              <TouchableOpacity
                style={[styles.imageSourceTab, imageSourceType === 'picker' && styles.imageSourceTabActive]}
                onPress={() => switchImageSource('picker')}
                activeOpacity={0.85}
              >
                <Text style={[styles.imageSourceTabText, imageSourceType === 'picker' && styles.imageSourceTabTextActive]}>
                  Galerie
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageSourceTab, imageSourceType === 'url' && styles.imageSourceTabActive]}
                onPress={() => switchImageSource('url')}
                activeOpacity={0.85}
              >
                <Text style={[styles.imageSourceTabText, imageSourceType === 'url' && styles.imageSourceTabTextActive]}>
                  URL
                </Text>
              </TouchableOpacity>
            </View>

            {imageSourceType === 'picker' ? (
              <>
                <TouchableOpacity style={styles.imagePickerCard} onPress={pickImageFromLibrary} activeOpacity={0.86}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.recipeImagePreview} />
                  ) : (
                    <View style={styles.imagePickerPlaceholder}>
                      <Image source={iconPhoto} style={styles.imagePickerPlus} />
                      <Text style={styles.imagePickerTitle}>Ajouter une image</Text>
                      <Text style={styles.imagePickerHint}>Touchez pour choisir depuis la galerie</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {image ? (
                  <View style={styles.imageSourceInfoRow}>
                    <Text style={styles.imageSourceInfoText}>Image selectionnee depuis la galerie</Text>
                    <TouchableOpacity onPress={clearImageSource} activeOpacity={0.8}>
                      <Text style={styles.clearSourceText}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={image}
                  onChangeText={handleImageUrlChange}
                  placeholder="Coller une URL d'image..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
                {image.trim() ? (
                  <View style={styles.imageSourceInfoRow}>
                    <Text style={styles.imageSourceInfoText}>Image active via URL</Text>
                    <TouchableOpacity onPress={clearImageSource} activeOpacity={0.8}>
                      <Text style={styles.clearSourceText}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            )}

            <View style={styles.recipeInfoBlock}>
              <Text style={styles.label}>Nom de la recette</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Risotto aux asperges et citron"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.metricsRow}>
                <View style={styles.metricField}>
                  <Text style={styles.label}>Calories (kcal)</Text>
                  <TextInput
                    style={styles.input}
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="450"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.metricField}>
                  <Text style={styles.label}>Temps (min)</Text>
                  <TextInput
                    style={styles.input}
                    value={prepTime}
                    onChangeText={setPrepTime}
                    placeholder="30"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Categories</Text>
            <View style={styles.tagsRow}>
              {availableTags.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, active && styles.tagChipSelected]}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tagChipText, active && styles.tagChipTextSelected]}>
                      {TAG_LABELS[tag as (typeof TAG_OPTIONS)[number]] ?? tag.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.addTagChip}
                onPress={() => setShowCreateTagInput((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Text style={styles.addTagChipText}>+</Text>
              </TouchableOpacity>
            </View>
            {showCreateTagInput ? (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.rowInput}
                  value={customTagInput}
                  onChangeText={setCustomTagInput}
                  placeholder="Nouveau tag..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.addButton} onPress={addCustomTag} activeOpacity={0.85}>
                  <Image source={iconPlus} style={styles.addIcon} />
                  <Text style={styles.addButtonText}>Creer</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {tags.some((tag) => !TAG_OPTIONS.includes(tag as (typeof TAG_OPTIONS)[number])) ? (
              <View style={styles.customTagList}>
                {tags
                  .filter((tag) => !TAG_OPTIONS.includes(tag as (typeof TAG_OPTIONS)[number]))
                  .map((tag) => (
                    <View key={tag} style={styles.customTagChip}>
                      <Text style={styles.customTagChipText}>{tag.replace(/_/g, ' ')}</Text>
                      <TouchableOpacity onPress={() => toggleTag(tag)} activeOpacity={0.8}>
                        <Text style={styles.customTagRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            ) : null}
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Ingrédients</Text>
            {ingredientsDetailed.length === 0 ? (
              <TouchableOpacity style={styles.addStepPlaceholder} onPress={addIngredientRow} activeOpacity={0.85}>
                <Image source={iconPlus} style={styles.addStepIcon} />
                <Text style={styles.addStepText}>Ajouter un ingredient</Text>
              </TouchableOpacity>
            ) : (
              <>
                {ingredientsDetailed.map((item, index) => (
                  <View key={`ingredient-${index}`} style={styles.ingredientRowBlock}>
                    <View style={styles.ingredientEditRow}>
                      <TextInput
                        style={styles.ingredientNameInput}
                        value={item.name}
                        onChangeText={(value) => updateIngredient(index, { name: value })}
                        onFocus={() => setFocusedIngredientIndex(index)}
                        placeholder="Ingrédient"
                        placeholderTextColor="#9CA3AF"
                      />
                      <View style={styles.ingredientDivider} />
                      <TextInput
                        style={styles.ingredientQtyInput}
                        value={item.amount ?? ''}
                        onChangeText={(value) => updateIngredient(index, { amount: value })}
                        onFocus={() => setFocusedIngredientIndex(null)}
                        placeholder="Quantité"
                        placeholderTextColor="#9CA3AF"
                      />
                      <View style={styles.ingredientDivider} />
                      <TouchableOpacity style={styles.ingredientDeleteBtn} onPress={() => removeIngredient(index)} activeOpacity={0.75}>
                        <Image source={iconTrash} style={styles.stepDeleteIcon} />
                      </TouchableOpacity>
                    </View>

                    {focusedIngredientIndex === index ? (
                      item.name.trim().length > 0 ? (
                        ingredientSuggestions.length > 0 ? (
                          <View style={styles.ingredientLibraryWrap}>
                            <Text style={styles.ingredientLibraryTitle}>Suggestions</Text>
                            <View style={styles.suggestionsWrap}>
                              {ingredientSuggestions.map((name) => (
                                <TouchableOpacity
                                  key={`${index}-s-${name}`}
                                  style={styles.suggestionChip}
                                  onPress={() => {
                                    updateIngredient(index, { name });
                                    setFocusedIngredientIndex(null);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.suggestionChipText}>{name}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ) : null
                      ) : (
                        ingredientLibrary.length > 0 ? (
                          <View style={styles.ingredientLibraryWrap}>
                            <Text style={styles.ingredientLibraryTitle}>Mes ingrédients</Text>
                            <View style={styles.suggestionsWrap}>
                              {ingredientLibrary.slice(0, 30).map((name) => (
                                <TouchableOpacity
                                  key={`${index}-l-${name}`}
                                  style={styles.suggestionChip}
                                  onPress={() => {
                                    updateIngredient(index, { name });
                                    setFocusedIngredientIndex(null);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.suggestionChipText}>{name}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ) : null
                      )
                    ) : null}
                  </View>
                ))}
                <TouchableOpacity style={[styles.addStepPlaceholder, styles.addStepPlaceholderCompact]} onPress={addIngredientRow} activeOpacity={0.85}>
                  <Image source={iconPlus} style={styles.addStepIcon} />
                  <Text style={styles.addStepText}>Ajouter un ingrédient</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Préparation (optionnel)</Text>
            {instructions.length === 0 ? (
              <TouchableOpacity style={styles.addStepPlaceholder} onPress={addInstructionStep} activeOpacity={0.85}>
                <Image source={iconPlus} style={styles.addStepIcon} />
                <Text style={styles.addStepText}>Ajouter une etape</Text>
              </TouchableOpacity>
            ) : (
              <>
                {instructions.map((step, index) => (
                  <View key={`step-${index}`} style={styles.stepEditRow}>
                    <Text style={styles.stepEditIndex}>{String(index + 1).padStart(2, '0')}</Text>
                    <TextInput
                      style={styles.stepEditInput}
                      value={step}
                      onChangeText={(value) => updateInstruction(index, value)}
                      placeholder={`Etape ${index + 1}`}
                      placeholderTextColor="#9CA3AF"
                      multiline
                    />
                    <TouchableOpacity
                      style={styles.stepDeleteBtn}
                      onPress={() => removeInstruction(index)}
                      activeOpacity={0.75}
                    >
                      <Image source={iconTrash} style={styles.stepDeleteIcon} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={[styles.addStepPlaceholder, styles.addStepPlaceholderCompact]} onPress={addInstructionStep} activeOpacity={0.85}>
                  <Image source={iconPlus} style={styles.addStepIcon} />
                  <Text style={styles.addStepText}>Ajouter une étape</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.9}
          >
            <Text style={styles.submitButtonText}>
              {submitting
                ? 'Enregistrement...'
                : isEditMode
                ? 'Mettre a jour la recette'
                : 'Enregistrer la recette'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,85,255,0.1)',
  },
  avatarImg: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: '#111827',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 14,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#424752',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  imageSourceTabs: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#E8E8E8',
    padding: 4,
    gap: 4,
  },
  imageSourceTab: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageSourceTabActive: {
    backgroundColor: '#FFFFFF',
  },
  imageSourceTabText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },
  imageSourceTabTextActive: {
    color: '#111827',
  },
  imageSourceInfoRow: {
    marginTop: -2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageSourceInfoText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  clearSourceText: {
    fontSize: 12,
    color: '#BA1A1A',
    fontWeight: '700',
  },
  recipeInfoBlock: {
    marginTop: 2,
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricField: {
    flex: 1,
    gap: 8,
  },
  imagePickerCard: {
    width: '100%',
    height: 176,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeImagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  imagePickerPlus: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: '#004D99',
  },
  imagePickerTitle: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '700',
  },
  imagePickerHint: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E8E8E8',
  },
  tagChipSelected: {
    backgroundColor: '#FC6018',
  },
  tagChipText: {
    color: '#424752',
    fontSize: 13,
    fontWeight: '600',
  },
  tagChipTextSelected: {
    color: '#531800',
  },
  addTagChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8E8',
  },
  addTagChipText: {
    fontSize: 20,
    lineHeight: 22,
    color: '#004D99',
    fontWeight: '700',
  },
  customTagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  customTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#DCEAFE',
  },
  customTagChipText: {
    fontSize: 12,
    color: '#0B4B9B',
    fontWeight: '600',
  },
  customTagRemove: {
    fontSize: 12,
    color: '#0B4B9B',
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E8E8E8',
  },
  suggestionChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  ingredientLibraryWrap: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    gap: 8,
  },
  ingredientLibraryTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  ingredientEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  ingredientRowBlock: {
    marginTop: 6,
    gap: 6,
  },
  ingredientNameInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
    backgroundColor: 'transparent',
  },
  ingredientDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
  },
  ingredientQtyInput: {
    width: 88,
    paddingHorizontal: 10,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
    backgroundColor: 'transparent',
    textAlign: 'center',
  },
  addButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#004D99',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  listText: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  removeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  removeText: {
    color: '#BA1A1A',
    fontSize: 12,
    fontWeight: '700',
  },
  addStepPlaceholder: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F9FAFB',
  },
  addStepIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    tintColor: '#004D99',
  },
  addStepText: {
    color: '#004D99',
    fontSize: 13,
    fontWeight: '700',
  },
  stepEditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 6,
  },
  stepEditIndex: {
    marginTop: 2,
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: '#004D99',
  },
  stepEditInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
    minHeight: 22,
  },
  stepDeleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientDeleteBtn: {
    alignSelf: 'stretch',
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDeleteIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: '#BA1A1A',
  },
  addStepPlaceholderCompact: {
    height: 40,
    marginTop: 6,
  },
  submitButton: {
    marginTop: 4,
    backgroundColor: '#1565C0',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default CreateRecipeScreen;

