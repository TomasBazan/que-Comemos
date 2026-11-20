import { supabase } from './supabase';

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// ---------- Recetas ----------

const RECIPE_LIST_FIELDS =
  'id, name, minutes, servings, visibility, owner_id, created_at, owner:profiles(display_name), recipe_ingredients(name)';

export async function listRecipes() {
  return check(
    await supabase.from('recipes').select(RECIPE_LIST_FIELDS).order('created_at', { ascending: false }).limit(500),
  );
}

export async function getRecipe(id) {
  return check(
    await supabase
      .from('recipes')
      .select('*, owner:profiles(display_name), recipe_ingredients(id, position, name, quantity)')
      .eq('id', id)
      .order('position', { referencedTable: 'recipe_ingredients' })
      .maybeSingle(),
  );
}

// Crea o actualiza la receta y reemplaza sus ingredientes.
export async function saveRecipe({ id, name, minutes, servings, visibility, steps, ingredients }) {
  const fields = { name, minutes, servings, visibility, steps };
  let recipeId = id;
  if (id) {
    check(await supabase.from('recipes').update(fields).eq('id', id));
    check(await supabase.from('recipe_ingredients').delete().eq('recipe_id', id));
  } else {
    recipeId = check(await supabase.from('recipes').insert(fields).select('id').single()).id;
  }
  if (ingredients.length) {
    check(
      await supabase
        .from('recipe_ingredients')
        .insert(ingredients.map((ing, i) => ({ recipe_id: recipeId, position: i, name: ing.name, quantity: ing.quantity || null }))),
    );
  }
  return recipeId;
}

export async function deleteRecipe(id) {
  check(await supabase.from('recipes').delete().eq('id', id));
}

// ---------- Colecciones ----------

export async function listCollections() {
  return check(
    await supabase
      .from('collections')
      .select('id, name, position, collection_recipes(recipe_id)')
      .order('position')
      .order('created_at'),
  );
}

export async function createCollection(name) {
  return check(await supabase.from('collections').insert({ name: name.trim() }).select().single());
}

export async function deleteCollection(id) {
  check(await supabase.from('collections').delete().eq('id', id));
}

export async function setInCollection(collectionId, recipeId, inside) {
  if (inside) {
    check(
      await supabase
        .from('collection_recipes')
        .upsert({ collection_id: collectionId, recipe_id: recipeId }, { ignoreDuplicates: true }),
    );
  } else {
    check(await supabase.from('collection_recipes').delete().match({ collection_id: collectionId, recipe_id: recipeId }));
  }
}

// ---------- Grupos ----------

export async function listMyGroups() {
  return check(
    await supabase
      .from('groups')
      .select('id, name, invite_code, created_at, group_members(user_id, role, profiles(display_name))')
      .order('created_at'),
  );
}

export async function createGroup(name) {
  return check(await supabase.rpc('create_group', { group_name: name }));
}

export async function joinGroup(code) {
  return check(await supabase.rpc('join_group', { code }));
}

export async function leaveGroup(gid) {
  check(await supabase.rpc('leave_group', { gid }));
}

export async function renameGroup(id, name) {
  check(await supabase.from('groups').update({ name }).eq('id', id));
}

// ---------- Plan ----------

export async function listPlan(groupId, fromDay, toDay) {
  return check(
    await supabase
      .from('meal_plan')
      .select('id, day, slot, recipe_id, recipes(name), added_by, adder:profiles(display_name)')
      .eq('group_id', groupId)
      .gte('day', fromDay)
      .lte('day', toDay)
      .order('created_at'),
  );
}

export async function addToPlan(groupId, day, slot, recipeId) {
  check(await supabase.from('meal_plan').insert({ group_id: groupId, day, slot, recipe_id: recipeId }));
}

export async function removeFromPlan(id) {
  check(await supabase.from('meal_plan').delete().eq('id', id));
}

// ---------- Lista de compras ----------

export async function listShopping(groupId) {
  return check(
    await supabase
      .from('shopping_items')
      .select(
        'id, name, quantity, checked, checked_at, meal_plan_id, created_at, checker:profiles!shopping_items_checked_by_fkey(display_name), meal_plan(day, slot, recipes(name))',
      )
      .eq('group_id', groupId)
      .order('created_at'),
  );
}

export async function setChecked(groupId, name, value) {
  check(await supabase.rpc('set_item_checked', { gid: groupId, item_name: name, value }));
}

export async function addShoppingItem(groupId, name, quantity) {
  check(await supabase.from('shopping_items').insert({ group_id: groupId, name: name.trim(), quantity: quantity || null }));
}

export async function deleteShoppingItems(ids) {
  check(await supabase.from('shopping_items').delete().in('id', ids));
}

// ---------- Cuenta ----------

export async function updateDisplayName(userId, display_name) {
  check(await supabase.from('profiles').update({ display_name }).eq('id', userId));
}

export async function deleteAccount() {
  check(await supabase.rpc('delete_account'));
}
