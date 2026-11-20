-- Que Comemos: esquema inicial
-- Usuarios (profiles), grupos, recetas públicas/privadas, colecciones,
-- plan semanal por grupo y lista de compras compartida.

-- ============================================================
-- Tablas
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- owner_id nulo = receta de ejemplo de la app (siempre pública).
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  minutes int check (minutes is null or minutes between 1 and 10000),
  servings int check (servings is null or servings between 1 and 500),
  steps text[] not null default '{}',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id is not null or visibility = 'public')
);
create index recipes_owner_idx on public.recipes (owner_id);
create index recipes_public_idx on public.recipes (created_at desc) where visibility = 'public';

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null default 0,
  name text not null check (char_length(name) between 1 and 120),
  quantity text check (quantity is null or char_length(quantity) <= 60)
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  position int not null default 100,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.collection_recipes (
  collection_id uuid not null references public.collections (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);
create index collection_recipes_recipe_idx on public.collection_recipes (recipe_id);

create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  day date not null,
  slot text not null check (slot in ('desayuno', 'almuerzo', 'merienda', 'cena')),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  added_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index meal_plan_group_day_idx on public.meal_plan (group_id, day);

-- meal_plan_id nulo = ítem agregado a mano.
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  meal_plan_id uuid references public.meal_plan (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  quantity text,
  checked boolean not null default false,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index shopping_items_group_idx on public.shopping_items (group_id);
create index shopping_items_plan_idx on public.shopping_items (meal_plan_id);

-- ============================================================
-- Funciones auxiliares (security definer para evitar recursión en RLS)
-- ============================================================

create function public.is_group_member(gid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
  );
$$;

create function public.is_group_owner(gid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

create function public.shares_group_with(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

create function public.can_view_recipe(rid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = rid
      and (
        r.visibility = 'public'
        or r.owner_id = (select auth.uid())
        or public.shares_group_with(r.owner_id)
      )
  );
$$;

create function public.owns_recipe(rid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = rid and r.owner_id = (select auth.uid())
  );
$$;

create function public.new_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ============================================================
-- Triggers
-- ============================================================

-- Alta de usuario: perfil + colecciones por defecto + grupo personal.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  dname text;
  gid uuid;
begin
  dname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'usuario'), '@', 1)
  );
  dname := left(dname, 60);

  insert into public.profiles (id, display_name) values (new.id, dname);

  insert into public.collections (owner_id, name, position) values
    (new.id, 'Favoritas', 0),
    (new.id, 'Desayuno', 1),
    (new.id, 'Almuerzo', 2),
    (new.id, 'Merienda', 3),
    (new.id, 'Cena', 4);

  insert into public.groups (name, invite_code, created_by)
    values ('Mi casa', public.new_invite_code(), new.id)
    returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Al planificar una comida, se copian sus ingredientes a la lista de compras.
create function public.handle_meal_planned()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.shopping_items (group_id, meal_plan_id, name, quantity)
  select new.group_id, new.id, i.name, i.quantity
  from public.recipe_ingredients i
  where i.recipe_id = new.recipe_id
  order by i.position;
  return new;
end;
$$;

create trigger on_meal_planned
  after insert on public.meal_plan
  for each row execute function public.handle_meal_planned();

create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- Quién tildó un ítem lo define el servidor, no el cliente.
create function public.stamp_shopping_check()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.checked is distinct from old.checked then
    if new.checked then
      new.checked_by := (select auth.uid());
      new.checked_at := now();
    else
      new.checked_by := null;
      new.checked_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger shopping_items_stamp before update on public.shopping_items
  for each row execute function public.stamp_shopping_check();

-- ============================================================
-- RPCs
-- ============================================================

create function public.create_group(group_name text)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  insert into public.groups (name, invite_code, created_by)
    values (trim(group_name), public.new_invite_code(), (select auth.uid()))
    returning * into g;
  insert into public.group_members (group_id, user_id, role)
    values (g.id, (select auth.uid()), 'owner');
  return g;
end;
$$;

create function public.join_group(code text)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  select * into g from public.groups where invite_code = upper(trim(code));
  if not found then
    raise exception 'Código de invitación inválido' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id, role)
    values (g.id, (select auth.uid()), 'member')
    on conflict do nothing;
  return g;
end;
$$;

