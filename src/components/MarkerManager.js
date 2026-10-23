import L from "leaflet";
import "leaflet.markercluster";
import { EventBus } from "../utils/EventBus.js";

// ─── Category metadata ────────────────────────────────────────────────────
// Cores de categorias maduras e sobrias
const CAT = {
  ecoponto:     { color: "#10b981", glow: "rgba(16,185,129,0.22)", label: "Ecoponto"    },
  store:        { color: "#38bdf8", glow: "rgba(56,189,248,0.22)", label: "Loja"         },
  manufacturer: { color: "#f59e0b", glow: "rgba(245,158,11,0.22)", label: "Fabricante"   },
  institution:  { color: "#a78bfa", glow: "rgba(167,139,250,0.22)", label: "Instituicao"  },
};

const DEFAULT_COLOR = "#94a3b8";

let clusterGroup = null;

// Marcadores pre-criados (cache permanente)
const allMarkers   = [];
const markerById   = new Map();
const pointById    = new Map();

function gradientId(colorA, colorB) {
  const a = colorA.replace("#", "");
  const b = colorB.replace("#", "");
  return `cg_${a}_${b}`;
}

const injectedGradients = new Set();
function ensureGradientDef(id, colorA, colorB) {
  if (injectedGradients.has(id)) return;
  injectedGradients.add(id);
  let svgDefs = document.getElementById("__cluster-defs__");
  if (!svgDefs) {
    svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgDefs.id = "__cluster-defs__";
    svgDefs.setAttribute("width", "0");
    svgDefs.setAttribute("height", "0");
    svgDefs.style.cssText = "position:absolute;pointer-events:none";
    document.body.appendChild(svgDefs);
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgDefs.appendChild(defs);
  }
  const defs = svgDefs.querySelector("defs");
  const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  grad.id = id;
  grad.setAttribute("x1", "0%"); grad.setAttribute("y1", "0%");
  grad.setAttribute("x2", "100%"); grad.setAttribute("y2", "100%");
  const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s1.setAttribute("offset", "0%"); s1.setAttribute("stop-color", colorA);
  const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s2.setAttribute("offset", "100%"); s2.setAttribute("stop-color", colorB);
  grad.appendChild(s1); grad.appendChild(s2);
  defs.appendChild(grad);
}

// Glifos nitidos e modernos por categoria (grade 24x24)
const GLYPHS = {
  ecoponto:
    '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.1-6 2.4-.5 4.9-2 5.9-3"/>',
  store:
    '<path d="M3 9l1.5-6h15L21 9v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="M3 9h18"/><path d="M9 22V13h6v9"/><path d="M8 5h8"/>',
  manufacturer:
    '<path d="M2 20h20"/><path d="M4 20V9l6 4V9l6 4V4h4v16"/>',
  institution:
    '<path d="m3 9 9-6 9 6"/><path d="M5 9v10M10 9v10M14 9v10M19 9v10"/><path d="M3 21h18"/>',
};

// Marcador em medalhao circular tatico de alta visibilidade
function tokenSvg(category, color, glow) {
  const glyph = GLYPHS[category] ?? GLYPHS.ecoponto;
  return `<span class="geo-token geo-token--${category}" role="img" aria-label="${category}">
    <svg viewBox="0 0 38 38" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
      <circle cx="19" cy="19" r="17.5" fill="${glow}"/>
      <circle cx="19" cy="19" r="14" fill="#0b0f14" stroke="${color}" stroke-width="2"/>
      <g transform="translate(10, 10) scale(0.75)" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
    </svg>
  </span>`;
}

const iconCache = {};
function getIcon(category) {
  if (iconCache[category]) return iconCache[category];
  const color = CAT[category]?.color ?? DEFAULT_COLOR;
  const glow  = CAT[category]?.glow ?? "rgba(148,163,184,0.2)";
  iconCache[category] = L.divIcon({
    className: "leaflet-marker-token-wrap",
    html: tokenSvg(category, color, glow),
    iconSize:    [38, 38],
    iconAnchor:  [19, 19],
    popupAnchor: [0, -22],
  });
  return iconCache[category];
}

