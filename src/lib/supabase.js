import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresca el token solo con la app en primer plano.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// Convierte errores de Supabase en mensajes entendibles.
export function friendlyError(error) {
  const msg = error?.message ?? String(error);
  if (/Invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/User already registered/i.test(msg)) return 'Ya existe una cuenta con ese email.';
  if (/Password should be at least/i.test(msg)) return 'La contraseña es muy corta (mínimo 8 caracteres).';
  if (/Email not confirmed/i.test(msg)) return 'Todavía no confirmaste tu email. Revisá tu casilla.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Probá de nuevo en un rato.';
  if (/Código de invitación inválido/i.test(msg)) return 'Ese código de invitación no existe.';
  if (/Network request failed|fetch/i.test(msg)) return 'Sin conexión. Revisá tu internet.';
  return msg;
}
