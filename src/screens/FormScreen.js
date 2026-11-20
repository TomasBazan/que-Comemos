import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import Chip from '../components/Chip';
import { colors, CATEGORIES } from '../theme';

const toLines = (text) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export default function FormScreen({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[1]);
  const [minutes, setMinutes] = useState(initial?.minutes ? String(initial.minutes) : '');
  const [servings, setServings] = useState(initial?.servings ? String(initial.servings) : '');
  const [ingredients, setIngredients] = useState((initial?.ingredients ?? []).join('\n'));
  const [steps, setSteps] = useState((initial?.steps ?? []).join('\n'));

  const submit = () => {
    const ingList = toLines(ingredients);
    if (!name.trim()) return Alert.alert('Falta el nombre', 'Poné un nombre para la receta.');
    if (ingList.length === 0) return Alert.alert('Faltan ingredientes', 'Agregá al menos un ingrediente.');
    onSave({
      ...initial,
      name: name.trim(),
      category,
      minutes: parseInt(minutes, 10) || null,
      servings: parseInt(servings, 10) || null,
      ingredients: ingList,
      steps: toLines(steps),
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.topBar}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
        <Text style={styles.topTitle}>{initial ? 'Editar receta' : 'Nueva receta'}</Text>
        <Pressable onPress={submit} hitSlop={12}>
          <Text style={styles.save}>Guardar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ej: Ñoquis de papa"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <View key={c} style={{ marginBottom: 8 }}>
              <Chip label={c} active={category === c} onPress={() => setCategory(c)} />
            </View>
          ))}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>Tiempo (min)</Text>
            <TextInput
              style={styles.input}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Porciones</Text>
            <TextInput
              style={styles.input}
              value={servings}
              onChangeText={setServings}
              keyboardType="number-pad"
              placeholder="4"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <Text style={styles.label}>Ingredientes (uno por línea)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          textAlignVertical="top"
          placeholder={'1 kg de papas\n300 g de harina\n1 huevo'}
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Pasos (uno por línea)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={steps}
          onChangeText={setSteps}
          multiline
          textAlignVertical="top"
          placeholder={'Hervir las papas\nHacer un puré\nMezclar con la harina'}
          placeholderTextColor={colors.muted}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cancel: { color: colors.muted, fontSize: 16 },
  save: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 60 },
  label: { fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  multiline: { minHeight: 120 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row' },
});
