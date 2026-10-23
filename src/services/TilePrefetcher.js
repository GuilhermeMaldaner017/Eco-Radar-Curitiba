/**
 * Registra o service worker de cache e pre-aquece, em segundo plano,
 * os tiles de Curitiba (zoom 11 a 14). O trafego e baixo e controlado:
 * poucas requisicoes simultaneas e somente quando o navegador esta ocioso.
 */
const BASE = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile";
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile";

// Area central de Curitiba (onde estao os 22 pontos)
const BOUNDS = { south: -25.58, north: -25.34, west: -49.40, east: -49.14 };
const ZOOMS = [11, 12, 13, 14];
const CONCURRENCY = 3;

function lngToX(lng, z) { return Math.floor(((lng + 180) / 360) * 2 ** z); }
function latToY(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

function buildQueue() {
  const urls = [];
  for (const z of ZOOMS) {
    const x0 = lngToX(BOUNDS.west, z), x1 = lngToX(BOUNDS.east, z);
    const y0 = latToY(BOUNDS.north, z), y1 = latToY(BOUNDS.south, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(`${BASE}/${z}/${y}/${x}`, `${LABELS}/${z}/${y}/${x}`);
      }
    }
  }
  return urls;
}

const idle = (fn) =>
  "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500);

function prefetch() {
  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;

  const queue = buildQueue();
  let active = 0;

  const pump = () => {
    while (active < CONCURRENCY && queue.length) {
      const url = queue.shift();
      active++;
      fetch(url, { mode: "cors", priority: "low" })
        .catch(() => {})
        .finally(() => {
          active--;
          idle(pump);
        });
    }
  };
  pump();
}

export function startTileCaching() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => setTimeout(() => idle(prefetch), 4000))
      .catch(() => {});
  });
}
