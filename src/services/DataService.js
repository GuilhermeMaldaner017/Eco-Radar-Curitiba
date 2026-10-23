import { EventBus } from "../utils/EventBus.js";
import embeddedRaw from "../../data/collection-points.geojson?raw";

const embeddedData = JSON.parse(embeddedRaw);

const cache = new Map();
const CACHE_TTL = 3_600_000;

function featureToPoint(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  return { ...feature.properties, coordinates: { lat, lng } };
}

export async function loadPoints(url = "/data/collection-points.geojson") {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();
    if (geojson.type !== "FeatureCollection") throw new Error("GeoJSON invalido");

    const points = geojson.features.map(featureToPoint);
    cache.set(url, { data: points, timestamp: Date.now() });
    EventBus.emit("data:loaded", points);
    return points;
  } catch (err) {
    if (embeddedData && embeddedData.features) {
      const fallbackPoints = embeddedData.features.map(featureToPoint);
      cache.set(url, { data: fallbackPoints, timestamp: Date.now() });
      EventBus.emit("data:loaded", fallbackPoints);
      return fallbackPoints;
    }
    EventBus.emit("data:error", err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
