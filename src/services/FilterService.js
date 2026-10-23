const removeDiacritics = (str) =>
  str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Retorna pontos que aceitam o tipo de resíduo especificado.
 * @param {import('../types').CollectionPoint[]} points
 * @param {string} itemType
 * @returns {import('../types').CollectionPoint[]}
 */
export function filterByItem(points, itemType) {
  if (!itemType) return points;
  return points.filter((p) => p.acceptedItems.includes(itemType));
}

/**
 * Retorna pontos que aceitam QUALQUER dos tipos de resíduo selecionados (OR).
 * @param {import('../types').CollectionPoint[]} points
 * @param {string[]} itemTypes - array vazio = sem filtro
 * @returns {import('../types').CollectionPoint[]}
 */
export function filterByItems(points, itemTypes) {
  if (!itemTypes || itemTypes.length === 0) return points;
  return points.filter((p) => itemTypes.some((item) => p.acceptedItems.includes(item)));
}

/**
 * Retorna pontos da categoria especificada.
 * @param {import('../types').CollectionPoint[]} points
 * @param {string} category
 * @returns {import('../types').CollectionPoint[]}
 */
export function filterByCategory(points, category) {
  if (!category) return points;
  return points.filter((p) => p.category === category);
}

/**
 * Filtra por texto livre contra nome e bairro (insensível a acento e caixa).
 * @param {import('../types').CollectionPoint[]} points
 * @param {string} query
 * @returns {import('../types').CollectionPoint[]}
 */
export function filterBySearch(points, query) {
  if (!query || query.trim() === "") return points;
  const normalized = removeDiacritics(query.trim());
  return points.filter((p) => {
    const name = removeDiacritics(p.name);
    const neighborhood = removeDiacritics(p.address.neighborhood);
    return name.includes(normalized) || neighborhood.includes(normalized);
  });
}

/**
 * Aplica múltiplos filtros em pipeline funcional (reduce).
 * @param {import('../types').CollectionPoint[]} points
 * @param {{ item?: string, category?: string, search?: string }} filters
 * @returns {import('../types').CollectionPoint[]}
 */
export function applyFilters(points, filters = {}) {
  const pipeline = [
    (pts) => filterByItem(pts, filters.item),
    (pts) => filterByCategory(pts, filters.category),
    (pts) => filterBySearch(pts, filters.search),
  ];
  return pipeline.reduce((pts, fn) => fn(pts), points);
}