// Cluster icon discreto e geometrico
function clusterSvg(count, colorA, colorB, glow, size) {
  const r  = size / 2;
  const ci = r - 2;
  const fontSize = count > 99 ? 10 : count > 9 ? 11 : 12;
  const isMixed  = colorA !== colorB;

  if (isMixed) {
    const id = gradientId(colorA, colorB);
    ensureGradientDef(id, colorA, colorB);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${r}" cy="${r}" r="${r}" fill="${glow}" opacity="0.4"/>
      <circle cx="${r}" cy="${r}" r="${ci}" fill="#0d1014" stroke="url(#${id})" stroke-width="1.5"/>
      <text x="${r}" y="${r}" dominant-baseline="central" text-anchor="middle"
        font-family="Inter,system-ui,sans-serif" font-size="${fontSize}" font-weight="600" fill="#fff">${count}</text>
    </svg>`;
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${r}" cy="${r}" r="${r}" fill="${glow}" opacity="0.4"/>
    <circle cx="${r}" cy="${r}" r="${ci}" fill="#0d1014" stroke="${colorA}" stroke-width="1.5"/>
    <text x="${r}" y="${r}" dominant-baseline="central" text-anchor="middle"
      font-family="Inter,system-ui,sans-serif" font-size="${fontSize}" font-weight="600" fill="#fff">${count}</text>
  </svg>`;
}

function makeClusterIcon(cluster) {
  const count = cluster.getChildCount();

  // Amostragem rapida: verifica apenas os primeiros 8 filhos diretos
  // para detectar se e mono ou multi-categoria. O(1) amortizado.
  const leaves = cluster.getAllChildMarkers();
  let firstCat = null;
  let isMixed  = false;
  const limit  = Math.min(leaves.length, 8);
  for (let i = 0; i < limit; i++) {
    const cat = leaves[i]?._ecoPoint?.category;
    if (!cat) continue;
    if (firstCat === null) { firstCat = cat; continue; }
    if (cat !== firstCat)  { isMixed = true; break; }
  }

  let colorA, colorB, glow;
  if (!isMixed && firstCat) {
    const m = CAT[firstCat] ?? { color: DEFAULT_COLOR, glow: "rgba(136,136,136,0.2)" };
    colorA = colorB = m.color;
    glow   = m.glow;
  } else {
    // misto: usa as duas categorias dominantes (ecoponto + store por padrao)
    colorA = CAT.ecoponto.color;
    colorB = CAT.store.color;
    glow   = CAT.ecoponto.glow;
  }

  const size = count >= 25 ? 48 : count >= 10 ? 42 : 36;
  return L.divIcon({
    html:       `<div class="cluster-wrap">${clusterSvg(count, colorA, colorB, glow, size)}</div>`,
    className:  "marker-cluster-custom",
    iconSize:   L.point(size + 8, size + 8),
    iconAnchor: L.point((size + 8) / 2, (size + 8) / 2),
  });
}

// ─── Popup ────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function popupContent(point) {
  const meta = CAT[point.category] ?? { label: point.category, color: DEFAULT_COLOR };
  return `
    <div class="popup">
      <p class="popup__category" style="color:${meta.color}">${escapeHtml(meta.label)}</p>
      <p class="popup__name">${escapeHtml(point.name)}</p>
      <p class="popup__address">${escapeHtml(point.address.street)}, ${escapeHtml(point.address.number)} - ${escapeHtml(point.address.neighborhood)}</p>
      <button class="popup__btn" type="button" data-id="${escapeHtml(point.id)}">
        Ver detalhes
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </button>
    </div>`;
}

// ─── Public API ───────────────────────────────────────────────────────────
export function init(map) {
  clusterGroup = L.markerClusterGroup({
    maxClusterRadius:        56,
    disableClusteringAtZoom: 15,
    showCoverageOnHover:     false,
    spiderfyOnMaxZoom:       true,
    chunkedLoading:          true,
    chunkDelay:              0,
    chunkInterval:           50,
    iconCreateFunction:      makeClusterIcon,
    animate:                 false,
    animateAddingMarkers:    false,
    removeOutsideVisibleBounds: true,
  });

  map.on("popupopen", (e) => {
    const node = e.popup.getElement();
    const btn  = node?.querySelector(".popup__btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const point = pointById.get(btn.dataset.id);
      if (point) EventBus.emit("point:selected", point);
    }, { once: true });
  });

  map.addLayer(clusterGroup);
}

/**
 * Inicializa os markers com TODOS os pontos (chamado uma vez no bootstrap).
 * Filtrar usa showMarkers/hideMarkers para evitar recriar markers.
 */
export function initMarkers(points) {
  allMarkers.length = 0;
  markerById.clear();
  pointById.clear();

  const markers = points.map((point) => {
    pointById.set(point.id, point);
    const marker = L.marker([point.coordinates.lat, point.coordinates.lng], {
      icon:        getIcon(point.category),
      title:       point.name,
      alt:         point.name,
      riseOnHover: true,
    });
    marker._ecoPoint = point;
    marker.bindPopup(popupContent(point), {
      maxWidth: 260, closeButton: true, autoPan: true, autoPanPadding: [40, 40],
    });
    markerById.set(point.id, marker);
    allMarkers.push(marker);
    return marker;
  });

  clusterGroup.addLayers(markers);
}

/**
 * Renderiza apenas os pontos visiveis (reusa markers pre-criados,
 * apenas remove/adiciona no clusterGroup (muito mais rapido que clearLayers).
 */
export function renderPoints(visiblePoints) {
  const visibleIds = new Set(visiblePoints.map((p) => p.id));

  // Separa markers em dois grupos: mostrar e esconder
  const toAdd    = [];
  const toRemove = [];

  for (const marker of allMarkers) {
    const id      = marker._ecoPoint?.id;
    const inGroup = clusterGroup.hasLayer(marker);
    const shouldShow = visibleIds.has(id);
    if (shouldShow && !inGroup) toAdd.push(marker);
    else if (!shouldShow && inGroup) toRemove.push(marker);
  }

  if (toRemove.length) clusterGroup.removeLayers(toRemove);
  if (toAdd.length)    clusterGroup.addLayers(toAdd);
}

export function clearMarkers() {
  clusterGroup?.clearLayers();
  allMarkers.length = 0;
  markerById.clear();
  pointById.clear();
  injectedGradients.clear();
}

export function highlightMarker(id) {
  const marker = markerById.get(id);
  if (!marker || !clusterGroup) return;
  clusterGroup.zoomToShowLayer(marker, () => marker.openPopup());
}