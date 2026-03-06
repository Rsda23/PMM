import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useUserStore } from '../store/userStore';

type RecipeCardProps = {
  id: string;
  title: string;
  calories?: number;
  tags?: string[];
  image?: string | null;
  onPress?: () => void;
};

const RecipeCard: React.FC<RecipeCardProps> = ({ id, title, calories, tags, image, onPress }) => {
  const favoriteRecipeIds = useUserStore((state) => state.favoriteRecipeIds);
  const toggleFavorite = useUserStore((state) => state.toggleFavorite);
  const isFavorite = favoriteRecipeIds.includes(id);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      <View style={styles.imageWrapper}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="restaurant-outline" size={32} color="#999" />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <TouchableOpacity
            onPress={() => toggleFavorite(id)}
            style={styles.favoriteButton}
            activeOpacity={0.7}
          >
            <Text style={isFavorite ? styles.favoriteIconActive : styles.favoriteIcon}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>
        {calories !== undefined && <Text style={styles.calories}>{calories} kcal</Text>}
        {tags && tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  imageWrapper: {
    width: 88,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  favoriteButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  favoriteIcon: {
    fontSize: 20,
    color: '#ccc',
  },
  favoriteIconActive: {
    fontSize: 20,
    color: '#ffb300',
  },
  calories: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#1565c0',
  },
});

export default RecipeCard;

