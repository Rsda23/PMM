import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

type InfoCardProps = ViewProps & {
  reached?: boolean;
};

export default function InfoCard({ children, style, reached = false, ...props }: InfoCardProps) {
  return <View style={[styles.card, reached && styles.cardReached, style]} {...props}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECEF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  cardReached: {
    borderColor: "#A5D6A7",
    backgroundColor: "#E8F5E9",
  },
});
