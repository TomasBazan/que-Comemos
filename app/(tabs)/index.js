import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Chip from '../../src/components/chip';
import { listCollections, listRecipes } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { norm } from '../../src/lib/text';
import { useData } from '../../src/lib/use-data';
import { colors, ui } from '../../src/theme';

export default function Recipes() {
  const { userId } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'mine' | collection id

  const { data, error, refreshing, pullToRefresh } = useData(
    async () => {
      const [recipes, collections] = await Promise.all([listRecipes(), listCollections()]);
      return { recipes, collections };
    },
    [userId],
  );

  const recipes = data?.recipes ?? [];
  const collections = data?.collections ?? [];
  const favorites = collections.find((c) => c.name === 'Favoritas');
  const favIds = new Set(favorites?.collection_recipes.map((x) => x.recipe_id));

  const filtered = useMemo(() => {
    const q = norm(query);
    let list = recipes;
    if (filter === 'mine') list = list.filter((r) => r.owner_id === userId);
    else if (filter !== 'all') {
      const ids = new Set(collections.find((c) => c.id === filter)?.collection_recipes.map((x) => x.recipe_id));
      list = list.filter((r) => ids.has(r.id));
    }
    if (q) {
      list = list.filter((r) => norm(r.name).includes(q) || r.recipe_ingredients.some((i) => norm(i.name).includes(q)));
    }
    return list;
  }, [recipes, collections, filter, query, userId]);

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={[ui.input, styles.search]}
        placeholder="Buscar por nombre o ingrediente…"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
      />

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Mías" active={filter === 'mine'} onPress={() => setFilter('mine')} />
          {collections.map((c) => (
            <Chip
              key={c.id}
              label={c.name === 'Favoritas' ? '★ Favoritas' : c.name}
              active={filter === c.id}
              onPress={() => setFilter(filter === c.id ? 'all' : c.id)}
            />
          ))}
          <Chip label="＋ Colección" onPress={() => router.push('/collections')} />
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error
              ? 'No se pudieron cargar las recetas. Deslizá hacia abajo para reintentar.'
              : !data
                ? 'Cargando…'
                : query
                  ? 'No hay recetas que coincidan con la búsqueda.'
                  : filter === 'all'
                    ? 'Todavía no hay recetas. ¡Creá la primera con el botón +!'
                    : 'Esta lista está vacía. Agregá recetas desde su detalle.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[ui.card, styles.card]}
            onPress={() => router.push(`/recipe/${item.id}`)}
            android_ripple={{ color: colors.border }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {favIds.has(item.id) ? '★ ' : ''}
                {item.name}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.minutes ? `${item.minutes} min · ` : ''}
                {item.recipe_ingredients.length} ingredientes
                {' · '}
                {item.owner_id === userId ? 'Mía' : item.owner?.display_name ?? 'Qué Comemos'}
                {item.visibility === 'private' ? ' · 🔒' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/recipe/edit')} accessibilityLabel="Nueva receta">
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: 16, marginTop: 4 },
  chips: { paddingHorizontal: 16, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24 },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, overflow: 'hidden' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { color: colors.muted, marginTop: 3, fontSize: 13 },
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
});
