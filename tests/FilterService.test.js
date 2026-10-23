import { describe, it, expect, beforeEach } from "vitest";
import {
  filterByItem,
  filterByCategory,
  filterBySearch,
  applyFilters,
} from "../src/services/FilterService.js";

// Fixtures: dados que simulam pontos reais de Curitiba
const makePoint = (overrides = {}) => ({
  id: crypto.randomUUID(),
  name: "Ecoponto Batel",
  address: { street: "Rua Bispo Dom José", number: "100", neighborhood: "Batel", city: "Curitiba", state: "PR", zipCode: "80420-090" },
  coordinates: { lat: -25.4417, lng: -49.2892 },
  operatingHours: { weekdays: { open: "08:00", close: "18:00" }, saturday: null, sunday: null },
  acceptedItems: ["batteries", "phones"],
  category: "ecoponto",
  phone: null,
  website: null,
  verified: true,
  lastUpdated: "2026-05-08T00:00:00Z",
  ...overrides,
});

let points;

beforeEach(() => {
  points = [
    makePoint({ id: "1", name: "Ecoponto Centro", acceptedItems: ["batteries", "electronics"], category: "ecoponto", address: { neighborhood: "Centro", city: "Curitiba", state: "PR", street: "Av. Marechal Floriano", number: "100", zipCode: "80020-000" } }),
    makePoint({ id: "2", name: "Fast Shop Batel",  acceptedItems: ["phones", "computers"],    category: "store",    address: { neighborhood: "Batel", city: "Curitiba", state: "PR", street: "Rua Carlos de Carvalho", number: "200", zipCode: "80410-180" } }),
    makePoint({ id: "3", name: "Samsung Service",  acceptedItems: ["phones", "tvs"],          category: "manufacturer", address: { neighborhood: "Água Verde", city: "Curitiba", state: "PR", street: "Rua Augusto Stellfeld", number: "50", zipCode: "80250-100" } }),
    makePoint({ id: "4", name: "PUCPR Coleta",     acceptedItems: ["cables", "lightbulbs"],   category: "institution",  address: { neighborhood: "Prado Velho", city: "Curitiba", state: "PR", street: "Rua Imaculada Conceição", number: "1155", zipCode: "80215-901" } }),
    makePoint({ id: "5", name: "Ecoponto Água Verde", acceptedItems: ["batteries", "cables", "electronics"], category: "ecoponto", address: { neighborhood: "Água Verde", city: "Curitiba", state: "PR", street: "Av. do Batel", number: "900", zipCode: "80250-070" } }),
  ];
});

// ---------------------------------------------------------------------------
describe("filterByItem", () => {
  it("retorna todos os pontos que aceitam 'batteries'", () => {
    const result = filterByItem(points, "batteries");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining(["1", "5"]));
  });

  it("retorna todos os pontos que aceitam 'phones'", () => {
    const result = filterByItem(points, "phones");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining(["2", "3"]));
  });

  it("retorna array vazio quando nenhum ponto aceita o tipo", () => {
    const result = filterByItem(points, "refrigerators");
    expect(result).toHaveLength(0);
  });

  it("retorna todos os pontos quando itemType é falsy (sem filtro)", () => {
    expect(filterByItem(points, null)).toHaveLength(5);
    expect(filterByItem(points, "")).toHaveLength(5);
    expect(filterByItem(points, undefined)).toHaveLength(5);
  });

  it("não muta o array original", () => {
    const original = [...points];
    filterByItem(points, "batteries");
    expect(points).toHaveLength(original.length);
  });
});

// ---------------------------------------------------------------------------
describe("filterByCategory", () => {
  it("filtra corretamente pela categoria 'ecoponto'", () => {
    const result = filterByCategory(points, "ecoponto");
    expect(result).toHaveLength(2);
    result.forEach((p) => expect(p.category).toBe("ecoponto"));
  });

  it("filtra corretamente pela categoria 'store'", () => {
    const result = filterByCategory(points, "store");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("retorna todos os pontos quando category é falsy", () => {
    expect(filterByCategory(points, null)).toHaveLength(5);
    expect(filterByCategory(points, "")).toHaveLength(5);
  });

  it("retorna array vazio para categoria inexistente", () => {
    const result = filterByCategory(points, "government");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe("filterBySearch", () => {
  it("encontra por nome exato (case-insensitive)", () => {
    const result = filterBySearch(points, "samsung service");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("encontra por nome parcial", () => {
    const result = filterBySearch(points, "Ecoponto");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining(["1", "5"]));
  });

  it("encontra por bairro", () => {
    const result = filterBySearch(points, "Água Verde");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining(["3", "5"]));
  });

  it("ignora acentos na busca (diacríticos)", () => {
    const result = filterBySearch(points, "agua verde");
    expect(result).toHaveLength(2);
  });

  it("retorna todos quando query é vazia ou só espaços", () => {
    expect(filterBySearch(points, "")).toHaveLength(5);
    expect(filterBySearch(points, "   ")).toHaveLength(5);
    expect(filterBySearch(points, null)).toHaveLength(5);
  });

  it("retorna array vazio para query sem correspondência", () => {
    const result = filterBySearch(points, "xyzzy não existe");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe("applyFilters", () => {
  it("aplica filtro de item e categoria em conjunto (AND lógico)", () => {
    // Só ecopontos que aceitam batteries: IDs 1 e 5
    const result = applyFilters(points, { item: "batteries", category: "ecoponto" });
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining(["1", "5"]));
  });

  it("retorna array vazio quando filtros combinados não têm correspondência", () => {
    const result = applyFilters(points, { item: "batteries", category: "manufacturer" });
    expect(result).toHaveLength(0);
  });

  it("retorna todos os pontos quando nenhum filtro é passado", () => {
    expect(applyFilters(points, {})).toHaveLength(5);
  });

  it("aplica três filtros simultâneos corretamente", () => {
    const result = applyFilters(points, {
      item: "electronics",
      category: "ecoponto",
      search: "Centro",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("pipeline não muta o array original", () => {
    const snapshot = points.map((p) => p.id);
    applyFilters(points, { item: "batteries" });
    expect(points.map((p) => p.id)).toEqual(snapshot);
  });
});
