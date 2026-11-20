import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { colors, CATEGORY_EMOJI } from '../theme';

export default function DetailScreen({ recipe, onBack, onEdit, onDelete, onToggleFavorite }) {
  const confirmDelete = () => {
    Alert.alert('Eliminar receta', `¿Seguro que querés eliminar "${recipe.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(recipe.id) },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.topBtn}>← Volver</Text>
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => onToggleFavorite(recipe.id)} hitSlop={12} style={{ marginRight: 20 }}>
            <Text style={[styles.star, recipe.favorite && { color: colors.fav }]}>{recipe.favorite ? '★' : '☆'}</Text>
          </Pressable>
          <Pressable onPress={() => onEdit(recipe.id)} hitSlop={12}>
            <Text style={styles.topBtn}>Editar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emoji}>{CATEGORY_EMOJI[recipe.category] ?? '🍽️'}</Text>
        <Text style={styles.title}>{recipe.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.badge}>{recipe.category}</Text>
          {recipe.minutes ? <Text style={styles.meta}>⏱ {recipe.minutes} min</Text> : null}
          {recipe.servings ? <Text style={styles.meta}>🍽 {recipe.servings} porciones</Text> : null}
        </View>

        <Text style={styles.section}>Ingredientes</Text>
        {recipe.ingredients.map((ing, i) => (
          <Text key={i} style={styles.ingredient}>
            •  {ing}
          </Text>
        ))}

        <Text style={styles.section}>Preparación</Text>
        {recipe.steps.length === 0 ? <Text style={styles.metaMuted}>Sin pasos cargados.</Text> : null}
        {recipe.steps.map((step, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
          <Text style={styles.deleteText}>Eliminar receta</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBtn: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  star: { fontSize: 22, color: colors.muted },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  emoji: { fontSize: 48 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 },
  badge: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 12,
    overflow: 'hidden',
  },
  meta: { color: colors.muted, marginRight: 12 },
  metaMuted: { color: colors.muted },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 8 },
  ingredient: { fontSize: 16, color: colors.text, paddingVertical: 4 },
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
  deleteBtn: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteText: { color: colors.danger, fontWeight: '600', fontSize: 16 },
});
