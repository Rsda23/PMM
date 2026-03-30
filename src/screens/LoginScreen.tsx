import React, { useMemo, useState } from "react";
import {
  Alert,
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
import AppDivider from "../components/ui/AppDivider";
import AppInput from "../components/ui/AppInput";
import GoogleButton from "../components/ui/GoogleButton";
import type { AuthStackParamList } from "../navigation/AuthStack";
import { login } from "../services/firebase/auth";
import { Image } from "react-native";

const heroLockIcon = require("../../assets/figma/login/hero-lock-bg.png");
const iconEmail = require("../../assets/figma/login/icon-email.png");
const iconPassword = require("../../assets/figma/login/icon-password.png");
const iconArrowRight = require("../../assets/figma/login/icon-arrow-right.png");

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Erreur", "Renseigne email et mot de passe.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // onAuthStateChanged dans App.tsx met à jour l'état → affiche Navbar
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Connexion impossible";
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
              <Text style={styles.brand}>PMM</Text>

              <View style={styles.hero}>
                <View style={styles.heroIconWrap}>
                  <Image source={heroLockIcon} style={styles.heroLockImg} resizeMode="contain" />
                </View>
                <Text style={styles.title}>Connexion</Text>
                <Text style={styles.subtitle}>L&apos;architecte de votre nutrition.</Text>
              </View>

              <View style={styles.form}>
                <AppInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nom@exemple.com"
                  iconName="mail-outline"
                  iconSource={iconEmail}
                  editable={!loading}
                  inputProps={{
                    keyboardType: "email-address",
                    textContentType: "emailAddress",
                  }}
                />

                <View style={styles.passwordBlock}>
                  <AppInput
                    label="Mot de passe"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mot de passe"
                    iconName="key-outline"
                    iconSource={iconPassword}
                    secureTextEntry
                    editable={!loading}
                    inputProps={{ textContentType: "password" }}
                  />

                  <TouchableOpacity
                    style={styles.forgot}
                    onPress={() => navigation.navigate("ForgotPassword")}
                    disabled={loading}
                  >
                    <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                  </TouchableOpacity>
                </View>

                <AppButton
                  title="Se connecter"
                  onPress={handleLogin}
                  disabled={!canSubmit}
                  loading={loading}
                  rightIcon="arrow-forward"
                  rightIconSource={iconArrowRight}
                />
              </View>

              <AppDivider />

              <GoogleButton
                onPress={() => Alert.alert("Info", "Connexion Google a brancher.")}
                disabled={loading}
              />

              <View style={styles.signupRow}>
                <Text style={styles.signupText}>Pas de compte ? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Register")}
                  disabled={loading}
                >
                  <Text style={styles.signupLink}>S&apos;inscrire</Text>
                </TouchableOpacity>
              </View>
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
  brand: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#1D4ED8",
    marginBottom: 8,
  },
  main: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  container: {
    width: "100%",
    maxWidth: 448,
    gap: 40,
  },
  hero: {
    height: 163,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  heroIconWrap: {
    position: "absolute",
    top: 0,
    width: 56,
    height: 63.5,
    borderRadius: 14,
    backgroundColor: "#DCEBFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLockImg: {
    width: 24,
    height: 31.5,
  },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -0.7,
    color: "#1A1C1C",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#424752",
    textAlign: "center",
  },
  form: {
    gap: 24,
  },
  passwordBlock: {
    gap: 8,
  },
  forgot: {
    alignSelf: "flex-end",
    paddingTop: 4,
  },
  forgotText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#004D99",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 8,
  },
  signupText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: "#424752",
  },
  signupLink: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: "#004D99",
  },
});

export default LoginScreen;
