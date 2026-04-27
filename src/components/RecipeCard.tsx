import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const iconDifficulty = require('../../assets/figma/recette/icon-difficulty.png');
const iconStar = require('../../assets/figma/recette/icon-star.png');
const iconStarWhite = require('../../assets/figma/recette/star-white.png');

const TAG_LABELS: Record<string, string> = {
  perte_poids: 'Perte de poids',
  prise_masse: 'Prise de masse',
  equilibre: 'Équilibré',
  vegetarien: 'Végétarien',
  riche_proteine: 'Protéines',
  rapide: 'Rapide',
  sans_gluten: 'Sans Gluten',
  faible_carb: 'Faible Carb',
  petit_dej: 'Petit-Dej',
  energie: 'Énergie',
};

type RecipeCardProps = {
  id: string;
  title: string;
  calories?: number;
  tags?: string[];
  image?: string | null;
  rating?: number;
  difficulty?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
};

const RecipeCard: React.FC<RecipeCardProps> = ({
  id,
  title,
  calories,
  tags,
  image,
  rating,
  difficulty,
  isFavorite,
  onToggleFavorite,
  onPress,
}) => {
  const displayTags = (tags ?? []).slice(0, 2);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <View style={styles.imageWrapper}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="restaurant-outline" size={40} color="#ccc" />
          </View>
        )}
        {rating !== undefined && (
          <View style={styles.ratingBadge}>
            <Image source={iconStar} style={styles.starIcon} />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        )}
        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            activeOpacity={0.8}
          >
            <Image
              source={iconStarWhite}
              style={[styles.favoriteIcon, isFavorite && styles.favoriteIconActive]}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {displayTags.length > 0 && (
          <View style={styles.tagsRow}>
            {displayTags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{TAG_LABELS[tag] ?? tag}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {calories !== undefined && (
              <Text style={styles.calories}>{calories} kcal</Text>
            )}
          </View>
          <View style={styles.footerRight}>
            {difficulty ? (
              <View style={styles.diffRow}>
                <Image source={iconDifficulty} style={styles.diffIcon} />
                <Text style={styles.diffText}>{difficulty}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageWrapper: {
    height: 192,
    width: '100%',
    backgroundColor: '#E5E7EB',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  ratingBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  starIcon: {
    width: 11,
    height: 11,
    resizeMode: 'contain',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    tintColor: 'rgba(255,255,255,0.7)',
  },
  favoriteIconActive: {
    tintColor: '#FACC15',
  },
  content: {
    padding: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: '#e8e8e8',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagChipText: {
    fontSize: 10,
    color: '#424752',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1c1c',
    marginBottom: 12,
    lineHeight: 25,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calories: {
    fontSize: 14,
    color: '#004d99',
    fontWeight: '500',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  diffIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    tintColor: '#727783',
  },
  diffText: {
    fontSize: 14,
    color: '#727783',
  },
});

export default RecipeCard;
