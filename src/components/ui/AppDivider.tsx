import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function AppDivider() {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <View style={styles.mid}>
        <Text style={styles.text}>Ou</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E2E2",
  },
  mid: {
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#727783",
  },
});

