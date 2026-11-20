import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { addShoppingItem, deleteShoppingItems, listShopping, setChecked } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { fromDayString, shortDayLabel, slotLabel, toDayString, today } from '../../src/lib/dates';
import { friendlyError } from '../../src/lib/supabase';
import { norm } from '../../src/lib/text';
import { useData, useRealtime } from '../../src/lib/use-data';
import { colors, ui } from '../../src/theme';

// Agrupa los ítems con el mismo ingrediente (ej: "Papas" de dos recetas = una sola fila).
function groupItems(items) {
  const todayStr = toDayString(today());
  const map = new Map();
  for (const it of items) {
    // Solo comidas de hoy en adelante (y lo agregado a mano).
    if (it.meal_plan && it.meal_plan.day < todayStr) continue;
    const key = norm(it.name);
    if (!map.has(key)) map.set(key, { key, name: it.name, items: [] });
    map.get(key).items.push(it);
  }
  return [...map.values()].map((g) => {
    const checked = g.items.every((i) => i.checked);
    const quantities = g.items.map((i) => i.quantity).filter(Boolean);
    const sources = g.items
      .filter((i) => i.meal_plan)
      .map((i) => `${i.meal_plan.recipes?.name ?? 'Receta'} (${shortDayLabel(fromDayString(i.meal_plan.day))} ${slotLabel(i.meal_plan.slot).toLowerCase()})`);
    const lastChecked = g.items
      .filter((i) => i.checked && i.checked_at)
      .sort((a, b) => (a.checked_at < b.checked_at ? 1 : -1))[0];
    return {
      ...g,
      checked,
      quantity: quantities.join(' + '),
      sources: [...new Set(sources)],
      manual: g.items.every((i) => !i.meal_plan),
      checkedBy: checked ? lastChecked?.checker?.display_name : null,
    };
  });
}

export default function Shopping() {
  const { activeGroup } = useAuth();
  const [newItem, setNewItem] = useState('');
  const [pending, setPending] = useState({}); // cambios optimistas: key -> checked

  const { data, reload, refreshing, pullToRefresh } = useData(
    () => (activeGroup ? listShopping(activeGroup.id) : []),
    [activeGroup?.id],
  );
  useRealtime('shopping_items', activeGroup?.id, reload);

  const groups = useMemo(() => groupItems(data ?? []), [data]);
  const isChecked = (g) => (g.key in pending ? pending[g.key] : g.checked);
  const missing = groups.filter((g) => !isChecked(g)).sort((a, b) => a.name.localeCompare(b.name));
  const have = groups.filter((g) => isChecked(g)).sort((a, b) => a.name.localeCompare(b.name));

  const toggle = async (g) => {
    const value = !isChecked(g);
    setPending((p) => ({ ...p, [g.key]: value }));
    try {
      await setChecked(activeGroup.id, g.name, value);
      await reload();
    } catch (e) {
      Alert.alert('No se pudo', friendlyError(e));
    } finally {
      setPending((p) => {
        const { [g.key]: _, ...rest } = p;
        return rest;
      });
    }
  };

  const add = async () => {
    const text = newItem.trim();
    if (!text) return;
    setNewItem('');
    try {
      await addShoppingItem(activeGroup.id, text, null);
      await reload();
    } catch (e) {
      Alert.alert('No se pudo', friendlyError(e));
    }
  };

  const removeManual = (g) =>
    Alert.alert('Quitar de la lista', `¿Quitar "${g.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShoppingItems(g.items.map((i) => i.id));
            await reload();
          } catch (e) {
            Alert.alert('No se pudo', friendlyError(e));
          }
        },
      },
    ]);

  if (!activeGroup) return <Text style={styles.msg}>Cargando tu grupo…</Text>;

  const sections = [
    { title: `Falta (${missing.length})`, data: missing },
    { title: `Ya tenemos (${have.length})`, data: have },
  ];

  return (
    <SectionList
      sections={sections}
      keyExtractor={(g) => g.key}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} colors={[colors.primary]} />}
      ListHeaderComponent={
        <View>
          <Text style={ui.muted}>
            Lista de {activeGroup.name}. Se arma sola con las comidas del plan; lo que tilde alguien del grupo lo ven todos.
          </Text>
          <View style={styles.addRow}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              placeholder="Agregar algo a mano (ej: servilletas)"
              placeholderTextColor={colors.muted}
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={add}
              returnKeyType="done"
            />
            <Pressable onPress={add} hitSlop={8} accessibilityLabel="Agregar">
              <Ionicons name="add-circle" size={36} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={null}
      renderSectionHeader={({ section }) =>
        section.data.length || section === sections[0] ? <Text style={styles.sectionTitle}>{section.title}</Text> : null
      }
      renderSectionFooter={({ section }) =>
        section === sections[0] && section.data.length === 0 ? (
          <Text style={[ui.muted, { marginBottom: 8 }]}>
            {groups.length ? '¡Está todo! 🎉' : data ? 'Nada por ahora. Agregá comidas al plan.' : 'Cargando…'}
          </Text>
        ) : null
      }
      renderItem={({ item: g }) => {
        const checked = isChecked(g);
        return (
          <Pressable style={[ui.card, styles.item]} onPress={() => toggle(g)} onLongPress={g.manual ? () => removeManual(g) : undefined}>
            <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={26} color={checked ? colors.ok : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, checked && styles.itemDone]}>
                {g.name}
                {g.quantity ? <Text style={styles.qty}>  {g.quantity}</Text> : null}
              </Text>
              {g.sources.length > 0 && (
                <Text style={styles.sources} numberOfLines={2}>
                  {g.sources.join(' · ')}
                </Text>
              )}
              {checked && g.checkedBy && <Text style={styles.by}>✓ {g.checkedBy}</Text>}
            </View>
            {g.manual && (
              <Pressable onPress={() => removeManual(g)} hitSlop={10} accessibilityLabel="Quitar">
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  msg: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  sectionTitle: { ...ui.sectionTitle, marginTop: 20, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingVertical: 12 },
  itemName: { fontSize: 16, color: colors.text, fontWeight: '600' },
  itemDone: { color: colors.muted, textDecorationLine: 'line-through' },
  qty: { fontWeight: '400', color: colors.muted, fontSize: 14 },
  sources: { fontSize: 12, color: colors.muted, marginTop: 2 },
  by: { fontSize: 12, color: colors.ok, marginTop: 2 },
});
