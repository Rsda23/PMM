import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type WeekDayBarProps = {
  label: string;
  isToday: boolean;
  plannedRatio: number;
  consumedRatio: number;
  onPress: () => void;
};

const ratioToLevel = (ratio: number): number => {
  if (ratio <= 0) return 0;
  if (ratio < 0.1) return 1;
  if (ratio < 0.2) return 2;
  if (ratio < 0.3) return 3;
  if (ratio < 0.4) return 4;
  if (ratio < 0.5) return 5;
  if (ratio < 0.6) return 6;
  if (ratio < 0.7) return 7;
  if (ratio < 0.8) return 8;
  if (ratio < 0.9) return 9;
  return 10;
};

const getHeightStyle = (level: number) => {
  switch (level) {
    case 0:
      return styles.h0;
    case 1:
      return styles.h10;
    case 2:
      return styles.h20;
    case 3:
      return styles.h30;
    case 4:
      return styles.h40;
    case 5:
      return styles.h50;
    case 6:
      return styles.h60;
    case 7:
      return styles.h70;
    case 8:
      return styles.h80;
    case 9:
      return styles.h90;
    default:
      return styles.h100;
  }
};

export default function WeekDayBar({ label, isToday, plannedRatio, consumedRatio, onPress }: WeekDayBarProps) {
  const plannedStyle = getHeightStyle(ratioToLevel(plannedRatio));
  const consumedStyle = getHeightStyle(ratioToLevel(consumedRatio));

  return (
    <TouchableOpacity style={styles.weekBarItem} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.miniTrack, isToday && styles.miniTrackToday]}>
        <View style={[styles.miniBarPlanned, plannedStyle]} />
        <View style={[styles.miniBarConsumed, consumedStyle]} />
      </View>
      <Text style={[styles.weekBarLabel, isToday && styles.weekBarLabelToday]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  weekBarItem: {
    alignItems: "center",
    width: 34,
  },
  miniTrack: {
    width: 14,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#EEF1F4",
    justifyContent: "flex-end",
    overflow: "hidden",
    marginBottom: 6,
  },
  miniTrackToday: {
    borderWidth: 1,
    borderColor: "#BBDEFB",
  },
  miniBarPlanned: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#1565C0",
    opacity: 0.35,
  },
  miniBarConsumed: {
    width: "100%",
    backgroundColor: "#43A047",
  },
  weekBarLabel: {
    fontSize: 11,
    color: "#666666",
  },
  weekBarLabelToday: {
    color: "#1565C0",
    fontWeight: "700",
  },
  h0: { height: "0%" },
  h10: { height: "10%" },
  h20: { height: "20%" },
  h30: { height: "30%" },
  h40: { height: "40%" },
  h50: { height: "50%" },
  h60: { height: "60%" },
  h70: { height: "70%" },
  h80: { height: "80%" },
  h90: { height: "90%" },
  h100: { height: "100%" },
});
