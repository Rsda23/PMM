import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import type { RootTabParamList } from '../components/Navbar';
import AppInput from '../components/ui/AppInput';
import SectionHeader from '../components/ui/SectionHeader';
import ObjectiveOption from '../components/ui/ObjectiveOption';
import ProfileStatCard from '../components/ui/ProfileStatCard';
import RecipeMiniCard from '../components/ui/RecipeMiniCard';

import { useUserStore } from '../store/userStore';
import { getAllRecipes, type Recipe } from '../services/api/recipesApi';
import { getUserProfile, updateUserProfile } from '../services/api/userProfileApi';
import { logout } from '../services/firebase/auth';
import { auth } from '../services/firebase/firebaseConfig';
import {
  updateProfile,
  verifyBeforeUpdateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';

type ProfileScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Profil'>;


type ActiveTab = 'favoris' | 'mode' | 'objectif';

const OBJECTIVE_LABELS: Record<string, string> = {
  perte_poids: 'Sèche',
  prise_masse: 'Masse',
  equilibre: 'Équilibré',
};

const ProfileScreen = () => {
  const objective = useUserStore((state) => state.objective);
  const setObjective = useUserStore((state) => state.setObjective);
  const favoriteRecipeIds = useUserStore((state) => state.favoriteRecipeIds);
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const route = useRoute<RouteProp<RootTabParamList, 'Profil'>>();
  const scrollRef = useRef<ScrollView>(null);
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [calorieGoal, setCalorieGoal] = useState<string>('');
  const [calorieGoalDraft, setCalorieGoalDraft] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(auth.currentUser?.photoURL ?? null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [calorieGoalSaving, setCalorieGoalSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('objectif');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'username' | 'email' | 'password'>('main');
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const user = auth.currentUser;
  const email = user?.email ?? '';
  const initial = email ? email[0].toUpperCase() : '?';
  const displayName = useMemo(() => {
    const fromEmail = email.includes('@') ? email.split('@')[0] : email;
    if (!fromEmail) return 'Utilisateur';
    return fromEmail
      .split(/[._-]/g)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase() + s.slice(1))
      .join(' ');
  }, [email]);
  const memberSinceLabel = useMemo(() => {
    const creation = user?.metadata.creationTime;
    if (!creation) return '—';
    return new Date(creation).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [user?.metadata.creationTime]);

  useFocusEffect(
    React.useCallback(() => {
      getUserProfile().then((p) => {
        const val = p?.calorieGoal ? String(p.calorieGoal) : '';
        setCalorieGoal(val);
        setCalorieGoalDraft(val);
        setAvatarUrl(p?.avatarUrl ?? auth.currentUser?.photoURL ?? null);
      });
    }, []),
  );

  const openSettingsView = (view: 'username' | 'email' | 'password') => {
    setEditError('');
    setNewName(auth.currentUser?.displayName ?? '');
    setNewEmail(auth.currentUser?.email ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSettingsView(view);
  };

  const handleUpdateName = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { setEditError('Le nom ne peut pas être vide.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      await updateProfile(auth.currentUser!, { displayName: trimmed });
      setSettingsView('main');
    } catch {
      setEditError("Impossible de mettre à jour le nom.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.includes('@')) { setEditError('Email invalide.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      await verifyBeforeUpdateEmail(auth.currentUser!, newEmail);
      Alert.alert(
        'Email envoyé',
        `Un lien de confirmation a été envoyé à ${newEmail}. Cliquez dessus pour valider le changement.`,
        [{ text: 'OK', onPress: () => setSettingsView('main') }],
      );
    } catch (e: any) {
      console.warn('[updateEmail] code:', e.code, '| message:', e.message);
      if (e.code === 'auth/requires-recent-login') {
        setEditError('Session expirée. Déconnecte-toi et reconnecte-toi avant de modifier l\'email.');
      } else if (e.code === 'auth/email-already-in-use') {
        setEditError('Cet email est déjà utilisé par un autre compte.');
      } else if (e.code === 'auth/invalid-email') {
        setEditError('Format d\'email invalide.');
      } else {
        setEditError(`Erreur : ${e.code ?? e.message}`);
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) { setEditError('Mot de passe actuel requis.'); return; }
    if (newPassword.length < 6) { setEditError('Le nouveau mot de passe doit faire au moins 6 caractères.'); return; }
    if (newPassword !== confirmPassword) { setEditError('Les mots de passe ne correspondent pas.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser!.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser!, credential);
      await updatePassword(auth.currentUser!, newPassword);
      setSettingsView('main');
    } catch (e: any) {
      if (e.code === 'auth/wrong-password') setEditError('Mot de passe actuel incorrect.');
      else setEditError("Impossible de mettre à jour le mot de passe.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (e) {
      console.warn('Déconnexion échouée:', e);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSaveCalories = async () => {
    const n = parseInt(calorieGoalDraft, 10);
    if (isNaN(n) || n < 500 || n > 10000) {
      Alert.alert('Invalide', 'Entre 500 et 10 000 kcal.');
      return;
    }
    setCalorieGoalSaving(true);
    try {
      await updateUserProfile({ calorieGoal: n });
      setCalorieGoal(calorieGoalDraft);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer.");
    } finally {
      setCalorieGoalSaving(false);
    }
  };

  const handlePickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', "Autorise l'accès à la galerie pour modifier la photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;

    setAvatarSaving(true);
    try {
      setAvatarUrl(uri);
      await updateUserProfile({ avatarUrl: uri });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: uri });
      }
    } catch (e) {
      console.warn('update avatar failed:', e);
      Alert.alert('Erreur', "Impossible d'enregistrer la photo de profil.");
    } finally {
      setAvatarSaving(false);
    }
  };

  useEffect(() => {
    const loadFavorites = async () => {
      const all = await getAllRecipes();
      setFavoriteRecipes(all.filter((r) => favoriteRecipeIds.includes(r.id)));
    };
    loadFavorites();
  }, [favoriteRecipeIds]);

  useEffect(() => {
    if (!route.params?.reTapToken) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    getUserProfile().then((p) => {
      const val = p?.calorieGoal ? String(p.calorieGoal) : '';
      setCalorieGoal(val);
      setCalorieGoalDraft(val);
      setAvatarUrl(p?.avatarUrl ?? auth.currentUser?.photoURL ?? null);
    });
  }, [route.params?.reTapToken]);

  const iconStatFavorites = require('../../assets/figma/profil/icon-favoris.png');
  const iconStatCalories = require('../../assets/figma/profil/icon-mode.png');
  const iconStatObjective = require('../../assets/figma/profil/icon-objectif.png');
  const iconObjPerte = require('../../assets/figma/profil/icon-pdp.png');
  const iconObjPrise = require('../../assets/figma/profil/icon-pdm.png');
  const iconObjEqui = require('../../assets/figma/profil/icon-equal.png');
  const iconDisconnect = require('../../assets/figma/profil/icon-disconnect.png');
  const iconArrowBack = require('../../assets/figma/profil/arrow-back.png');

  if (settingsVisible) {
    const settingsHeader = (title: string, onBack: () => void) => (
      <View style={styles.settingsTopNav}>
        <TouchableOpacity
          style={styles.settingsBackBtn}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Image source={iconArrowBack} style={styles.arrowBackIcon} />
        </TouchableOpacity>
        <Text style={styles.settingsTopTitle}>{title}</Text>
        <View style={styles.settingsTopRightSpacer} />
      </View>
    );

    if (settingsView === 'username') {
      return (
        <SafeAreaView style={styles.safe} edges={['left', 'right']}>
          {settingsHeader("Nom d'utilisateur", () => setSettingsView('main'))}
          <ScrollView contentContainerStyle={styles.settingsContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.editHint}>Ce nom sera affiché sur votre profil.</Text>
            {editError ? <Text style={styles.editError}>{editError}</Text> : null}
            <AppInput
              label="Nouveau nom"
              value={newName}
              onChangeText={setNewName}
              placeholder="Ex : Jean Dupont"
              iconName="person-outline"
            />
            <TouchableOpacity
              style={[styles.saveFullBtn, (editSaving || !newName.trim()) && styles.disabled]}
              onPress={handleUpdateName}
              disabled={editSaving || !newName.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.saveFullText}>{editSaving ? 'Enregistrement…' : 'Enregistrer'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      );
    }

    if (settingsView === 'email') {
      return (
        <SafeAreaView style={styles.safe} edges={['left', 'right']}>
          {settingsHeader('Modifier l\'email', () => setSettingsView('main'))}
          <ScrollView contentContainerStyle={styles.settingsContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.editHint}>Un lien de confirmation sera envoyé à la nouvelle adresse.</Text>
            {editError ? <Text style={styles.editError}>{editError}</Text> : null}
            <AppInput
              label="Nouvel email"
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="exemple@mail.com"
              iconName="mail-outline"
              inputProps={{ keyboardType: 'email-address', autoCapitalize: 'none' }}
            />
            <TouchableOpacity
              style={[styles.saveFullBtn, (editSaving || !newEmail) && styles.disabled]}
              onPress={handleUpdateEmail}
              disabled={editSaving || !newEmail}
              activeOpacity={0.85}
            >
              <Text style={styles.saveFullText}>{editSaving ? 'Envoi…' : 'Envoyer le lien'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      );
    }

    if (settingsView === 'password') {
      return (
        <SafeAreaView style={styles.safe} edges={['left', 'right']}>
          {settingsHeader('Mot de passe', () => setSettingsView('main'))}
          <ScrollView contentContainerStyle={styles.settingsContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.editHint}>Minimum 6 caractères.</Text>
            {editError ? <Text style={styles.editError}>{editError}</Text> : null}
            <AppInput
              label="Mot de passe actuel"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••••"
              iconName="lock-closed-outline"
              secureTextEntry
            />
            <AppInput
              label="Nouveau mot de passe"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              iconName="key-outline"
              secureTextEntry
            />
            <AppInput
              label="Confirmer le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              iconName="checkmark-circle-outline"
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.saveFullBtn, (editSaving || !currentPassword || !newPassword || !confirmPassword) && styles.disabled]}
              onPress={handleUpdatePassword}
              disabled={editSaving || !currentPassword || !newPassword || !confirmPassword}
              activeOpacity={0.85}
            >
              <Text style={styles.saveFullText}>{editSaving ? 'Enregistrement…' : 'Enregistrer'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        {settingsHeader('Réglages', () => { setSettingsVisible(false); setSettingsView('main'); })}

        <ScrollView contentContainerStyle={styles.settingsContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.settingsSectionLabel}>COMPTE</Text>
          <View style={styles.settingsGroup}>
            <TouchableOpacity style={styles.settingsItem} activeOpacity={0.7} onPress={() => openSettingsView('username')}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="person-outline" size={18} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.settingsLabel}>Modifier le nom d'utilisateur</Text>
                  {auth.currentUser?.displayName ? (
                    <Text style={styles.settingsSubLabel}>{auth.currentUser.displayName}</Text>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsItem} activeOpacity={0.7} onPress={() => openSettingsView('email')}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="mail-outline" size={18} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.settingsLabel}>Modifier l'email</Text>
                  <Text style={styles.settingsSubLabel}>{auth.currentUser?.email ?? ''}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsItem} activeOpacity={0.7} onPress={() => openSettingsView('password')}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="key-outline" size={18} color="#2563EB" />
                </View>
                <Text style={styles.settingsLabel}>Modifier le mot de passe</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          <Text style={styles.settingsSectionLabel}>PRÉFÉRENCES</Text>
          <View style={styles.settingsGroup}>
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="notifications-outline" size={18} color="#2563EB" />
                </View>
                <Text style={styles.settingsLabel}>Notifications</Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={setNotifEnabled}
                trackColor={{ false: '#E2E8F0', true: '#BFDBFE' }}
                thumbColor={notifEnabled ? '#2563EB' : '#CBD5E1'}
              />
            </View>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="moon-outline" size={18} color="#475569" />
                </View>
                <Text style={styles.settingsLabel}>Mode sombre</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#E2E8F0', true: '#BFDBFE' }}
                thumbColor={darkMode ? '#2563EB' : '#CBD5E1'}
              />
            </View>
          </View>

          <Text style={styles.settingsSectionLabel}>INFORMATIONS</Text>
          <View style={styles.settingsGroup}>
            <TouchableOpacity style={styles.settingsItem} activeOpacity={0.7}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="information-circle-outline" size={18} color="#16A34A" />
                </View>
                <Text style={styles.settingsLabel}>À propos de PMM</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsItem} activeOpacity={0.7}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#EA580C" />
                </View>
                <Text style={styles.settingsLabel}>Confidentialité</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsItem} activeOpacity={0.7}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#F8FAFC' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#64748B" />
                </View>
                <Text style={styles.settingsLabel}>Conditions d'utilisation</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, { backgroundColor: '#F8FAFC' }]}>
                  <Ionicons name="code-slash-outline" size={18} color="#94A3B8" />
                </View>
                <Text style={[styles.settingsLabel, { color: '#94A3B8' }]}>Version</Text>
              </View>
              <Text style={styles.settingsVersion}>1.0.0</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.settingsLogoutBtn, loggingOut && styles.disabled]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.85}
          >
            <Image source={iconDisconnect} style={styles.settingsLogoutIcon} />
            <Text style={styles.settingsLogoutText}>{loggingOut ? 'Déconnexion…' : 'Déconnexion'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.topNav}>
        <View style={styles.topNavLeft}>
          <Text style={styles.topTitle}>Profil</Text>
        </View>
        <Text style={styles.brand}>PMM</Text>
        <TouchableOpacity style={styles.topNavRight} onPress={() => setSettingsVisible(true)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Image source={require('../../assets/figma/profil/icon-setting.png')} style={styles.settingIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.heroAvatarImage} />
            ) : (
              <Text style={styles.heroAvatarInitial}>{initial}</Text>
            )}
            <TouchableOpacity
              style={[styles.heroEdit, avatarSaving && styles.disabled]}
              activeOpacity={0.85}
              onPress={handlePickProfilePhoto}
              disabled={avatarSaving}
            >
              <Image source={require('../../assets/figma/profil/icon-edit.png')} style={styles.heroEditIcon} />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroEmail}>{email}</Text>
          <Text style={styles.heroSince}>Membre depuis {memberSinceLabel}</Text>
        </View>

        <View style={styles.statsRow}>
          <ProfileStatCard
            iconSource={iconStatFavorites}
            label="Favoris"
            value={String(favoriteRecipeIds.length)}
            variant={activeTab === 'favoris' ? 'highlight' : 'default'}
            onPress={() => setActiveTab('favoris')}
          />
          <ProfileStatCard
            iconSource={iconStatCalories}
            label="Mode"
            value={calorieGoal ? `${calorieGoal} kcal` : '—'}
            variant={activeTab === 'mode' ? 'highlight' : 'default'}
            onPress={() => setActiveTab('mode')}
          />
          <ProfileStatCard
            iconSource={iconStatObjective}
            label="Objectif"
            value={OBJECTIVE_LABELS[objective] ?? '—'}
            variant={activeTab === 'objectif' ? 'highlight' : 'default'}
            onPress={() => setActiveTab('objectif')}
          />
        </View>

        {activeTab === 'objectif' && (
          <View style={styles.card}>
            <SectionHeader title="Routine nutritionnelle" />
            <View style={styles.optionList}>
              <ObjectiveOption
                label="Perte de poids"
                description="Suivi pour perdre du poids avec un objectif calorique adapté."
                icon="trending-down"
                iconSource={iconObjPerte}
                active={objective === 'perte_poids'}
                onPress={() => setObjective('perte_poids')}
              />
              <ObjectiveOption
                label="Prise de masse"
                description="Suivi pour mieux manger et optimiser ton objectif sportif."
                icon="trending-up"
                iconSource={iconObjPrise}
                active={objective === 'prise_masse'}
                onPress={() => setObjective('prise_masse')}
              />
              <ObjectiveOption
                label="Équilibré"
                description="Un objectif simple pour une alimentation saine et durable."
                icon="leaf"
                iconSource={iconObjEqui}
                active={objective === 'equilibre'}
                onPress={() => setObjective('equilibre')}
              />
            </View>
          </View>
        )}

        {activeTab === 'mode' && (
          <View style={styles.card}>
            <SectionHeader title="Objectif calorique" />

            <View style={styles.calorieSummary}>
              <TextInput
                style={styles.calorieSummaryValue}
                value={calorieGoalDraft}
                onChangeText={setCalorieGoalDraft}
                placeholder="2000"
                placeholderTextColor="#93C5FD"
                keyboardType="number-pad"
                maxLength={5}
              />
              <Text style={styles.calorieSummaryUnit}>kcal / jour</Text>
            </View>

            <TouchableOpacity
              style={[styles.saveFullBtn, (calorieGoalSaving || !calorieGoalDraft) && styles.disabled]}
              onPress={handleSaveCalories}
              disabled={calorieGoalSaving || !calorieGoalDraft}
              activeOpacity={0.85}
            >
              <Text style={styles.saveFullText}>{calorieGoalSaving ? 'Enregistrement…' : 'Enregistrer'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'favoris' && (
          <View style={styles.card}>
            <View style={styles.favHeader}>
              <SectionHeader title="Recettes favorites" />
              <TouchableOpacity onPress={() => navigation.navigate('Recettes', { screen: 'Recipes' })} activeOpacity={0.8}>
                <Text style={styles.favLink}>Voir tout</Text>
              </TouchableOpacity>
            </View>

            {favoriteRecipes.length === 0 ? (
              <View style={styles.emptyFavorites}>
                <Ionicons name="heart-outline" size={40} color="#CBD5E1" />
                <Text style={styles.emptyFavoritesText}>Aucune recette en favori</Text>
                <Text style={styles.emptyFavoritesSub}>Appuie sur l'étoile d'une recette pour l'ajouter ici</Text>
              </View>
            ) : (
              <FlatList
                data={favoriteRecipes}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.favSlider}
                renderItem={({ item }) => (
                  <RecipeMiniCard
                    title={item.title}
                    calories={item.calories}
                    image={item.image}
                    onPress={() => navigation.navigate('Recettes', { screen: 'RecipeDetail', params: item })}
                  />
                )}
              />
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  topNavLeft: {
    width: 72,
    justifyContent: 'center',
  },
  topNavRight: {
    width: 72,
    alignItems: 'flex-end',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2563EB',
    flex: 1,
    textAlign: 'center',
  },
  settingsTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  settingsBackBtn: {
    width: 72,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  settingsTopTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingsTopRightSpacer: {
    width: 72,
  },
  settingsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
  },
  settingsGroup: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#E9EEF4',
    marginLeft: 60,
  },
  settingsVersion: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  arrowBackIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  settingsSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingsSubLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  editHint: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  editError: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 12,
    fontWeight: '600',
  },
  settingsLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
    marginTop: 4,
  },
  settingsLogoutIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#EF4444',
  },
  settingsLogoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 36,
    backgroundColor: '#FFFFFF',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  heroAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  heroAvatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  heroAvatarInitial: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroEdit: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEditIcon: {
    width: 13,
    height: 13,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  settingIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroEmail: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  heroSince: {
    marginTop: 2,
    fontSize: 11,
    color: '#CBD5E1',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    padding: 16,
    marginBottom: 18,
  },
  optionList: {
    gap: 12,
  },

  cardHint: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 12,
    color: '#9CA3AF',
  },
  calorieSummary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  calorieSummaryValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#2563EB',
    lineHeight: 38,
    minWidth: 80,
  },
  calorieSummaryUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#60A5FA',
    paddingBottom: 4,
  },
  calorieSummaryEmpty: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
    alignItems: 'center',
  },
  calorieSummaryEmptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  calorieRangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  calorieChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  calorieChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  calorieChipTextActive: {
    color: '#2563EB',
  },
  calorieInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  saveFullBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveFullText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },

  favHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  favLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  favSlider: {
    paddingTop: 12,
    paddingBottom: 6,
    gap: 12,
  },
  emptyFavorites: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyFavoritesText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '700',
  },
  emptyFavoritesSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },

});

export default ProfileScreen;
