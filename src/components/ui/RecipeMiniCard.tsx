import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

type RecipeMiniCardProps = {
  title: string;
  calories?: number;
  image?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function RecipeMiniCard({ title, calories, image, onPress, style }: RecipeMiniCardProps) {
  return (
    <TouchableOpacity style={[styles.card, style]} activeOpacity={0.9} onPress={onPress}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder} />
      )}
      <View style={styles.footer}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {calories !== undefined ? <Text style={styles.meta}>{calories} kcal</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 190,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEFF3',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 110,
    backgroundColor: '#E5E7EB',
  },
  placeholder: {
    width: '100%',
    height: 110,
    backgroundColor: '#E5E7EB',
  },
  footer: {
    padding: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  meta: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});

