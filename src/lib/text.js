// Normaliza texto para comparar sin importar mayúsculas, tildes ni espacios.
export const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
