import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ListScreen from './src/screens/ListScreen';
import DetailScreen from './src/screens/DetailScreen';
import FormScreen from './src/screens/FormScreen';
import { loadRecipes, saveRecipes, newId } from './src/storage';
import { colors } from './src/theme';

// Navegación simple por estado: { name: 'list' | 'detail' | 'form', id? }
export default function App() {
  const [recipes, setRecipes] = useState(null);
  const [route, setRoute] = useState({ name: 'list' });

  useEffect(() => {
    loadRecipes().then(setRecipes);
  }, []);

  const update = useCallback((fn) => {
    setRecipes((prev) => {
      const next = fn(prev);
      saveRecipes(next);
      return next;
    });
  }, []);

  // Botón "atrás" de Android: volver en vez de cerrar la app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'list') return false;
      if (route.name === 'form' && route.id) setRoute({ name: 'detail', id: route.id });
      else setRoute({ name: 'list' });
      return true;
    });
    return () => sub.remove();
  }, [route]);

  const toggleFavorite = (id) =>
    update((list) => list.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)));

  const deleteRecipe = (id) => {
    update((list) => list.filter((r) => r.id !== id));
    setRoute({ name: 'list' });
  };

  const saveRecipe = (data) => {
    if (data.id) {
      update((list) => list.map((r) => (r.id === data.id ? { ...r, ...data } : r)));
      setRoute({ name: 'detail', id: data.id });
    } else {
      const recipe = { ...data, id: newId(), favorite: false, createdAt: Date.now() };
      update((list) => [recipe, ...list]);
      setRoute({ name: 'detail', id: recipe.id });
    }
  };

  let screen;
  if (recipes === null) {
    screen = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  } else if (route.name === 'detail') {
    const recipe = recipes.find((r) => r.id === route.id);
    screen = recipe ? (
      <DetailScreen
        recipe={recipe}
        onBack={() => setRoute({ name: 'list' })}
        onEdit={(id) => setRoute({ name: 'form', id })}
        onDelete={deleteRecipe}
        onToggleFavorite={toggleFavorite}
      />
    ) : null;
  } else if (route.name === 'form') {
    const initial = route.id ? recipes.find((r) => r.id === route.id) : null;
    screen = (
      <FormScreen
        initial={initial}
        onCancel={() => setRoute(route.id ? { name: 'detail', id: route.id } : { name: 'list' })}
        onSave={saveRecipe}
      />
    );
  }
  if (!screen) {
    screen = (
      <ListScreen
        recipes={recipes}
        onOpen={(id) => setRoute({ name: 'detail', id })}
        onCreate={() => setRoute({ name: 'form' })}
        onToggleFavorite={toggleFavorite}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        {screen}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