-- Sale del grupo; si queda vacío se borra, si se va el dueño se pasa la posta.
create function public.leave_group(gid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  next_owner uuid;
begin
  delete from public.group_members where group_id = gid and user_id = (select auth.uid());
  if not exists (select 1 from public.group_members where group_id = gid) then
    delete from public.groups where id = gid;
  elsif not exists (select 1 from public.group_members where group_id = gid and role = 'owner') then
    select user_id into next_owner from public.group_members
      where group_id = gid order by joined_at limit 1;
    update public.group_members set role = 'owner' where group_id = gid and user_id = next_owner;
  end if;
end;
$$;

-- Marca/desmarca de una vez todos los ítems con el mismo nombre en el grupo.
create function public.set_item_checked(gid uuid, item_name text, value boolean)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.shopping_items
    set checked = value
    where group_id = gid and lower(trim(name)) = lower(trim(item_name));
end;
$$;

-- Borrado de cuenta (requisito de Google Play).
create function public.delete_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  gid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  for gid in select group_id from public.group_members where user_id = uid loop
    perform public.leave_group(gid);
  end loop;
  delete from auth.users where id = uid;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.collections enable row level security;
alter table public.collection_recipes enable row level security;
alter table public.meal_plan enable row level security;
alter table public.shopping_items enable row level security;

-- profiles: los nombres son visibles para usuarios logueados (autor de recetas públicas).
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- groups: solo miembros. Alta/unión vía RPC.
create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_owner(id)) with check (public.is_group_owner(id));

-- group_members: ver a los compañeros; el dueño puede sacar gente.
create policy group_members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
create policy group_members_delete on public.group_members for delete to authenticated
  using (public.is_group_owner(group_id) and user_id <> (select auth.uid()));

-- recipes
create policy recipes_select on public.recipes for select to authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()) or public.shares_group_with(owner_id));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy recipes_update on public.recipes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy recipes_delete on public.recipes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- recipe_ingredients
create policy ingredients_select on public.recipe_ingredients for select to authenticated
  using (public.can_view_recipe(recipe_id));
create policy ingredients_insert on public.recipe_ingredients for insert to authenticated
  with check (public.owns_recipe(recipe_id));
create policy ingredients_update on public.recipe_ingredients for update to authenticated
  using (public.owns_recipe(recipe_id)) with check (public.owns_recipe(recipe_id));
create policy ingredients_delete on public.recipe_ingredients for delete to authenticated
  using (public.owns_recipe(recipe_id));

-- collections: privadas de cada usuario.
create policy collections_all on public.collections for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy collection_recipes_select on public.collection_recipes for select to authenticated
  using (exists (select 1 from public.collections c
                 where c.id = collection_id and c.owner_id = (select auth.uid())));
create policy collection_recipes_insert on public.collection_recipes for insert to authenticated
  with check (exists (select 1 from public.collections c
                      where c.id = collection_id and c.owner_id = (select auth.uid()))
              and public.can_view_recipe(recipe_id));
create policy collection_recipes_delete on public.collection_recipes for delete to authenticated
  using (exists (select 1 from public.collections c
                 where c.id = collection_id and c.owner_id = (select auth.uid())));

-- meal_plan: del grupo.
create policy meal_plan_select on public.meal_plan for select to authenticated
  using (public.is_group_member(group_id));
create policy meal_plan_insert on public.meal_plan for insert to authenticated
  with check (public.is_group_member(group_id) and public.can_view_recipe(recipe_id));
create policy meal_plan_delete on public.meal_plan for delete to authenticated
  using (public.is_group_member(group_id));

-- shopping_items: del grupo.
create policy shopping_select on public.shopping_items for select to authenticated
  using (public.is_group_member(group_id));
create policy shopping_insert on public.shopping_items for insert to authenticated
  with check (public.is_group_member(group_id));
create policy shopping_update on public.shopping_items for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy shopping_delete on public.shopping_items for delete to authenticated
  using (public.is_group_member(group_id));

-- ============================================================
-- Grants (el proyecto no da acceso automático a tablas nuevas)
-- ============================================================

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.groups to authenticated;
grant update (name) on public.groups to authenticated;
grant select, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, delete on public.collection_recipes to authenticated;
grant select, insert, delete on public.meal_plan to authenticated;
grant select, insert, delete on public.shopping_items to authenticated;
grant update (checked) on public.shopping_items to authenticated;

-- Las funciones nuevas tienen EXECUTE para PUBLIC por defecto: lo cerramos.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.set_item_checked(uuid, text, boolean) to authenticated;
grant execute on function public.delete_account() to authenticated;
-- Usadas dentro de políticas RLS evaluadas como "authenticated".
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.can_view_recipe(uuid) to authenticated;
grant execute on function public.owns_recipe(uuid) to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ============================================================
-- Realtime: plan y lista de compras se sincronizan entre miembros.
-- ============================================================

