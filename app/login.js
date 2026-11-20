import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../src/components/button';
import { friendlyError, supabase } from '../src/lib/supabase';
import { colors, ui } from '../src/theme';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !password) return Alert.alert('Faltan datos', 'Completá email y contraseña.');
    if (signup && !name.trim()) return Alert.alert('Falta tu nombre', 'Así te ven los de tu grupo.');
    if (signup && password.length < 8) return Alert.alert('Contraseña corta', 'Usá al menos 8 caracteres.');
    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: e,
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert('Revisá tu email', 'Te mandamos un link para confirmar la cuenta. Después volvé y entrá.');
          setMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) throw error;
      }
    } catch (err) {
      Alert.alert('No se pudo', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>🍲</Text>
          <Text style={styles.title}>¿Qué comemos?</Text>
          <Text style={styles.subtitle}>Recetas, plan semanal y lista de compras compartida.</Text>

          {signup && (
            <>
              <Text style={ui.label}>Tu nombre</Text>
              <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="Ej: Tomás" placeholderTextColor={colors.muted} autoComplete="name" />
            </>
          )}
          <Text style={ui.label}>Email</Text>
          <TextInput
            style={ui.input}
            value={email}
            onChangeText={setEmail}
            placeholder="vos@mail.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Text style={ui.label}>Contraseña</Text>
          <TextInput
            style={ui.input}
            value={password}
            onChangeText={setPassword}
            placeholder={signup ? 'Mínimo 8 caracteres' : '••••••••'}
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoComplete={signup ? 'new-password' : 'current-password'}
            onSubmitEditing={submit}
          />

          <Button title={signup ? 'Crear cuenta' : 'Entrar'} onPress={submit} loading={busy} style={{ marginTop: 24 }} />

          <Pressable onPress={() => setMode(signup ? 'login' : 'signup')} style={{ marginTop: 20 }} hitSlop={10}>
            <Text style={styles.switch}>
              {signup ? '¿Ya tenés cuenta? ' : '¿No tenés cuenta? '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{signup ? 'Entrá' : 'Creá una'}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 8 },
  subtitle: { color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 12 },
  switch: { textAlign: 'center', color: colors.muted, fontSize: 15 },
});
