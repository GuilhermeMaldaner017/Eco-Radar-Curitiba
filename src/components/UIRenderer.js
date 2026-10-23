import { EventBus } from "../utils/EventBus.js";
import { formatDistance } from "../services/LocationService.js";
import { haversineDistance } from "../utils/haversine.js";

const ITEM_LABELS = {
  electronics: "Eletrônicos", batteries: "Pilhas", phones: "Celulares",
  computers: "Computadores", cables: "Cabos", lightbulbs: "Lâmpadas",
  printers: "Impressoras", tvs: "TVs", refrigerators: "Geladeiras",
  small_appliances: "Eletrodomésticos",
};

const CATEGORY_LABELS = {
  ecoponto: "Ecoponto", store: "Loja", manufacturer: "Fabricante", institution: "Instituição",
};

const DAY_LABELS = [
  ["weekdays", "Segunda a Sexta"],
  ["saturday", "Sábado"],
  ["sunday",   "Domingo"],
];

let userPosition = null;
let detailEl = null;
let detailKeyHandler = null;
let lastFocused = null;

// ─── Utils ───────────────────────────────────────────────────────────────
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(props)) {
    if (val == null || val === false) continue;
    if (key === "class") node.className = val;
    else if (key === "dataset") Object.assign(node.dataset, val);
    else if (key.startsWith("on") && typeof val === "function") node.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === "html") node.innerHTML = val;          // controlled use only (icon sprite)
    else if (key in node) node[key] = val;
    else node.setAttribute(key, val);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

function icon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${id}`);
  use.setAttribute("href", `#${id}`);
  svg.appendChild(use);
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

// ─── Public API ──────────────────────────────────────────────────────────
export function setUserPosition(pos) {
  userPosition = pos;
}

export function setLoadingState(isLoading) {
  const list = document.getElementById("points-list");
  if (!list || !isLoading) return;

  list.replaceChildren(
    ...Array.from({ length: 5 }, () =>
      el("li", { class: "skeleton-card", "aria-hidden": "true" },
        el("div", { class: "skeleton skeleton--title" }),
        el("div", { class: "skeleton skeleton--line" }),
        el("div", { class: "skeleton skeleton--tag" }),
      )
    )
  );
}

export function renderPointsList(points) {
  const list  = document.getElementById("points-list");
  const count = document.getElementById("points-count");
  const stat  = document.getElementById("topbar-count");
  if (!list) return;

  const n = points.length;
  if (count) count.textContent = `${n} ${n === 1 ? "ponto encontrado" : "pontos encontrados"}`;
  if (stat)  stat.textContent  = String(n);

  if (n === 0) { renderEmptyState(list); return; }

  const fragment = document.createDocumentFragment();
  for (const point of points) fragment.appendChild(renderCard(point));
  list.replaceChildren(fragment);
}

function renderEmptyState(list) {
  list.replaceChildren(
    el("li", { class: "empty", role: "status" },
      el("div", { class: "empty__icon" }, icon("i-recycle")),
      el("p", { class: "empty__title" }, "Nenhum ponto encontrado"),
      el("p", { class: "empty__hint" }, "Tente ajustar os filtros ou a busca."),
    )
  );
}

function renderCard(point) {
  const distanceText = userPosition
    ? formatDistance(haversineDistance(userPosition, point.coordinates))
    : null;

  const items = point.acceptedItems.slice(0, 3).map(
    (item) => el("span", { class: "tag" }, ITEM_LABELS[item] ?? item)
  );
  if (point.acceptedItems.length > 3) {
    items.push(el("span", { class: "tag tag--more" }, `+${point.acceptedItems.length - 3}`));
  }

  const card = el("li", {
    class: "card",
    role: "article",
    tabindex: "0",
    "data-id": point.id,
    "aria-label": `${point.name}, ${point.address.neighborhood}${distanceText ? `, ${distanceText}` : ""}`,
    onClick: () => EventBus.emit("point:selected", point),
    onKeydown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        EventBus.emit("point:selected", point);
      }
    },
  },
    el("div", { class: "card__row" },
      el("div", { class: "card__row", style: "gap:6px" },
        el("span", { class: `card__category-dot card__category-dot--${point.category}` }),
        el("span", { class: "card__category" }, CATEGORY_LABELS[point.category] ?? point.category),
      ),
      distanceText && el("span", { class: "card__distance" }, distanceText),
    ),
    el("h3", { class: "card__name" }, point.name),
    el("p", { class: "card__address" }, `${point.address.street}, ${point.address.number}, ${point.address.neighborhood}`),
    el("div", { class: "card__meta" }, items),
  );

  return card;
}

