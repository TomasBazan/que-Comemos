export const colors = {
  bg: '#FBF7F2',
  card: '#FFFFFF',
  text: '#2B2420',
  muted: '#8A7F76',
  border: '#EADFD3',
  primary: '#D9572B',
  primarySoft: '#FBE4D9',
  danger: '#C0392B',
  fav: '#E0A100',
  ok: '#2E8B57',
};

export const ui = {
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  label: { fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted },
};
