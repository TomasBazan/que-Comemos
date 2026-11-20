-- Prueba de permisos (RLS) con 3 usuarios simulados. Todo se deshace con ROLLBACK.
-- Ejecutar: scripts/db-apply.sh --sql "$(cat supabase/tests/rls_test.sql)"
-- Si algo falla, el error dice qué aserción no se cumplió.
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-a000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.invalid',   '{"display_name":"Ana"}',   now(), now()),
  ('00000000-0000-4000-a000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@test.invalid',  '{"display_name":"Beto"}',  now(), now()),
  ('00000000-0000-4000-a000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'caro@test.invalid',  '{"display_name":"Caro"}',  now(), now());

create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- 1) Ana: alta automática (perfil, 5 colecciones, grupo propio) y receta privada.
select pg_temp.as_user('00000000-0000-4000-a000-00000000000a');
do $$
declare gid uuid; code text; rid uuid; n int;
begin
  select count(*) into n from public.collections;
  assert n = 5, 'Ana debería tener 5 colecciones, tiene ' || n;
  select id, invite_code into gid, code from public.groups;
  assert gid is not null, 'Ana no ve su grupo';
  insert into public.recipes (name, visibility) values ('Secreto de Ana', 'private') returning id into rid;
  insert into public.recipe_ingredients (recipe_id, position, name, quantity) values
    (rid, 0, 'Nuez moscada', null), (rid, 1, 'Papas', '1 kg');
  perform set_config('t.gid', gid::text, true);
  perform set_config('t.code', code, true);
  perform set_config('t.rid', rid::text, true);
end $$;
reset role;

-- 2) Caro (otro grupo): no ve la receta privada ni el grupo de Ana, sí las públicas.
select pg_temp.as_user('00000000-0000-4000-a000-00000000000c');
do $$
declare n int;
begin
  select count(*) into n from public.recipes where id = current_setting('t.rid')::uuid;
  assert n = 0, 'Caro NO debería ver la receta privada de Ana';
  select count(*) into n from public.recipe_ingredients where recipe_id = current_setting('t.rid')::uuid;
  assert n = 0, 'Caro NO debería ver los ingredientes privados de Ana';
  select count(*) into n from public.recipes where visibility = 'public';
  assert n >= 6, 'Caro debería ver las recetas públicas';
  select count(*) into n from public.groups where id = current_setting('t.gid')::uuid;
  assert n = 0, 'Caro NO debería ver el grupo de Ana';
end $$;
reset role;

-- 3) Beto se une con el código y ve la receta privada de Ana.
select pg_temp.as_user('00000000-0000-4000-a000-00000000000b');
do $$
declare n int;
begin
  perform public.join_group(lower(current_setting('t.code')));
  select count(*) into n from public.recipes where id = current_setting('t.rid')::uuid;
  assert n = 1, 'Beto (mismo grupo) debería ver la receta privada de Ana';
  select count(*) into n from public.group_members where group_id = current_setting('t.gid')::uuid;
  assert n = 2, 'Beto debería ver 2 miembros, ve ' || n;
  update public.recipes set name = 'hackeada' where id = current_setting('t.rid')::uuid;
  get diagnostics n = row_count;
  assert n = 0, 'Beto NO debería poder editar la receta de Ana';
end $$;
reset role;

-- 4) Ana planifica el almuerzo: se genera la lista de compras.
select pg_temp.as_user('00000000-0000-4000-a000-00000000000a');
do $$
declare n int;
begin
  insert into public.meal_plan (group_id, day, slot, recipe_id)
    values (current_setting('t.gid')::uuid, current_date + 2, 'almuerzo', current_setting('t.rid')::uuid);
  select count(*) into n from public.shopping_items where group_id = current_setting('t.gid')::uuid;
  assert n = 2, 'Deberían generarse 2 ítems de compra, hay ' || n;
end $$;
reset role;

-- 5) Beto tilda la nuez moscada.
select pg_temp.as_user('00000000-0000-4000-a000-00000000000b');
do $$
declare n int;
begin
  select count(*) into n from public.shopping_items where group_id = current_setting('t.gid')::uuid;
  assert n = 2, 'Beto debería ver los 2 ítems';
  perform public.set_item_checked(current_setting('t.gid')::uuid, ' NUEZ moscada', true);
end $$;
reset role;

-- 6) Ana ve que Beto la tildó.
select pg_temp.as_user('00000000-0000-4000-a000-00000000000a');
do $$
declare who uuid; ok boolean;
begin
  select checked, checked_by into ok, who from public.shopping_items
    where group_id = current_setting('t.gid')::uuid and name = 'Nuez moscada';
  assert ok, 'Ana debería ver la nuez moscada tildada';
  assert who = '00000000-0000-4000-a000-00000000000b', 'Debería figurar Beto como quien la tildó';
end $$;
reset role;

-- 7) Caro no puede tocar nada del grupo de Ana.
select pg_temp.as_user('00000000-0000-4000-a000-00000000000c');
do $$
declare n int; failed boolean := false;
begin
  select count(*) into n from public.shopping_items where group_id = current_setting('t.gid')::uuid;
  assert n = 0, 'Caro NO debería ver la lista de Ana';
  update public.shopping_items set checked = false where group_id = current_setting('t.gid')::uuid;
  get diagnostics n = row_count;
  assert n = 0, 'Caro NO debería poder destildar';
  begin
    insert into public.meal_plan (group_id, day, slot, recipe_id)
      values (current_setting('t.gid')::uuid, current_date, 'cena', current_setting('t.rid')::uuid);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'Caro NO debería poder planificar en el grupo de Ana';
  begin
    insert into public.group_members (group_id, user_id) values (current_setting('t.gid')::uuid, '00000000-0000-4000-a000-00000000000c');
    failed := false;
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'Caro NO debería poder meterse al grupo sin código';
end $$;
reset role;

-- 8) Ana borra su cuenta: desaparece todo lo suyo y Beto queda como dueño.
select pg_temp.as_user('00000000-0000-4000-a000-00000000000a');
select public.delete_account();
reset role;
do $$
declare n int; r text;
begin
  select count(*) into n from auth.users where id = '00000000-0000-4000-a000-00000000000a';
  assert n = 0, 'La cuenta de Ana debería estar borrada';
  select count(*) into n from public.recipes where id = current_setting('t.rid')::uuid;
  assert n = 0, 'Las recetas de Ana deberían borrarse';
  select role into r from public.group_members
    where group_id = current_setting('t.gid')::uuid and user_id = '00000000-0000-4000-a000-00000000000b';
  assert r = 'owner', 'Beto debería quedar como dueño del grupo';
end $$;

select 'OK: todas las pruebas de permisos pasaron' as resultado;
rollback;
