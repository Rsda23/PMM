import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type ObjectiveOptionProps = {
  label: string;
  description: string;
  icon: string;
  iconSource?: ImageSourcePropType;
  active: boolean;
  onPress: () => void;
};

export default function ObjectiveOption({ label, description, icon, iconSource, active, onPress }: ObjectiveOptionProps) {
  const iconCheckWhite = require('../../../assets/figma/profil/icon-check-white.png');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.base, active && styles.baseActive]}
    >
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        {iconSource ? (
          <Image source={iconSource} style={styles.iconImg} />
        ) : (
          <Ionicons name={icon} size={18} color={active ? '#FFFFFF' : '#2563EB'} />
        )}
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.desc, active && styles.descActive]} numberOfLines={2}>
          {description}
        </Text>
      </View>
      <View style={[styles.check, active && styles.checkActive]}>
        {active ? <Image source={iconCheckWhite} style={styles.checkIconImg} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    backgroundColor: '#FFFFFF',
  },
  baseActive: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'transparent',
  },
  iconImg: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#2563EB',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  labelActive: {
    color: '#0F172A',
  },
  desc: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: '#9CA3AF',
  },
  descActive: {
    color: '#64748B',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkIconImg: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
  },
});

