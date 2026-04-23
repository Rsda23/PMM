import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type ProfileStatCardProps = {
  icon?: string;
  iconSource?: ImageSourcePropType;
  label: string;
  value: string;
  variant?: 'default' | 'highlight';
  onPress?: () => void;
};

export default function ProfileStatCard({ icon, iconSource, label, value, variant = 'default', onPress }: ProfileStatCardProps) {
  const highlight = variant === 'highlight';
  return (
    <TouchableOpacity
      style={[styles.card, highlight && styles.cardHighlight]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
      <View style={styles.topRow}>
        <Text style={[styles.label, highlight && styles.labelHighlight]} numberOfLines={1}>
          {label}
        </Text>
        {iconSource ? (
          <Image source={iconSource} style={[styles.iconImg, highlight && styles.iconImgHighlight]} />
        ) : icon ? (
          <Ionicons name={icon} size={18} color={highlight ? '#FFFFFF' : '#94A3B8'} />
        ) : null}
      </View>
      <Text style={[styles.value, highlight && styles.valueHighlight]} numberOfLines={1}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 74,
  },
  cardHighlight: {
    backgroundColor: '#3B82F6',
    borderColor: '#6D86AF',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  valueHighlight: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelHighlight: {
    color: 'rgba(255,255,255,0.85)',
  },
  iconImg: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  iconImgHighlight: {
    tintColor: '#FFFFFF',
  },
});

