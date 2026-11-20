// Prueba de punta a punta contra Supabase real, con las mismas consultas que usa la app.
// Crea 2 usuarios de prueba (vía SQL, ya confirmados), corre el escenario y los borra.
// Uso: node scripts/e2e-test.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_KEY;
const sql = (q) => JSON.parse(execFileSync(new URL('./db-apply.sh', import.meta.url).pathname, ['--sql', q], { encoding: 'utf8' }));

const PASS = 'e2e-' + Math.random().toString(36).slice(2) + 'Aa1!';
const users = [
  { id: '00000000-0000-4000-b000-0000000000e1', email: 'e2e-ana@test.invalid', name: 'Ana E2E' },
  { id: '00000000-0000-4000-b000-0000000000e2', email: 'e2e-beto@test.invalid', name: 'Beto E2E' },
];

function cleanup() {
  sql(`delete from auth.users where id in (${users.map((u) => `'${u.id}'`).join(',')})`);
}

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) failures++;
};
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

cleanup();
for (const u of users) {
  sql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('${u.id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${u.email}',
      extensions.crypt('${PASS}', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"display_name":"${u.name}"}', now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values ('${u.id}', '${u.id}', '{"sub":"${u.id}","email":"${u.email}","email_verified":true}', 'email', now(), now(), now());
  `);
}

try {
  const mk = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const ana = mk();
  const beto = mk();
  must(await ana.auth.signInWithPassword({ email: users[0].email, password: PASS }), 'login Ana');
  must(await beto.auth.signInWithPassword({ email: users[1].email, password: PASS }), 'login Beto');
  ok(true, 'Login con email y contraseña');

  // Consultas de la app (mismos selects que src/lib/api.js)
  const groupsA = must(
    await ana.from('groups').select('id, name, invite_code, created_at, group_members(user_id, role, profiles(display_name))').order('created_at'),
    'listMyGroups',
  );
  ok(groupsA.length === 1 && groupsA[0].name === 'Mi casa', 'Alta crea el grupo "Mi casa"');
  const gid = groupsA[0].id;

  const cols = must(await ana.from('collections').select('id, name, position, collection_recipes(recipe_id)').order('position').order('created_at'), 'listCollections');
  ok(cols.map((c) => c.name).join(',') === 'Favoritas,Desayuno,Almuerzo,Merienda,Cena', 'Colecciones por defecto');

  const recipes = must(
    await ana.from('recipes').select('id, name, minutes, servings, visibility, owner_id, created_at, owner:profiles(display_name), recipe_ingredients(name)').order('created_at', { ascending: false }).limit(500),
    'listRecipes',
  );
  ok(recipes.length >= 6, `Ve las recetas públicas de ejemplo (${recipes.length})`);
  const mila = recipes.find((r) => r.name === 'Milanesas de carne');
  const pure = recipes.find((r) => r.name === 'Puré de papas');

  // Ana crea una receta privada y la guarda en una colección
  const priv = must(await ana.from('recipes').insert({ name: 'Tarta secreta E2E', visibility: 'private', steps: ['Mezclar'] }).select('id').single(), 'crear receta');
  must(await ana.from('recipe_ingredients').insert([{ recipe_id: priv.id, position: 0, name: 'Papas', quantity: '500 g' }]), 'ingredientes');
  must(await ana.from('collection_recipes').upsert({ collection_id: cols[0].id, recipe_id: priv.id }, { ignoreDuplicates: true }), 'favorita');
  const detail = must(
    await ana.from('recipes').select('*, owner:profiles(display_name), recipe_ingredients(id, position, name, quantity)').eq('id', priv.id).order('position', { referencedTable: 'recipe_ingredients' }).maybeSingle(),
    'getRecipe',
  );
  ok(detail?.owner?.display_name === 'Ana E2E' && detail.recipe_ingredients.length === 1, 'Detalle de receta con autor e ingredientes');

  ok((await beto.from('recipes').select('id').eq('id', priv.id)).data.length === 0, 'Beto NO ve la receta privada antes de unirse');

  // Beto se une con el código
  const joined = must(await beto.rpc('join_group', { code: groupsA[0].invite_code.toLowerCase() }), 'join_group');
  ok(joined.id === gid, 'Beto se une con el código de invitación');
  ok((await beto.from('recipes').select('id').eq('id', priv.id)).data.length === 1, 'Beto ahora ve la receta privada de Ana');

  // Beto escucha la lista de compras en tiempo real
  let realtimeEvents = 0;
  const channel = beto
    .channel('e2e-shopping')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `group_id=eq.${gid}` }, () => realtimeEvents++);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('realtime subscribe timeout')), 15000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t);
        resolve();
      }
    });
  });

  // Ana planifica milanesas con puré el miércoles al mediodía
  const d = new Date();
  d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7));
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  must(await ana.from('meal_plan').insert({ group_id: gid, day, slot: 'almuerzo', recipe_id: mila.id }), 'plan milanesas');
  must(await ana.from('meal_plan').insert({ group_id: gid, day, slot: 'almuerzo', recipe_id: pure.id }), 'plan puré');
  must(await ana.from('meal_plan').insert({ group_id: gid, day, slot: 'cena', recipe_id: priv.id }), 'plan tarta');

  const plan = must(
    await beto.from('meal_plan').select('id, day, slot, recipe_id, recipes(name), added_by, adder:profiles(display_name)').eq('group_id', gid).gte('day', day).lte('day', day).order('created_at'),
    'listPlan',
  );
  ok(plan.length === 3 && plan[0].adder?.display_name === 'Ana E2E', 'Beto ve el plan que armó Ana');

  const shopSelect =
    'id, name, quantity, checked, checked_at, meal_plan_id, created_at, checker:profiles!shopping_items_checked_by_fkey(display_name), meal_plan(day, slot, recipes(name))';
  let items = must(await beto.from('shopping_items').select(shopSelect).eq('group_id', gid).order('created_at'), 'listShopping');
  ok(items.some((i) => i.name === 'Nuez moscada'), 'La lista incluye la nuez moscada del puré');
  ok(items.filter((i) => i.name.toLowerCase() === 'papas').length === 2, 'Papas aparece en puré y tarta (la app las agrupa en una fila)');

  // Beto tilda la nuez moscada; Ana lo ve con su nombre
  must(await beto.rpc('set_item_checked', { gid, item_name: 'nuez moscada', value: true }), 'set_item_checked');
  items = must(await ana.from('shopping_items').select(shopSelect).eq('group_id', gid), 'listShopping Ana');
  const nuez = items.find((i) => i.name === 'Nuez moscada');
  ok(nuez.checked && nuez.checker?.display_name === 'Beto E2E', 'Ana ve "Nuez moscada ✓ Beto E2E"');

  // Ítem manual
  must(await ana.from('shopping_items').insert({ group_id: gid, name: 'Servilletas' }), 'ítem manual');

  await new Promise((r) => setTimeout(r, 3000));
  ok(realtimeEvents > 0, `Beto recibió ${realtimeEvents} eventos en tiempo real`);
  await beto.removeChannel(channel);

  // Quitar del plan borra sus ítems de compra
  must(await ana.from('meal_plan').delete().eq('recipe_id', pure.id).eq('group_id', gid), 'quitar puré');
  items = must(await ana.from('shopping_items').select('name').eq('group_id', gid), 'lista tras quitar');
  ok(!items.some((i) => i.name === 'Nuez moscada'), 'Quitar el puré del plan saca la nuez moscada de la lista');

  // Beto no puede editar ni borrar la receta de Ana
  const upd = await beto.from('recipes').update({ name: 'X' }).eq('id', priv.id).select();
  ok((upd.data ?? []).length === 0, 'Beto NO puede editar la receta de Ana');

  // Grupos extra y salir
  const g2 = must(await beto.rpc('create_group', { group_name: 'Grupo E2E' }), 'create_group');
  must(await beto.rpc('leave_group', { gid: g2.id }), 'leave_group');
  ok((await beto.from('groups').select('id').eq('id', g2.id)).data.length === 0, 'Crear y salir de un grupo (vacío se borra)');

  // Borrado de cuenta
  must(await ana.rpc('delete_account'), 'delete_account');
  const left = sql(`select count(*)::int as n from auth.users where id = '${users[0].id}'`)[0].n;
  ok(left === 0, 'Ana borra su cuenta desde la app');
  const owner = sql(`select role from public.group_members where group_id = '${gid}' and user_id = '${users[1].id}'`)[0]?.role;
  ok(owner === 'owner', 'Beto queda como dueño del grupo');
} catch (e) {
  console.error('✘ Error:', e.message);
  failures++;
} finally {
  cleanup();
  const rest = sql(`select count(*)::int as n from auth.users where email like 'e2e-%@test.invalid'`)[0].n;
  console.log(rest === 0 ? 'Usuarios de prueba borrados.' : `¡Quedaron ${rest} usuarios de prueba!`);
}

console.log(failures ? `\n${failures} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(failures ? 1 : 0);
