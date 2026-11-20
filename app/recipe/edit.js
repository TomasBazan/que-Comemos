import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from '../../src/components/button';
import Chip from '../../src/components/chip';
import { getRecipe, listCollections, saveRecipe, setInCollection } from '../../src/lib/api';
import { friendlyError } from '../../src/lib/supabase';
import { colors, ui } from '../../src/theme';

const emptyRow = () => ({ key: Math.random().toString(36).slice(2), name: '', quantity: '' });

export default function EditRecipe() {
  const { id } = useLocalSearchParams();
  const editing = !!id;
  const [loaded, setLoaded] = useState(!editing);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [servings, setServings] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);
  const [steps, setSteps] = useState('');
  const [collections, setCollections] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCollections().then(setCollections).catch(() => {});
    if (!editing) return;
    getRecipe(id)
      .then((r) => {
        if (!r) return;
        setName(r.name);
        setMinutes(r.minutes ? String(r.minutes) : '');
        setServings(r.servings ? String(r.servings) : '');
        setIsPublic(r.visibility === 'public');
        setRows([...r.recipe_ingredients.map((i) => ({ key: i.id, name: i.name, quantity: i.quantity ?? '' })), emptyRow()]);
        setSteps(r.steps.join('\n'));
        setLoaded(true);
      })
      .catch((e) => Alert.alert('No se pudo cargar', friendlyError(e)));
  }, [id, editing]);

  const updateRow = (key, field, value) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, [field]: value } : r));
      // Siempre dejamos una fila vacía al final para seguir escribiendo.
      if (next[next.length - 1].name.trim()) next.push(emptyRow());
      return next;
    });
  };
  const removeRow = (key) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  const submit = async () => {
    const ingredients = rows
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim(), quantity: r.quantity.trim() }));
    if (!name.trim()) return Alert.alert('Falta el nombre', 'Poné un nombre para la receta.');
    if (ingredients.length === 0) return Alert.alert('Faltan ingredientes', 'Agregá al menos un ingrediente.');
    setSaving(true);
    try {
      const recipeId = await saveRecipe({
        id,
        name: name.trim(),
        minutes: parseInt(minutes, 10) || null,
        servings: parseInt(servings, 10) || null,
        visibility: isPublic ? 'public' : 'private',
        steps: steps
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        ingredients,
      });
      if (!editing) {
        await Promise.all([...selected].map((cid) => setInCollection(cid, recipeId, true)));
        router.replace(`/recipe/${recipeId}`);
      } else {
        router.back();
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 40 }}>Cargando…</Text>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editing ? 'Editar receta' : 'Nueva receta' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={ui.label}>Nombre</Text>
        <TextInput
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="Ej: Ñoquis de papa"
          placeholderTextColor={colors.muted}
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Tiempo (min)</Text>
            <TextInput style={ui.input} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="30" placeholderTextColor={colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Porciones</Text>
            <TextInput style={ui.input} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="4" placeholderTextColor={colors.muted} />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>{isPublic ? '🌎 Pública' : '🔒 Privada'}</Text>
            <Text style={ui.muted}>
              {isPublic ? 'Cualquier usuario de la app la puede ver.' : 'Solo vos y los integrantes de tus grupos.'}
            </Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary }} thumbColor="#fff" />
        </View>

        <Text style={ui.label}>Ingredientes</Text>
        {rows.map((r) => (
          <View key={r.key} style={styles.ingRow}>
            <TextInput
              style={[ui.input, { flex: 2 }]}
              value={r.name}
              onChangeText={(v) => updateRow(r.key, 'name', v)}
              placeholder="Ingrediente"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[ui.input, { flex: 1 }]}
              value={r.quantity}
              onChangeText={(v) => updateRow(r.key, 'quantity', v)}
              placeholder="Cantidad"
              placeholderTextColor={colors.muted}
            />
            <Pressable onPress={() => removeRow(r.key)} hitSlop={8} accessibilityLabel="Quitar ingrediente">
              <Ionicons name="close-circle-outline" size={24} color={colors.muted} />
            </Pressable>
          </View>
        ))}

        <Text style={ui.label}>Pasos (uno por línea)</Text>
        <TextInput
          style={[ui.input, { minHeight: 140 }]}
          value={steps}
          onChangeText={setSteps}
          multiline
          textAlignVertical="top"
          placeholder={'Hervir las papas\nHacer un puré\nMezclar con la harina'}
          placeholderTextColor={colors.muted}
        />

        {!editing && collections.length > 0 && (
          <>
            <Text style={ui.label}>Guardar en</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {collections.map((c) => (
                <View key={c.id} style={{ marginBottom: 8 }}>
                  <Chip
                    label={c.name}
                    active={selected.has(c.id)}
                    onPress={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                        return next;
                      })
                    }
                  />
                </View>
              ))}
            </View>
          </>
        )}

        <Button title="Guardar receta" onPress={submit} loading={saving} style={{ marginTop: 28 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 60 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, ...ui.card },
  switchTitle: { fontWeight: '700', color: colors.text, fontSize: 16, marginBottom: 2 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
});
