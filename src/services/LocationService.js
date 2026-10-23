import { haversineDistance } from "../utils/haversine.js";

const POSITION_CACHE_KEY = "ecoradar_user_pos";
const POSITION_TTL_MS = 300_000; // 5 minutos

const GEO_ERROR_MESSAGES = {
  1: "Permissão de localização negada. Ative nas configurações do navegador.",
  2: "Não foi possível determinar sua posição. Tente novamente.",
  3: "A solicitação expirou. Verifique sua conexão e tente novamente.",
};

const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: POSITION_TTL_MS,
};

/**
 * Obtém a posição do usuário via Geolocation API com cache em sessionStorage.
 * @returns {Promise<{lat: number, lng: number}>}
 */
export function getUserPosition() {
  const cached = _readPositionCache();
  if (cached) return Promise.resolve(cached);

  if (!navigator.geolocation) {
    return Promise.reject(
      new Error("Geolocalização não é suportada por este navegador.")
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        _writePositionCache(coords);
        resolve(coords);
      },
      (err) => {
        const message = GEO_ERROR_MESSAGES[err.code] ?? "Erro desconhecido de geolocalização.";
        reject({ code: err.code, message });
      },
      GEO_OPTIONS
    );
  });
}

/**
 * Ordena pontos por distância crescente em relação às coordenadas do usuário.
 * @param {import('../types').CollectionPoint[]} points
 * @param {{lat: number, lng: number}} userCoords
 * @returns {import('../types').CollectionPoint[]}
 */
export function sortByDistance(points, userCoords) {
  return [...points].sort((a, b) => {
    const distA = haversineDistance(userCoords, a.coordinates);
    const distB = haversineDistance(userCoords, b.coordinates);
    return distA - distB;
  });
}

/**
 * Retorna o ponto mais próximo do usuário ou null se não houver pontos.
 * @param {import('../types').CollectionPoint[]} points
 * @param {{lat: number, lng: number}} userCoords
 * @returns {import('../types').CollectionPoint | null}
 */
export function getNearestPoint(points, userCoords) {
  if (!points.length) return null;
  return sortByDistance(points, userCoords)[0];
}

/**
 * Formata uma distância em km para exibição amigável.
 * @param {number} km
 * @returns {string}
 */
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

function _readPositionCache() {
  try {
    const raw = sessionStorage.getItem(POSITION_CACHE_KEY);
    if (!raw) return null;
    const { lat, lng, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > POSITION_TTL_MS) {
      sessionStorage.removeItem(POSITION_CACHE_KEY);
      return null;
    }
    return { lat, lng };
  } catch {
    return null;
  }
}

function _writePositionCache(coords) {
  try {
    sessionStorage.setItem(
      POSITION_CACHE_KEY,
      JSON.stringify({ ...coords, timestamp: Date.now() })
    );
  } catch {
    // sessionStorage indisponível: ignora silenciosamente
  }
}
