import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./styles/main.css";

import { EventBus } from "./utils/EventBus.js";
import { AppState } from "./state/AppState.js";
import { loadPoints } from "./services/DataService.js";
import { filterByItems, filterByCategory, filterBySearch } from "./services/FilterService.js";
import { getUserPosition, sortByDistance } from "./services/LocationService.js";
import { showToast } from "./components/NotificationManager.js";
import * as MapManager from "./components/MapManager.js";
import * as MarkerManager from "./components/MarkerManager.js";
import * as UIRenderer from "./components/UIRenderer.js";
import { startTileCaching } from "./services/TilePrefetcher.js";

startTileCaching();

// Revela a interface apenas com o CSS aplicado (evita flash de icones gigantes)
const revealApp = () => requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add("is-ready")));
if (document.readyState === "complete") revealApp();
else window.addEventListener("load", revealApp, { once: true });
setTimeout(() => document.documentElement.classList.add("is-ready"), 2500);

// ─── DOM refs (cached once) ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const dom = {};

// ─── Filter pipeline (multi-select aware) ────────────────────────────────
function computeFiltered(state) {
  const { all } = state.points;
  const { activeItems, activeCategory, searchQuery } = state.filters;

  // activeItems usa OR: ponto aparece se aceitar qualquer dos itens selecionados
  let result = filterByItems(all, activeItems);
  result = filterByCategory(result, activeCategory);
  result = filterBySearch(result, searchQuery);

  if (state.user.position) {
    result = sortByDistance(result, state.user.position);
  }
  return result;
}

function refreshFiltered() {
  const filtered = computeFiltered(AppState.raw);
  AppState.set("points.filtered", filtered);
  UIRenderer.renderPointsList(filtered);
  MarkerManager.renderPoints(filtered);
  const badge = $("reopen-badge");
  if (badge) badge.textContent = String(filtered.length);
}

// ─── EventBus wiring ─────────────────────────────────────────────────────
function wireEvents() {
  EventBus.on("data:loaded", (points) => {
    UIRenderer.renderPointsList(points);
    // Markers ja foram inicializados no bootstrap com initMarkers
  });

  EventBus.on("location:acquired", ({ lat, lng }) => {
    const pos = { lat, lng };
    AppState.set("user.position", pos);
    UIRenderer.setUserPosition(pos);
    MapManager.showUserMarker(lat, lng);
    MapManager.flyTo(lat, lng, 14);
    refreshFiltered();
    showToast("Localização obtida: pontos ordenados por proximidade.", "success");
    dom.mapLocate.classList.add("map-ctrl--active");
  });

  EventBus.on("location:error", ({ message }) => {
    showToast(message, "error", 6000);
  });

  EventBus.on("point:selected", (point) => {
    AppState.set("points.selected", point);
    if (window.matchMedia("(max-width: 768px)").matches) {
      setSidebarCollapsed(true);
    }
    MapManager.flyTo(point.coordinates.lat, point.coordinates.lng, 16);
    UIRenderer.showPointDetail(point);
    MarkerManager.highlightMarker(point.id);
  });
}

// ─── UI interactions ─────────────────────────────────────────────────────
function wireSearch() {
  let timer;
  dom.searchInput.addEventListener("input", () => {
    const value = dom.searchInput.value;
    dom.searchClear.hidden = value.length === 0;
    clearTimeout(timer);
    timer = setTimeout(() => {
      AppState.set("filters.searchQuery", value);
      refreshFiltered();
    }, 220);
  });
  dom.searchClear.addEventListener("click", () => {
    dom.searchInput.value = "";
    dom.searchClear.hidden = true;
    AppState.set("filters.searchQuery", "");
    refreshFiltered();
    dom.searchInput.focus();
  });
}

function wireChipGroup(containerId, key, attr) {
  const container = $(containerId);
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(`[data-${attr}]`);
    if (!btn) return;
    const value = btn.dataset[attr];
    const current = AppState.get(key);

    let next;
    if (Array.isArray(current)) {
      next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    } else {
      next = current === value ? null : value;
    }
    AppState.set(key, next);

    container.querySelectorAll(`[data-${attr}]`).forEach((b) => {
      const active = Array.isArray(next) ? next.includes(b.dataset[attr]) : b.dataset[attr] === next;
      b.setAttribute("aria-pressed", String(active));
      b.classList.toggle("chip--active", active);
    });

    refreshFiltered();
  });

  // ARIA defaults
  container.querySelectorAll(`[data-${attr}]`).forEach((b) => b.setAttribute("aria-pressed", "false"));
}

function wireMapControls() {
  dom.zoomIn.addEventListener("click",  () => MapManager.zoomIn());
  dom.zoomOut.addEventListener("click", () => MapManager.zoomOut());
  if (dom.mapReset) {
    dom.mapReset.addEventListener("click", () => {
      MapManager.flyTo(-25.4284, -49.2731, 12);
      showToast("Visualização centralizada em Curitiba.", "info", 2000);
    });
  }
  dom.mapLocate.addEventListener("click", requestUserLocation);
  dom.btnLocate.addEventListener("click", requestUserLocation);
}

