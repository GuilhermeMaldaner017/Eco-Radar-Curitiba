import { EventBus } from "../utils/EventBus.js";

const state = {
  points: { all: [], filtered: [], selected: null },
  filters: { activeItems: [], activeCategory: null, searchQuery: "" },
  user: { position: null, positionError: null },
  ui: { isLoading: false, isSidebarOpen: true, activeView: "map" },
};

function set(path, value) {
  const keys = path.split(".");
  let obj = state;
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
  obj[keys[keys.length - 1]] = value;
  EventBus.emit("state:changed", { path, value });
}

function get(path) {
  return path.split(".").reduce((obj, key) => obj?.[key], state);
}

export const AppState = { set, get, raw: state };
