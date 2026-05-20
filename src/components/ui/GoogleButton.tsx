import React from "react";
import { Image, StyleSheet, View } from "react-native";
import AppButton from "./AppButton";

type GoogleButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

const googleLogo = require("../../../assets/figma/login/google-logo.png");

export default function GoogleButton({
  onPress,
  disabled = false,
  loading = false,
}: GoogleButtonProps) {
  return (
    <View style={styles.wrap}>
      <AppButton
        title="Continuer avec Google"
        onPress={onPress}
        disabled={disabled}
        loading={loading}
        variant="secondary"
      />
      <Image source={googleLogo} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  logo: {
    position: "absolute",
    left: 66.7,
    top: 18,
    width: 20,
    height: 20,
    pointerEvents: "none",
  },
});

