import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

export default function Button({ title, onPress, variant = 'primary', loading, disabled, style }) {
  const v = styles[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.base, v.box, (pressed || disabled) && { opacity: 0.6 }, style]}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={[styles.text, v.text]}>{title}</Text>}
    </Pressable>
  );
}

const styles = {
  base: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '700' },
  primary: StyleSheet.create({ box: { backgroundColor: colors.primary }, text: { color: '#fff' } }),
  secondary: StyleSheet.create({
    box: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.text },
  }),
  danger: StyleSheet.create({
    box: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
    text: { color: colors.danger },
  }),
};