// ─── Detail panel ────────────────────────────────────────────────────────
export function showPointDetail(point) {
  closePointDetail();
  lastFocused = document.activeElement;

  const meta = CATEGORY_LABELS[point.category] ?? point.category;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${point.coordinates.lat},${point.coordinates.lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${point.coordinates.lat},${point.coordinates.lng}&navigate=yes`;

  const hours = DAY_LABELS.map(([key, label]) => {
    const h = point.operatingHours[key];
    return el("li", { class: h ? "" : "is-closed" },
      el("span", {}, label),
      el("strong", {}, h ? `${h.open} ate ${h.close}` : "Fechado"),
    );
  });

  const tags = point.acceptedItems.map(
    (item) => el("span", { class: "detail__tag" }, ITEM_LABELS[item] ?? item)
  );

  const safeWebsite = (() => {
    try {
      const u = new URL(point.website);
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
    } catch { return null; }
  })();
  const safePhone = point.phone ? String(point.phone).replace(/[^0-9+*#]/g, "") : "";

  const contacts = [];
  if (safePhone) {
    contacts.push(el("a", { href: `tel:${safePhone}`, class: "detail__contact" },
      icon("i-phone"), point.phone));
  }
  if (safeWebsite) {
    contacts.push(el("a", { href: safeWebsite, class: "detail__contact", target: "_blank", rel: "noopener noreferrer" },
      icon("i-globe"), "Visitar website"));
  }
  if (!contacts.length) {
    contacts.push(el("p", { class: "detail__address-muted" }, "Sem contato cadastrado."));
  }

  const closeBtn = el("button", {
    class: "detail__close",
    type: "button",
    "aria-label": "Fechar detalhes",
    onClick: closePointDetail,
  }, icon("i-close"));

  const btnGoogleMaps = el("a", {
    href: googleMapsUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    class: "btn btn--nav btn--google-maps",
  }, icon("i-google-maps"), "Google Maps");

  const btnWaze = el("a", {
    href: wazeUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    class: "btn btn--nav btn--waze",
  }, icon("i-waze"), "Waze");

  const navActions = el("div", { class: "detail__nav-wrap" },
    el("div", { class: "detail__nav-head" },
      icon("i-location"),
      el("span", {}, "Como chegar com seu app:"),
    ),
    el("div", { class: "detail__nav-grid" }, btnGoogleMaps, btnWaze),
  );

  detailEl = el("aside", {
    class: "detail",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "detail-name",
  },
    el("header", { class: "detail__head" },
      el("div", { class: "detail__head-content" },
        el("div", { class: "detail__category-row" },
          el("span", { class: `card__category-dot card__category-dot--${point.category}` }),
          el("span", { class: "detail__category" }, meta),
        ),
        el("h2", { class: "detail__name", id: "detail-name" }, point.name),
      ),
      closeBtn,
    ),
    el("div", { class: "detail__body" },
      el("section", { class: "detail__section" },
        el("h3", { class: "detail__section-title" }, icon("i-map-pin"), "Endereço"),
        el("address", { class: "detail__address" },
          `${point.address.street}, ${point.address.number}`,
          el("br"),
          `${point.address.neighborhood}, ${point.address.city}/${point.address.state}`,
          el("br"),
          el("span", { class: "detail__address-muted" }, `CEP ${point.address.zipCode}`),
        ),
      ),
      el("section", { class: "detail__section" },
        el("h3", { class: "detail__section-title" }, icon("i-clock"), "Horário de funcionamento"),
        el("ul", { class: "detail__hours" }, hours),
      ),
      el("section", { class: "detail__section" },
        el("h3", { class: "detail__section-title" }, icon("i-recycle"), "Itens aceitos"),
        el("div", { class: "detail__tags" }, tags),
      ),
      el("section", { class: "detail__section" },
        el("h3", { class: "detail__section-title" }, icon("i-info"), "Contato"),
        el("div", { class: "detail__contacts" }, contacts),
      ),
    ),
    el("footer", { class: "detail__foot" }, navActions),
  );

  document.body.appendChild(detailEl);
  requestAnimationFrame(() => detailEl.classList.add("detail--open"));
  closeBtn.focus({ preventScroll: true });

  detailKeyHandler = (e) => {
    if (e.key === "Escape") { closePointDetail(); return; }
    if (e.key !== "Tab" || !detailEl) return;
    const focusable = detailEl.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", detailKeyHandler);
}

export function closePointDetail() {
  if (!detailEl) return;
  const node = detailEl;
  detailEl = null;
  node.classList.remove("detail--open");

  const onEnd = (ev) => {
    if (ev.target !== node) return;
    node.removeEventListener("transitionend", onEnd);
    node.remove();
  };
  node.addEventListener("transitionend", onEnd);

  if (detailKeyHandler) {
    document.removeEventListener("keydown", detailKeyHandler);
    detailKeyHandler = null;
  }
  if (lastFocused?.focus) lastFocused.focus({ preventScroll: true });
  lastFocused = null;
}
