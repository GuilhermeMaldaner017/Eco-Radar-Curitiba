import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUserPosition,
  sortByDistance,
  getNearestPoint,
  formatDistance,
} from "../src/services/LocationService.js";

// ---------------------------------------------------------------------------
// Helpers para mock da Geolocation API
// ---------------------------------------------------------------------------

const mockGeolocation = (overrides = {}) => ({
  getCurrentPosition: vi.fn(),
  ...overrides,
});

const mockSuccessPosition = (lat = -25.4284, lng = -49.2731) => ({
  coords: { latitude: lat, longitude: lng, accuracy: 20 },
  timestamp: Date.now(),
});

const mockGeolocationError = (code, message = "Erro de geolocalização") => ({
  code,
  message,
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
});

// Pontos de teste
const makePoint = (id, lat, lng, items = []) => ({
  id,
  name: `Ponto ${id}`,
  address: { neighborhood: "Centro", city: "Curitiba", state: "PR", street: "Rua A", number: "1", zipCode: "80000-000" },
  coordinates: { lat, lng },
  operatingHours: { weekdays: { open: "08:00", close: "18:00" }, saturday: null, sunday: null },
  acceptedItems: items,
  category: "ecoponto",
  phone: null,
  website: null,
  verified: true,
  lastUpdated: "2026-05-08T00:00:00Z",
});

const USER_POS = { lat: -25.4284, lng: -49.2731 }; // Centro de Curitiba

const POINTS = [
  makePoint("near",   -25.4300, -49.2750), // ~0.27 km do usuário
  makePoint("mid",    -25.4500, -49.2900), // ~3 km
  makePoint("far",    -25.5000, -49.3200), // ~9 km
];

// ---------------------------------------------------------------------------
describe("getUserPosition", () => {
  let originalGeolocation;

  beforeEach(() => {
    originalGeolocation = navigator.geolocation;
    sessionStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: originalGeolocation,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  const setGeolocation = (geo) => {
    Object.defineProperty(navigator, "geolocation", {
      value: geo,
      configurable: true,
    });
  };

  it("resolve com {lat, lng} quando o navegador retorna posição", async () => {
    const geo = mockGeolocation();
    geo.getCurrentPosition.mockImplementation((success) =>
      success(mockSuccessPosition(-25.4284, -49.2731))
    );
    setGeolocation(geo);

    const pos = await getUserPosition();
    expect(pos).toEqual({ lat: -25.4284, lng: -49.2731 });
  });

  it("rejeita com código 1 e mensagem quando permissão é negada", async () => {
    const geo = mockGeolocation();
    geo.getCurrentPosition.mockImplementation((_, error) =>
      error(mockGeolocationError(1))
    );
    setGeolocation(geo);

    await expect(getUserPosition()).rejects.toMatchObject({
      code: 1,
      message: expect.stringContaining("negada"),
    });
  });

  it("rejeita com código 2 quando posição não está disponível", async () => {
    const geo = mockGeolocation();
    geo.getCurrentPosition.mockImplementation((_, error) =>
      error(mockGeolocationError(2))
    );
    setGeolocation(geo);

    await expect(getUserPosition()).rejects.toMatchObject({
      code: 2,
      message: expect.stringContaining("posição"),
    });
  });

  it("rejeita com código 3 e mensagem de timeout", async () => {
    const geo = mockGeolocation();
    geo.getCurrentPosition.mockImplementation((_, error) =>
      error(mockGeolocationError(3))
    );
    setGeolocation(geo);

    await expect(getUserPosition()).rejects.toMatchObject({
      code: 3,
      message: expect.stringContaining("expirou"),
    });
  });

  it("rejeita com mensagem quando navigator.geolocation não existe", async () => {
    setGeolocation(undefined);
    await expect(getUserPosition()).rejects.toThrow("não é suportada");
  });

  it("resolve do cache quando posição foi salva recentemente", async () => {
    sessionStorage.setItem(
      "ecoradar_user_pos",
      JSON.stringify({ lat: -25.0, lng: -49.0, timestamp: Date.now() })
    );

    const geo = mockGeolocation();
    setGeolocation(geo);

    const pos = await getUserPosition();
    expect(pos).toEqual({ lat: -25.0, lng: -49.0 });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("ignora cache expirado e chama a API novamente", async () => {
    const expiredTimestamp = Date.now() - 400_000; // 6.6 minutos atrás
    sessionStorage.setItem(
      "ecoradar_user_pos",
      JSON.stringify({ lat: -99.0, lng: -99.0, timestamp: expiredTimestamp })
    );

    const geo = mockGeolocation();
    geo.getCurrentPosition.mockImplementation((success) =>
      success(mockSuccessPosition(-25.4284, -49.2731))
    );
    setGeolocation(geo);

    const pos = await getUserPosition();
    expect(pos.lat).toBe(-25.4284);
    expect(geo.getCurrentPosition).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
describe("sortByDistance", () => {
  it("ordena pontos do mais próximo ao mais distante", () => {
    const shuffled = [POINTS[2], POINTS[0], POINTS[1]]; // far, near, mid
    const sorted = sortByDistance(shuffled, USER_POS);
    expect(sorted[0].id).toBe("near");
    expect(sorted[1].id).toBe("mid");
    expect(sorted[2].id).toBe("far");
  });

  it("não muta o array original", () => {
    const original = [...POINTS];
    sortByDistance(POINTS, USER_POS);
    expect(POINTS.map((p) => p.id)).toEqual(original.map((p) => p.id));
  });

  it("retorna array vazio para input vazio", () => {
    expect(sortByDistance([], USER_POS)).toHaveLength(0);
  });

  it("retorna array com um elemento sem erro", () => {
    const result = sortByDistance([POINTS[0]], USER_POS);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe("getNearestPoint", () => {
  it("retorna o ponto mais próximo do usuário", () => {
    const nearest = getNearestPoint(POINTS, USER_POS);
    expect(nearest.id).toBe("near");
  });

  it("retorna null para array vazio", () => {
    expect(getNearestPoint([], USER_POS)).toBeNull();
  });

  it("retorna o único ponto quando array tem tamanho 1", () => {
    const result = getNearestPoint([POINTS[2]], USER_POS);
    expect(result.id).toBe("far");
  });
});

// ---------------------------------------------------------------------------
describe("formatDistance", () => {
  it("formata distâncias abaixo de 1 km em metros", () => {
    expect(formatDistance(0.35)).toBe("350 m");
    expect(formatDistance(0.999)).toBe("999 m");
  });

  it("formata distâncias iguais ou maiores que 1 km com vírgula decimal", () => {
    expect(formatDistance(1.0)).toBe("1,0 km");
    expect(formatDistance(2.5)).toBe("2,5 km");
    expect(formatDistance(12.34)).toBe("12,3 km");
  });

  it("arredonda corretamente os metros", () => {
    expect(formatDistance(0.3456)).toBe("346 m");
  });

  it("formata zero como '0 m'", () => {
    expect(formatDistance(0)).toBe("0 m");
  });
});
