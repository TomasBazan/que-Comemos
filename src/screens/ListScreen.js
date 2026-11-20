import { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ScrollView, StyleSheet } from 'react-native';
import Chip from '../components/Chip';
import { colors, CATEGORIES, CATEGORY_EMOJI } from '../theme';

// Normaliza texto para buscar sin importar mayúsculas ni tildes.
const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function ListScreen({ recipes, onOpen, onCreate, onToggleFavorite }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [onlyFavs, setOnlyFavs] = useState(false);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return recipes
      .filter((r) => !category || r.category === category)
      .filter((r) => !onlyFavs || r.favorite)
      .filter((r) => {
        if (!q) return true;
        if (norm(r.name).includes(q)) return true;
        return r.ingredients.some((ing) => norm(ing).includes(q));
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [recipes, query, category, onlyFavs]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>¿Qué comemos?</Text>
        <Text style={styles.subtitle}>{recipes.length} recetas guardadas</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Buscar por nombre o ingrediente…"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
      />

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="★ Favoritas" active={onlyFavs} onPress={() => setOnlyFavs((v) => !v)} />
          <Chip label="Todas" active={!category} onPress={() => setCategory(null)} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={`${CATEGORY_EMOJI[c]} ${c}`}
              active={category === c}
              onPress={() => setCategory(category === c ? null : c)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>
            {recipes.length === 0 ? 'Todavía no hay recetas. ¡Creá la primera!' : 'No hay recetas que coincidan.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpen(item.id)} android_ripple={{ color: colors.border }}>
            <Text style={styles.emoji}>{CATEGORY_EMOJI[item.category] ?? '🍽️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardMeta}>
                {item.category}
                {item.minutes ? ` · ${item.minutes} min` : ''}
                {` · ${item.ingredients.length} ingredientes`}
              </Text>
            </View>
            <Pressable hitSlop={12} onPress={() => onToggleFavorite(item.id)} accessibilityLabel="Marcar favorita">
              <Text style={[styles.star, item.favorite && { color: colors.fav }]}>{item.favorite ? '★' : '☆'}</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={onCreate} accessibilityLabel="Nueva receta">
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.muted, marginTop: 2 },
  search: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.text,
  },
  chips: { paddingHorizontal: 16, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  emoji: { fontSize: 28, marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { color: colors.muted, marginTop: 2, fontSize: 13 },
  star: { fontSize: 24, color: colors.muted, paddingLeft: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34 },
});
