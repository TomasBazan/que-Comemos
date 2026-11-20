import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from '../../src/components/button';
import Chip from '../../src/components/chip';
import { addToPlan, listCollections, listRecipes } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { addDays, fromDayString, shortDayLabel, SLOTS, toDayString, today } from '../../src/lib/dates';
import { friendlyError } from '../../src/lib/supabase';
import { norm } from '../../src/lib/text';
import { useData } from '../../src/lib/use-data';
import { colors, ui } from '../../src/theme';

// Slot sugerido según la hora (si planeás a la noche, probablemente sea la cena).
function suggestedSlot() {
  const h = new Date().getHours();
  if (h < 11) return 'desayuno';
  if (h < 15) return 'almuerzo';
  if (h < 19) return 'merienda';
  return 'cena';
}

export default function AddToPlan() {
  const params = useLocalSearchParams();
  const { activeGroup } = useAuth();
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState(params.day ?? toDayString(today()));
  const [slot, setSlot] = useState(suggestedSlot());
  const [recipeId, setRecipeId] = useState(params.recipeId ?? null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const { data } = useData(async () => {
    const [recipes, collections] = await Promise.all([listRecipes(), listCollections()]);
    return { recipes, collections };
  }, []);

  // Días: 14 a partir de hoy, más el día elegido si quedó fuera de rango.
  const dayOptions = useMemo(() => {
    const list = Array.from({ length: 14 }, (_, i) => toDayString(addDays(today(), i)));
    if (!list.includes(day)) list.unshift(day);
    return list;
  }, [day]);

  const recipes = useMemo(() => {
    let list = data?.recipes ?? [];
    if (filter !== 'all') {
      const ids = new Set(data?.collections.find((c) => c.id === filter)?.collection_recipes.map((x) => x.recipe_id));
      list = list.filter((r) => ids.has(r.id));
    }
    const q = norm(query);
    if (q) list = list.filter((r) => norm(r.name).includes(q));
    return list;
  }, [data, filter, query]);

  const chosen = data?.recipes.find((r) => r.id === recipeId);

  const save = async () => {
    if (!recipeId) return Alert.alert('Elegí una receta', 'Tocá la receta que querés comer.');
    if (!activeGroup) return;
    setSaving(true);
    try {
      await addToPlan(activeGroup.id, day, slot, recipeId);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View>
      <Text style={ui.label}>¿Qué día?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {dayOptions.map((d) => (
          <Chip key={d} label={d === toDayString(today()) ? 'Hoy' : shortDayLabel(fromDayString(d))} active={d === day} onPress={() => setDay(d)} />
        ))}
      </ScrollView>

      <Text style={ui.label}>¿Qué comida?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {SLOTS.map((s) => (
          <View key={s.key} style={{ marginBottom: 8 }}>
            <Chip label={s.label} active={slot === s.key} onPress={() => setSlot(s.key)} />
          </View>
        ))}
      </View>

      <Text style={ui.label}>¿Qué receta?</Text>
      {chosen && (
        <View style={[ui.card, styles.chosen]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.ok} />
          <Text style={styles.chosenText} numberOfLines={1}>
            {chosen.name}
          </Text>
        </View>
      )}
      <TextInput
        style={[ui.input, { marginTop: 8 }]}
        placeholder="Buscar receta…"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
        <Chip label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} />
        {(data?.collections ?? []).map((c) => (
          <Chip key={c.id} label={c.name} active={filter === c.id} onPress={() => setFilter(c.id)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={recipes}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={[ui.muted, { textAlign: 'center', marginTop: 20 }]}>{data ? 'No hay recetas acá.' : 'Cargando…'}</Text>}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, item.id === recipeId && styles.rowActive]} onPress={() => setRecipeId(item.id)}>
            <Text style={styles.rowText} numberOfLines={1}>
              {item.name}
            </Text>
            {item.id === recipeId && <Ionicons name="checkmark" size={20} color={colors.primary} />}
          </Pressable>
        )}
      />
      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <Button title="Agregar al plan" onPress={save} loading={saving} disabled={!recipeId} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  chosenText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowActive: { backgroundColor: colors.primarySoft },
  rowText: { flex: 1, fontSize: 16, color: colors.text },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
