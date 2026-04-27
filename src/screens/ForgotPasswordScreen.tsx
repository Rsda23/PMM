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
import { sendPasswordReset } from "../services/firebase/auth";

const iconBack = require("../../assets/figma/register/back-arrow.png");
const iconEmail = require("../../assets/figma/login/icon-email.png");
const iconArrowRight = require("../../assets/figma/login/icon-arrow-right.png");
const forgotHero = require("../../assets/figma/forgot-password/forgot-password-hero.png");

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  const handleSendReset = async () => {
    if (!email.trim()) {
      Alert.alert("Erreur", "Renseigne ton adresse email.");
      return;
    }

    if (!isEmailValid) {
      Alert.alert("Erreur", "Le format de l'email n'est pas valide.");
      return;
    }

    setLoading(true);
    setSent(false);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Envoi du lien impossible.";
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
                <View style={styles.heroIconWrap}>
                  <Image source={forgotHero} style={styles.heroImg} resizeMode="contain" />
                </View>
                <Text style={styles.title}>Mot de passe oublié</Text>
                <Text style={styles.subtitle}>
                  Entrez votre adresse e-mail ci-dessous.
                  {"\n"}
                  Nous vous enverrons un lien pour reinitialiser
                  {"\n"}
                  votre accès.
                </Text>
              </View>

              {sent ? (
                <View style={styles.successBlock}>
                  <Text style={styles.successText}>
                    Un email a été envoyé à {email}. Consulte ta boîte mail puis suis le lien de
                    réinitialisation.
                  </Text>
                  <AppButton
                    title="Retour à la connexion"
                    onPress={() => navigation.navigate("Login")}
                    variant="secondary"
                  />
                </View>
              ) : (
                <View style={styles.form}>
                  <AppInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="exemple@nutrition.fr"
                    iconName="mail-outline"
                    iconSource={iconEmail}
                    editable={!loading}
                    inputProps={{
                      keyboardType: "email-address",
                      textContentType: "emailAddress",
                    }}
                  />

                  <AppButton
                    title={loading ? "Envoi..." : "Envoyer le lien"}
                    onPress={handleSendReset}
                    disabled={!email.trim() || !isEmailValid || loading}
                  />

                  <View style={styles.linkDivider} />

                  <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => navigation.navigate("Login")}
                    disabled={loading}
                  >
                    <Image source={iconBack} style={styles.linkBackIcon} resizeMode="contain" />
                    <Text style={styles.linkText}>Retour à la connexion</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.supportText}>
                Si vous n&apos;avez pas accès à votre boîte mail ou si vous
                {"\n"}
                rencontrez des problèmes, veuillez contacter notre
                {"\n"}
                support technique.
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
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  container: {
    width: "100%",
    maxWidth: 448,
    gap: 24,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    width: 16,
    height: 16,
    tintColor: "#111827",
  },
  brand: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#1D4ED8",
  },
  hero: {
    alignItems: "center",
    gap: 8,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CFE0FF",
    marginBottom: 12,
  },
  heroImg: {
    width: 28,
    height: 28,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.4,
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
    gap: 20,
  },
  linkDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#E2E2E2",
    marginTop: 2,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
  },
  linkBackIcon: {
    width: 14,
    height: 14,
  },
  linkText: {
    color: "#004D99",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  successBlock: {
    gap: 16,
  },
  successText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#424752",
    textAlign: "center",
  },
  supportText: {
    color: "#6C727F",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});

export default ForgotPasswordScreen;
