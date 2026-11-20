# Qué Comemos

App Android (Expo SDK 58 + expo-router, JavaScript) para recetas, plan semanal compartido y lista de compras.
Backend: Supabase en la nube (proyecto `otqqodhytfeanexksqiz`, us-west-2). La UI y los mensajes van en español rioplatense.

## Estructura
- `app/` rutas (expo-router). Tabs: Recetas (`index`), Plan, Compras, Grupo. Modales: `recipe/edit`, `plan/add`.
- `src/lib/api.js` todas las consultas a Supabase. `src/lib/auth.js` sesión, perfil, grupos y grupo activo.
- `src/lib/use-data.js` carga con recarga al enfocar + suscripción realtime (solo recarga; no usa el payload).
- `supabase/migrations/` esquema versionado. Nunca editar una migración aplicada: crear una nueva.

## Comandos
- Aplicar migraciones pendientes: `scripts/db-apply.sh` (`--status` para ver, `--sql "..."` para SQL suelto).
  Usa la Management API con el token de `~/.config/quecomemos/env` (no hace falta la contraseña de la base).
- Pruebas de permisos (RLS, con rollback): `scripts/db-apply.sh --sql "$(cat supabase/tests/rls_test.sql)"`
- Prueba de punta a punta contra Supabase real: `node scripts/e2e-test.mjs` (crea y borra usuarios de prueba).
- Chequeo de compilación: `npx expo-doctor` y `npx expo export --platform android --output-dir <tmp>`.
- Servidor de desarrollo para el celular (por Tailscale): `REACT_NATIVE_PACKAGER_HOSTNAME=100.110.220.23 npx expo start --port 8083 --host lan`
  → en Expo Go: `exp://100.110.220.23:8083`. Los puertos 8081/8082 los usa traefik.

## Reglas
- Dependencias nuevas con `npx expo install`, nunca `npm i` suelto. Verificar que `npm ci` resuelva.
- Toda tabla nueva: `enable row level security`, políticas con `(select auth.uid())`, y `grant` explícito a `authenticated`
  (el proyecto no da acceso automático). Funciones nuevas: `revoke execute ... from public, anon` y grant explícito.
- Fechas del plan en hora local (`src/lib/dates.js`), nunca `toISOString()`.
- `.env` solo tiene la URL y la clave publicable (son públicas). Los secretos viven en `~/.config/quecomemos/env`.
