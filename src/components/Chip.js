import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.active]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { color: colors.text, fontSize: 14 },
  activeText: { color: '#fff', fontWeight: '600' },
});
