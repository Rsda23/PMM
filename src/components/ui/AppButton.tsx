import React from "react";
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  leftIcon?: string;
  rightIcon?: string;
  rightIconSource?: ImageSourcePropType;
};

export default function AppButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  leftIcon,
  rightIcon,
  rightIconSource,
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  const content = (
    <View style={styles.content}>
      {leftIcon ? (
        <Ionicons
          name={leftIcon}
          size={20}
          color={variant === "primary" ? "#FFFFFF" : "#1A1C1C"}
        />
      ) : null}
      <Text style={[styles.title, variant === "primary" ? styles.titlePrimary : styles.titleSecondary]}>
        {loading ? "Connexion..." : title}
      </Text>
      {rightIconSource ? (
        <Image source={rightIconSource} style={styles.rightIconImg} resizeMode="contain" />
      ) : rightIcon ? (
        <Ionicons
          name={rightIcon}
          size={18}
          color={variant === "primary" ? "#FFFFFF" : "#1A1C1C"}
        />
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, isDisabled && styles.disabled, pressed && !isDisabled && styles.pressed]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={["#1565C0", "#004D99"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primary}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={styles.secondary}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
  },
  primary: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: "center",
    shadowColor: "#004D99",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  secondary: {
    flex: 1,
    backgroundColor: "#F3F3F3",
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  titlePrimary: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  titleSecondary: {
    color: "#1A1C1C",
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
  },
  rightIconImg: {
    width: 13.33,
    height: 13.33,
  },
});

