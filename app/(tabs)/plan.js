import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { listPlan, removeFromPlan } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { addDays, dayLabel, SLOTS, toDayString, today } from '../../src/lib/dates';
import { friendlyError } from '../../src/lib/supabase';
import { useData, useRealtime } from '../../src/lib/use-data';
import { colors, ui } from '../../src/theme';

export default function Plan() {
  const { activeGroup, userId } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const start = addDays(today(), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const from = toDayString(days[0]);
  const to = toDayString(days[6]);

  const { data, reload, refreshing, pullToRefresh } = useData(
    () => (activeGroup ? listPlan(activeGroup.id, from, to) : []),
    [activeGroup?.id, from, to],
  );
  useRealtime('meal_plan', activeGroup?.id, reload);

  const remove = (entry) =>
    Alert.alert('Quitar del plan', `¿Quitar "${entry.recipes?.name}"? Sus ingredientes salen de la lista de compras.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFromPlan(entry.id);
            await reload();
          } catch (e) {
            Alert.alert('No se pudo', friendlyError(e));
          }
        },
      },
    ]);

  if (!activeGroup) return <Text style={styles.msg}>Cargando tu grupo…</Text>;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} colors={[colors.primary]} />}
    >
      <Text style={[ui.muted, { marginBottom: 8 }]}>Plan de {activeGroup.name}</Text>
      <View style={styles.weekNav}>
        <Pressable onPress={() => setWeekOffset((w) => w - 1)} hitSlop={10} accessibilityLabel="Semana anterior">
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.weekTitle}>
          {weekOffset === 0 ? 'Próximos 7 días' : weekOffset > 0 ? `En ${weekOffset} semana${weekOffset > 1 ? 's' : ''}` : `Hace ${-weekOffset} semana${weekOffset < -1 ? 's' : ''}`}
        </Text>
        <Pressable onPress={() => setWeekOffset((w) => w + 1)} hitSlop={10} accessibilityLabel="Semana siguiente">
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {days.map((d) => {
        const ds = toDayString(d);
        const entries = (data ?? []).filter((e) => e.day === ds);
        return (
          <View key={ds} style={[ui.card, styles.day]}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{dayLabel(d)}</Text>
              <Pressable
                onPress={() => router.push({ pathname: '/plan/add', params: { day: ds } })}
                hitSlop={10}
                accessibilityLabel="Agregar comida"
              >
                <Ionicons name="add-circle" size={26} color={colors.primary} />
              </Pressable>
            </View>
            {entries.length === 0 && <Text style={ui.muted}>Nada planeado</Text>}
            {SLOTS.map((slot) => {
              const items = entries.filter((e) => e.slot === slot.key);
              if (!items.length) return null;
              return (
                <View key={slot.key} style={{ marginTop: 6 }}>
                  <Text style={styles.slot}>{slot.label}</Text>
                  {items.map((e) => (
                    <Pressable
                      key={e.id}
                      style={styles.entry}
                      onPress={() => router.push(`/recipe/${e.recipe_id}`)}
                      onLongPress={() => remove(e)}
                    >
                      <Text style={styles.entryName} numberOfLines={1}>
                        {e.recipes?.name ?? 'Receta'}
                      </Text>
                      {e.added_by !== userId && e.adder?.display_name ? (
                        <Text style={styles.adder}>{e.adder.display_name}</Text>
                      ) : null}
                      <Pressable onPress={() => remove(e)} hitSlop={10} accessibilityLabel="Quitar">
                        <Ionicons name="close" size={18} color={colors.muted} />
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  msg: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  content: { padding: 16, paddingBottom: 40 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  weekTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  day: { marginBottom: 10 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dayTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  slot: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  entryName: { flex: 1, fontSize: 16, color: colors.text },
  adder: { fontSize: 12, color: colors.muted },
});