function wireTelemetry() {
  const map = MapManager.getMap();
  if (!map) return;
  const coordsEl = $("hud-coords");
  const zoomEl = $("hud-zoom-label");
  const updateHUD = () => {
    const c = map.getCenter();
    const latAbs = Math.abs(c.lat).toFixed(4);
    const lngAbs = Math.abs(c.lng).toFixed(4);
    const latHem = c.lat < 0 ? "S" : "N";
    const lngHem = c.lng < 0 ? "W" : "E";
    if (coordsEl) coordsEl.textContent = `${latAbs}° ${latHem}, ${lngAbs}° ${lngHem}`;
    if (zoomEl) zoomEl.textContent = `ZOOM ${Math.round(map.getZoom())}x`;
  };
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; requestAnimationFrame(updateHUD); }, 150);
  };
  map.on("move", schedule);
  map.on("moveend zoomend", updateHUD);
  updateHUD();
}

async function requestUserLocation() {
  // Desativa cache para forçar nova tentativa ao clicar novamente
  try { sessionStorage.removeItem("ecoradar_user_pos"); } catch {}
  dom.mapLocate.classList.remove("map-ctrl--active");
  showToast("Obtendo sua localização…", "info", 3000);
  try {
    const pos = await getUserPosition();
    EventBus.emit("location:acquired", { lat: pos.lat, lng: pos.lng });
  } catch (err) {
    const msg = typeof err?.message === "string"
      ? err.message
      : "Não foi possível obter sua localização. Verifique as permissões do navegador.";
    EventBus.emit("location:error", { message: msg });
    dom.mapLocate.classList.remove("map-ctrl--active");
  }
}

function setSidebarCollapsed(collapsed) {
  dom.sidebar.classList.toggle("sidebar--collapsed", collapsed);
  dom.sidebar.classList.toggle("is-open", !collapsed);
  document.body.classList.toggle("sidebar-closed", collapsed);
  document.body.classList.toggle("sidebar-open", !collapsed);
  dom.sidebarReopen.hidden = !collapsed;
  // RAF for smooth opacity transition after display change
  requestAnimationFrame(() => dom.sidebarReopen.classList.toggle("is-visible", collapsed));
  requestAnimationFrame(MapManager.invalidateSize);
}

function wireSidebarToggle() {
  dom.sidebarClose.addEventListener("click", () => setSidebarCollapsed(true));
  const backdrop = $("sidebar-backdrop");
  backdrop?.addEventListener("click", () => setSidebarCollapsed(true));
  dom.sheetHandle?.addEventListener("click", () => {
    const isCollapsed = dom.sidebar.classList.contains("sidebar--collapsed");
    setSidebarCollapsed(!isCollapsed);
  });
  dom.sidebarReopen.addEventListener("click", () => {
    setSidebarCollapsed(false);
    dom.searchInput.focus({ preventScroll: true });
  });

  // Gesto swipe para recolher o painel no mobile
  let touchStartY = 0;
  dom.sidebar?.addEventListener("touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  dom.sidebar?.addEventListener("touchend", (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const distanceY = touchEndY - touchStartY;
    if (distanceY > 60 && dom.sidebar.scrollTop <= 10) {
      setSidebarCollapsed(true);
    }
  }, { passive: true });
}

// Bootstrap
async function bootstrap() {
  Object.assign(dom, {
    sidebar:        $("sidebar"),
    sidebarClose:   $("btn-sidebar-close"),
    sidebarReopen:  $("btn-sidebar-reopen"),
    sheetHandle:    $("sheet-handle"),
    searchInput:    $("search-input"),
    searchClear:    $("search-clear"),
    btnLocate:      $("btn-locate"),
    zoomIn:         $("zoom-in"),
    zoomOut:        $("zoom-out"),
    mapReset:       $("map-reset"),
    mapLocate:      $("map-locate"),
  });

  MapManager.init("map");
  MarkerManager.init(MapManager.getMap());

  wireEvents();
  wireSearch();
  wireChipGroup("filter-items",      "filters.activeItems",    "item");
  wireChipGroup("filter-categories", "filters.activeCategory", "category");
  wireMapControls();
  wireSidebarToggle();
  wireTelemetry();

  // No mobile, inicia com a sidebar recolhida para priorizar a visualizacao e toque no mapa
  if (window.matchMedia("(max-width: 768px)").matches) {
    setSidebarCollapsed(true);
  }

  UIRenderer.setLoadingState(true);

  try {
    const points = await loadPoints();
    AppState.set("points.all", points);
    AppState.set("points.filtered", points);
    // Cria todos os markers UMA vez; filtros apenas mostram/ocultam
    MarkerManager.initMarkers(points);
    UIRenderer.renderPointsList(points);
    UIRenderer.setLoadingState(false);
    const badge = $("reopen-badge");
    if (badge) badge.textContent = String(points.length);
  } catch {
    showToast("Erro ao carregar dados. Recarregue a pagina.", "error", 6000);
    UIRenderer.renderPointsList([]);
  }
}

bootstrap();