alter publication supabase_realtime add table public.meal_plan;
alter publication supabase_realtime add table public.shopping_items;

-- ============================================================
-- Recetas de ejemplo (públicas, sin dueño)
-- ============================================================

with r as (
  insert into public.recipes (owner_id, name, minutes, servings, visibility, steps) values
    (null, 'Milanesas de carne', 40, 4, 'public', array[
      'Batir los huevos con el ajo, el perejil, sal y pimienta.',
      'Pasar cada bife por el huevo y después por el pan rallado, presionando bien.',
      'Freír en aceite caliente o hornear a 200 °C unos 10 minutos por lado.']),
    (null, 'Puré de papas', 30, 4, 'public', array[
      'Hervir las papas peladas en agua con sal hasta que estén tiernas.',
      'Pisarlas con la manteca y la leche caliente.',
      'Condimentar con sal, pimienta y nuez moscada.']),
    (null, 'Empanadas de carne cortada a cuchillo', 90, 6, 'public', array[
      'Rehogar la cebolla y el morrón picados.',
      'Agregar la carne y condimentar con comino y pimentón. Dejar enfriar.',
      'Rellenar las tapas con la carne, huevo duro y aceituna. Repulgar.',
      'Hornear a 220 °C durante 15–20 minutos.']),
    (null, 'Flan casero', 70, 6, 'public', array[
      'Hacer un caramelo en la flanera y dejar enfriar.',
      'Batir los huevos con el azúcar, agregar la leche tibia y la vainilla.',
      'Volcar en la flanera y cocinar a baño María a 170 °C por 50 minutos.',
      'Enfriar en la heladera antes de desmoldar.']),
    (null, 'Tostadas con palta y huevo', 10, 1, 'public', array[
      'Tostar el pan.',
      'Pisar la palta con limón y sal.',
      'Cocinar el huevo a gusto y servir arriba.']),
    (null, 'Chocotorta', 20, 8, 'public', array[
      'Mezclar el dulce de leche con el queso crema.',
      'Mojar las galletitas en la chocolatada y armar capas alternando con la crema.',
      'Terminar con crema y llevar a la heladera mínimo 4 horas.'])
  returning id, name
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity)
select r.id, i.position, i.name, i.quantity
from r
join (values
  ('Milanesas de carne', 0, 'Nalga en bifes finos', '1 kg'),
  ('Milanesas de carne', 1, 'Huevos', '3'),
  ('Milanesas de carne', 2, 'Ajo', '2 dientes'),
  ('Milanesas de carne', 3, 'Perejil', null),
  ('Milanesas de carne', 4, 'Pan rallado', null),
  ('Puré de papas', 0, 'Papas', '1 kg'),
  ('Puré de papas', 1, 'Manteca', '50 g'),
  ('Puré de papas', 2, 'Leche', '1 taza'),
  ('Puré de papas', 3, 'Nuez moscada', null),
  ('Empanadas de carne cortada a cuchillo', 0, 'Tapas de empanada', '12'),
  ('Empanadas de carne cortada a cuchillo', 1, 'Carne cortada a cuchillo', '500 g'),
  ('Empanadas de carne cortada a cuchillo', 2, 'Cebolla', '2'),
  ('Empanadas de carne cortada a cuchillo', 3, 'Morrón rojo', '1'),
  ('Empanadas de carne cortada a cuchillo', 4, 'Huevos', '2'),
  ('Empanadas de carne cortada a cuchillo', 5, 'Aceitunas verdes', null),
  ('Empanadas de carne cortada a cuchillo', 6, 'Comino', null),
  ('Empanadas de carne cortada a cuchillo', 7, 'Pimentón', null),
  ('Flan casero', 0, 'Huevos', '5'),
  ('Flan casero', 1, 'Leche', '1 litro'),
  ('Flan casero', 2, 'Azúcar', '300 g'),
  ('Flan casero', 3, 'Esencia de vainilla', null),
  ('Tostadas con palta y huevo', 0, 'Pan', '2 rebanadas'),
  ('Tostadas con palta y huevo', 1, 'Palta', '1/2'),
  ('Tostadas con palta y huevo', 2, 'Huevos', '1'),
  ('Tostadas con palta y huevo', 3, 'Limón', null),
  ('Chocotorta', 0, 'Galletitas de chocolate', '2 paquetes'),
  ('Chocotorta', 1, 'Dulce de leche', '500 g'),
  ('Chocotorta', 2, 'Queso crema', '300 g'),
  ('Chocotorta', 3, 'Leche chocolatada', null)
) as i(recipe_name, position, name, quantity) on i.recipe_name = r.name;
