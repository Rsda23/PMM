import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView as RNScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import AppButton from "../components/ui/AppButton";
import AppInput from "../components/ui/AppInput";
import type { AuthStackParamList } from "../navigation/AuthStack";
import { register } from "../services/firebase/auth";

const iconArrowRight = require("../../assets/figma/login/icon-arrow-right.png");
const iconBack = require("../../assets/figma/register/back-arrow.png");
const registerHero = require("../../assets/figma/register/register-hero.png");

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmit = useMemo(
    () =>
      fullName.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      confirmPassword.length > 0,
    [fullName, email, password, confirmPassword]
  );

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert("Erreur", "Renseigne tous les champs.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit faire au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
      // onAuthStateChanged dans App.tsx met à jour l'état → affiche Navbar
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Inscription impossible";
      Alert.alert("Erreur", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <RNScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.main}>
            <View style={styles.container}>
              <View style={styles.topRow}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Login"))}
                  disabled={loading}
                >
                  <Image source={iconBack} style={styles.backIcon} resizeMode="contain" />
                </TouchableOpacity>
                <Text style={styles.brand}>PMM</Text>
              </View>

              <View style={styles.hero}>
                <Image source={registerHero} style={styles.heroImg} resizeMode="contain" />
                <Text style={styles.title}>Inscription</Text>
                <Text style={styles.subtitle}>Créez votre compte PMM.</Text>
              </View>

              <View style={styles.form}>
                <AppInput
                  label="Nom complet"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Votre nom"
                  editable={!loading}
                  inputProps={{ textContentType: "name" }}
                />

                <AppInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nom@exemple.com"
                  editable={!loading}
                  inputProps={{
                    keyboardType: "email-address",
                    textContentType: "emailAddress",
                  }}
                />

                <AppInput
                  label="Mot de passe"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 6 caractères"
                  secureTextEntry
                  editable={!loading}
                  inputProps={{ textContentType: "newPassword" }}
                />

                <AppInput
                  label="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Retapez votre mot de passe"
                  secureTextEntry
                  editable={!loading}
                  inputProps={{ textContentType: "newPassword" }}
                />

                <View style={styles.ctaWrapper}>
                  <AppButton
                    title={loading ? "Inscription..." : "S'inscrire"}
                    onPress={handleRegister}
                    disabled={!canSubmit || loading}
                  />
                </View>
              </View>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Déjà un compte ? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Login")}
                  disabled={loading}
                >
                  <Text style={styles.loginLink}>Se connecter</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.legalText}>
                EN VOUS INSCRIVANT, VOUS ACCEPTEZ NOS
                {"\n"}
                CONDITIONS D&apos;UTILISATION & POLITIQUE DE
                {"\n"}
                CONFIDENTIALITÉ
              </Text>
            </View>
          </View>
        </RNScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  scrollContent: {
    flexGrow: 1,
  },
  main: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  container: {
    width: "100%",
    maxWidth: 448,
    gap: 20,
  },
  brand: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#1D4ED8",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    width: 22,
    height: 22,
  },
  hero: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  heroImg: {
    width: 56,
    height: 63.5,
    marginBottom: 0,
  },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -0.7,
    color: "#1A1C1C",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#424752",
    textAlign: "center",
  },
  form: {
    gap: 14,
  },
  ctaWrapper: {
    marginTop: 6,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 8,
  },
  loginText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#424752",
  },
  loginLink: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: "#004D99",
  },
  legalText: {
    marginTop: 0,
    textAlign: "center",
    color: "#9AA0AA",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
});

export default RegisterScreen;
