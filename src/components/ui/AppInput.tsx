import React from "react";
import { Image, StyleSheet, Text, TextInput, View, type ImageSourcePropType, type TextInputProps } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type AppInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  iconName?: string;
  iconSource?: ImageSourcePropType;
  secureTextEntry?: boolean;
  editable?: boolean;
  inputProps?: Omit<TextInputProps, "value" | "onChangeText" | "placeholder" | "secureTextEntry" | "editable">;
};

export default function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  iconName,
  iconSource,
  secureTextEntry = false,
  editable = true,
  inputProps,
}: AppInputProps) {
  const hasIcon = Boolean(iconSource || iconName);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        {hasIcon ? (
          <View style={styles.iconWrap}>
            {iconSource ? (
              <Image source={iconSource} style={styles.iconImg} resizeMode="contain" />
            ) : iconName ? (
              <Ionicons name={iconName} size={18} color="#727783" />
            ) : null}
          </View>
        ) : null}
        <TextInput
          style={[styles.input, !hasIcon && styles.inputNoIcon]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#727783"
          secureTextEntry={secureTextEntry}
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
          {...inputProps}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  label: {
    marginLeft: 4,
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#424752",
  },
  field: {
    height: 55,
    borderRadius: 12,
    backgroundColor: "#E8E8E8",
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
  },
  iconWrap: {
    width: 48,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  iconImg: {
    width: 18,
    height: 18,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1A1C1C",
  },
  inputNoIcon: {
    paddingLeft: 16,
  },
});

