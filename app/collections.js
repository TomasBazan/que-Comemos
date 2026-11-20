import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from '../src/components/button';
import { createCollection, deleteCollection, listCollections } from '../src/lib/api';
import { friendlyError } from '../src/lib/supabase';
import { useData } from '../src/lib/use-data';
import { colors, ui } from '../src/theme';

export default function Collections() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, reload } = useData(listCollections, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createCollection(name);
      setName('');
      await reload();
    } catch (e) {
      Alert.alert('No se pudo', /duplicate|unique/i.test(e.message) ? 'Ya tenés una colección con ese nombre.' : friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (c) =>
    Alert.alert('Borrar colección', `¿Borrar "${c.name}"? Las recetas no se borran.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCollection(c.id);
            await reload();
          } catch (e) {
            Alert.alert('No se pudo', friendlyError(e));
          }
        },
      },
    ]);

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={ui.muted}>Organizá tus recetas como quieras: "Para invitados", "Rápidas", "Sin TACC"…</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={name}
              onChangeText={setName}
              placeholder="Nueva colección"
              placeholderTextColor={colors.muted}
              onSubmitEditing={add}
              maxLength={40}
            />
            <Button title="Crear" onPress={add} loading={busy} />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[ui.card, styles.row]}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={ui.muted}>{item.collection_recipes.length} recetas</Text>
          <Pressable onPress={() => remove(item)} hitSlop={10} style={{ marginLeft: 16 }} accessibilityLabel="Borrar colección">
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
});
