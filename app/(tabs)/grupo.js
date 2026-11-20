import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from '../../src/components/button';
import { createGroup, deleteAccount, joinGroup, leaveGroup, updateDisplayName } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { friendlyError, supabase } from '../../src/lib/supabase';
import { colors, ui } from '../../src/theme';

export default function Group() {
  const { userId, session, profile, groups, activeGroup, setActiveGroupId, refresh } = useAuth();
  const [code, setCode] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [name, setName] = useState(null); // null = no editando
  const [busy, setBusy] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      Alert.alert('No se pudo', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const join = () =>
    run('join', async () => {
      if (!code.trim()) return;
      const g = await joinGroup(code);
      setCode('');
      await refresh();
      setActiveGroupId(g.id);
      Alert.alert('¡Listo!', `Te uniste a "${g.name}".`);
    });

  const create = () =>
    run('create', async () => {
      if (!newGroup.trim()) return;
      const g = await createGroup(newGroup);
      setNewGroup('');
      await refresh();
      setActiveGroupId(g.id);
    });

  const share = (g) =>
    Share.share({
      message: `Sumate a "${g.name}" en Qué Comemos para planear las comidas y la lista de compras juntos. Código de invitación: ${g.invite_code}`,
    });

  const leave = (g) =>
    Alert.alert('Salir del grupo', `¿Salir de "${g.name}"? Dejás de ver su plan y su lista de compras.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () =>
          run('leave', async () => {
            await leaveGroup(g.id);
            await refresh();
          }),
      },
    ]);

  const saveName = () =>
    run('name', async () => {
      if (!name?.trim()) return;
      await updateDisplayName(userId, name.trim());
      setName(null);
      await refresh();
    });

  const removeAccount = () =>
    Alert.alert(
      'Borrar cuenta',
      'Se borran tu cuenta, tus recetas y tus colecciones. Esto no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: () =>
            run('delete', async () => {
              await deleteAccount();
              await supabase.auth.signOut({ scope: 'local' });
            }),
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Grupo activo */}
      {activeGroup && (
        <View style={[ui.card, { marginBottom: 16 }]}>
          <Text style={styles.groupName}>{activeGroup.name}</Text>
          <Text style={ui.muted}>Grupo activo: su plan y su lista de compras son los que ves.</Text>

          <Text style={[ui.label, { marginTop: 14 }]}>Integrantes</Text>
          {activeGroup.group_members.map((m) => (
            <Text key={m.user_id} style={styles.member}>
              {m.role === 'owner' ? '👑 ' : '• '}
              {m.profiles?.display_name ?? '—'}
              {m.user_id === userId ? ' (vos)' : ''}
            </Text>
          ))}

          <Text style={[ui.label, { marginTop: 14 }]}>Código para invitar</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code} selectable>
              {activeGroup.invite_code}
            </Text>
            <Button title="Compartir" variant="secondary" onPress={() => share(activeGroup)} />
          </View>
        </View>
      )}

      {/* Mis grupos */}
      {groups.length > 1 && (
        <>
          <Text style={styles.section}>Mis grupos</Text>
          {groups.map((g) => (
            <Pressable key={g.id} style={[ui.card, styles.groupRow]} onPress={() => setActiveGroupId(g.id)}>
              <Ionicons
                name={g.id === activeGroup?.id ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={g.id === activeGroup?.id ? colors.primary : colors.muted}
              />
              <Text style={styles.groupRowName}>{g.name}</Text>
              <Text style={ui.muted}>{g.group_members.length} 👤</Text>
            </Pressable>
          ))}
        </>
      )}

      <Text style={styles.section}>Unirme a un grupo</Text>
      <View style={styles.inline}>
        <TextInput
          style={[ui.input, { flex: 1, letterSpacing: 2 }]}
          value={code}
          onChangeText={setCode}
          placeholder="Código (ej: K7P2QX)"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          maxLength={6}
        />
        <Button title="Unirme" onPress={join} loading={busy === 'join'} />
      </View>

      <Text style={styles.section}>Crear otro grupo</Text>
      <View style={styles.inline}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={newGroup}
          onChangeText={setNewGroup}
          placeholder="Ej: Casa de mis viejos"
          placeholderTextColor={colors.muted}
          maxLength={60}
        />
        <Button title="Crear" variant="secondary" onPress={create} loading={busy === 'create'} />
      </View>

      {activeGroup && groups.length > 1 && (
        <Button title={`Salir de "${activeGroup.name}"`} variant="danger" onPress={() => leave(activeGroup)} style={{ marginTop: 16 }} />
      )}

      {/* Cuenta */}
      <Text style={styles.section}>Mi cuenta</Text>
      <View style={ui.card}>
        {name === null ? (
          <Pressable style={styles.inline} onPress={() => setName(profile?.display_name ?? '')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupName}>{profile?.display_name ?? '—'}</Text>
              <Text style={ui.muted}>{session?.user?.email}</Text>
            </View>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.inline}>
            <TextInput style={[ui.input, { flex: 1 }]} value={name} onChangeText={setName} autoFocus maxLength={60} />
            <Button title="Guardar" onPress={saveName} loading={busy === 'name'} />
          </View>
        )}
      </View>

      <Button title="Cerrar sesión" variant="secondary" onPress={() => supabase.auth.signOut()} style={{ marginTop: 16 }} />
      <Pressable onPress={removeAccount} style={{ marginTop: 24, alignItems: 'center' }} hitSlop={10}>
        <Text style={{ color: colors.danger }}>{busy === 'delete' ? 'Borrando…' : 'Borrar mi cuenta'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  groupName: { fontSize: 18, fontWeight: '700', color: colors.text },
  member: { fontSize: 15, color: colors.text, paddingVertical: 2 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 26, fontWeight: '800', letterSpacing: 4, color: colors.primary },
  section: { ...ui.sectionTitle, marginTop: 24, marginBottom: 10 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  groupRowName: { flex: 1, fontSize: 16, color: colors.text },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
