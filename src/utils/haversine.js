const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Calcula a distância em km entre dois pontos geográficos (fórmula de Haversine).
 * @param {{lat: number, lng: number}} coordA
 * @param {{lat: number, lng: number}} coordB
 * @returns {number} distância em quilômetros
 */
export function haversineDistance(coordA, coordB) {
  if (!isValidCoord(coordA) || !isValidCoord(coordB)) {
    throw new TypeError("Coordenadas inválidas: lat deve ser [-90,90] e lng [-180,180]");
  }

  const R = 6371;
  const dLat = toRad(coordB.lat - coordA.lat);
  const dLng = toRad(coordB.lng - coordA.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(coordA.lat)) *
    Math.cos(toRad(coordB.lat)) *
    Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidCoord(coord) {
  return (
    coord !== null &&
    typeof coord === "object" &&
    typeof coord.lat === "number" &&
    typeof coord.lng === "number" &&
    coord.lat >= -90 && coord.lat <= 90 &&
    coord.lng >= -180 && coord.lng <= 180
  );
}
