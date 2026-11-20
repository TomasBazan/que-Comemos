import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from '../../src/components/button';
import Chip from '../../src/components/chip';
import { deleteRecipe, getRecipe, listCollections, setInCollection } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { friendlyError } from '../../src/lib/supabase';
import { useData } from '../../src/lib/use-data';
import { colors, ui } from '../../src/theme';

export default function RecipeDetail() {
  const { id } = useLocalSearchParams();
  const { userId } = useAuth();
  const [busy, setBusy] = useState(null);

  const { data, error, reload } = useData(async () => {
    const [recipe, collections] = await Promise.all([getRecipe(id), listCollections()]);
    return { recipe, collections };
  }, [id]);

  if (error) return <Text style={styles.msg}>No se pudo cargar la receta.</Text>;
  if (!data) return <Text style={styles.msg}>Cargando…</Text>;
  const { recipe, collections } = data;
  if (!recipe) return <Text style={styles.msg}>Esta receta ya no existe.</Text>;

  const mine = recipe.owner_id === userId;
  const inCollection = (c) => c.collection_recipes.some((x) => x.recipe_id === recipe.id);
  const favorites = collections.find((c) => c.name === 'Favoritas');

  const toggle = async (c) => {
    setBusy(c.id);
    try {
      await setInCollection(c.id, recipe.id, !inCollection(c));
      await reload();
    } catch (e) {
      Alert.alert('No se pudo', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Eliminar receta', `¿Seguro que querés eliminar "${recipe.name}"? También se quita del plan.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecipe(recipe.id);
            router.back();
          } catch (e) {
            Alert.alert('No se pudo', friendlyError(e));
          }
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 20 }}>
              {favorites && (
                <Pressable onPress={() => toggle(favorites)} hitSlop={10} accessibilityLabel="Favorita">
                  <Ionicons
                    name={inCollection(favorites) ? 'star' : 'star-outline'}
                    size={24}
                    color={inCollection(favorites) ? colors.fav : colors.muted}
                  />
                </Pressable>
              )}
              {mine && (
                <Pressable onPress={() => router.push({ pathname: '/recipe/edit', params: { id: recipe.id } })} hitSlop={10}>
                  <Ionicons name="create-outline" size={24} color={colors.primary} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{recipe.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.badge}>{recipe.visibility === 'public' ? '🌎 Pública' : '🔒 Privada'}</Text>
          {recipe.minutes ? <Text style={styles.meta}>⏱ {recipe.minutes} min</Text> : null}
          {recipe.servings ? <Text style={styles.meta}>🍽 {recipe.servings} porciones</Text> : null}
        </View>
        <Text style={[ui.muted, { marginTop: 6 }]}>
          Por {mine ? 'vos' : recipe.owner?.display_name ?? 'Qué Comemos'}
        </Text>

        <Button
          title="📅  Agregar al plan"
          onPress={() => router.push({ pathname: '/plan/add', params: { recipeId: recipe.id } })}
          style={{ marginTop: 20 }}
        />

        <Text style={styles.section}>Ingredientes</Text>
        {recipe.recipe_ingredients.length === 0 && <Text style={ui.muted}>Sin ingredientes cargados.</Text>}
        {recipe.recipe_ingredients.map((ing) => (
          <View key={ing.id} style={styles.ingredient}>
            <Text style={styles.ingName}>•  {ing.name}</Text>
            {ing.quantity ? <Text style={styles.ingQty}>{ing.quantity}</Text> : null}
          </View>
        ))}

        <Text style={styles.section}>Preparación</Text>
        {recipe.steps.length === 0 && <Text style={ui.muted}>Sin pasos cargados.</Text>}
        {recipe.steps.map((step, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        <Text style={styles.section}>En mis colecciones</Text>
        <View style={styles.chips}>
          {collections.map((c) => (
            <View key={c.id} style={{ marginBottom: 8, opacity: busy === c.id ? 0.5 : 1 }}>
              <Chip label={(inCollection(c) ? '✓ ' : '') + c.name} active={inCollection(c)} onPress={() => toggle(c)} />
            </View>
          ))}
        </View>

        {mine && <Button title="Eliminar receta" variant="danger" onPress={confirmDelete} style={{ marginTop: 32 }} />}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  msg: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10, gap: 12 },
  badge: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meta: { color: colors.muted },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 28, marginBottom: 8 },
  ingredient: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  ingName: { fontSize: 16, color: colors.text, flex: 1 },
  ingQty: { fontSize: 15, color: colors.muted, marginLeft: 12 },
  step: { flexDirection: 'row', marginBottom: 12 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '700',
    marginRight: 10,
    overflow: 'hidden',
  },
  stepText: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
