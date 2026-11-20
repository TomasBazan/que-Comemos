import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEED_RECIPES } from './seed';

const KEY = 'quecomemos:recipes:v1';

export async function loadRecipes() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw == null) {
      // Primera vez: cargamos recetas de ejemplo.
      await saveRecipes(SEED_RECIPES);
      return SEED_RECIPES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('No se pudieron cargar las recetas', e);
    return [];
  }
}

export async function saveRecipes(recipes) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(recipes));
  } catch (e) {
    console.warn('No se pudieron guardar las recetas', e);
  }
}

export function newId() {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
