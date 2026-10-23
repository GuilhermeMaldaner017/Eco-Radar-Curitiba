import L from "leaflet";

const CURITIBA_CENTER = [-25.4284, -49.2731];
const CURITIBA_BOUNDS = L.latLngBounds([-25.65, -49.45], [-25.30, -49.10]);

let map = null;
let userMarker = null;

/**
 * Tile providers gratuitos sem necessidade de API key.
 * Esri Dark Gray Canvas: basemap profissional preto+cinza com excelente contraste
 * entre ruas (claras) e quadras (escuras). Uso permitido com atribuição.
 */
const TILE_PROVIDERS = {
  esriDarkGray: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution: "Tiles &copy; Esri, DeLorme, NAVTEQ",
      maxZoom: 19,
    },
  },
};

export function init(containerId) {
  if (map) return map;

  map = L.map(containerId, {
    zoomControl: false,
    attributionControl: true,
    minZoom: 11,
    maxZoom: 19,
    maxBounds: CURITIBA_BOUNDS.pad(0.5),
    maxBoundsViscosity: 0.7,
    zoomSnap: 1,
    zoomDelta: 1,
    wheelDebounceTime: 40,
    wheelPxPerZoomLevel: 60,
    fadeAnimation: false,
    markerZoomAnimation: false,
    preferCanvas: true,
    tap: false,
    touchZoom: true,
    dragging: true,
    bounceAtZoomLimits: false,
  });

  if (map.tap) map.tap.disable();
  map.touchZoom?.enable();
  map.dragging?.enable();

  window.addEventListener("resize", () => {
    map?.invalidateSize();
  }, { passive: true });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => map?.invalidateSize(), 150);
  }, { passive: true });

  map.setView(CURITIBA_CENTER, 12);

  const provider = TILE_PROVIDERS.esriDarkGray;
  const tileOpts = {
    ...provider.options,
    maxNativeZoom: 16,
    maxZoom: 19,
    keepBuffer: 4,
    updateWhenZooming: false,
    updateWhenIdle: false,
    updateInterval: 120,
    crossOrigin: true,
  };
  L.tileLayer(provider.base, tileOpts).addTo(map);
  L.tileLayer(provider.labels, { ...tileOpts, pane: "shadowPane" }).addTo(map);

  let idleTimer;
  const root = document.body;
  const setMoving = () => { clearTimeout(idleTimer); root.classList.add("is-moving"); };
  const clearMoving = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => root.classList.remove("is-moving"), 120); };
  map.on("movestart zoomstart", setMoving);
  map.on("moveend zoomend", clearMoving);

  const updateZoomClass = () => {
    const z = map.getZoom();
    const mapEl = map.getContainer();
    if (!mapEl) return;
    mapEl.classList.remove("map--zoom-low", "map--zoom-mid", "map--zoom-high", "map--zoom-street");
    if (z <= 12) {
      mapEl.classList.add("map--zoom-low");
    } else if (z <= 14) {
      mapEl.classList.add("map--zoom-mid");
    } else if (z <= 16) {
      mapEl.classList.add("map--zoom-high");
    } else {
      mapEl.classList.add("map--zoom-street");
    }
  };
  map.on("zoomend", updateZoomClass);
  updateZoomClass();

  return map;
}

export function getMap() {
  return map;
}

export function setView(lat, lng, zoom = 15, animate = true) {
  map?.setView([lat, lng], zoom, { animate, duration: 0.4 });
}

export function flyTo(lat, lng, zoom = 16) {
  map?.flyTo([lat, lng], zoom, { duration: 0.6, easeLinearity: 0.25 });
}

export function zoomIn() { map?.zoomIn(1); }
export function zoomOut() { map?.zoomOut(1); }

export function showUserMarker(lat, lng) {
  removeUserMarker();
  if (!map) return;

  const icon = L.divIcon({
    className: "",
    html: '<div class="user-pin-wrap"><div class="user-pin-pulse"></div><div class="user-pin"></div></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  userMarker = L.marker([lat, lng], {
    icon,
    zIndexOffset: 1000,
    interactive: false,
    keyboard: false,
  }).addTo(map);
}

export function removeUserMarker() {
  if (userMarker) {
    map?.removeLayer(userMarker);
    userMarker = null;
  }
}

export function fitBounds(points) {
  if (!map || !points.length) return;
  if (points.length === 1) {
    setView(points[0].coordinates.lat, points[0].coordinates.lng, 15);
    return;
  }
  const bounds = L.latLngBounds(points.map((p) => [p.coordinates.lat, p.coordinates.lng]));
  map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true, duration: 0.6 });
}

export function invalidateSize() {
  map?.invalidateSize({ animate: false });
}
