import { describe, it, expect } from "vitest";
import { haversineDistance } from "../src/utils/haversine.js";

// Coordenadas de referência reais em Curitiba
const CURITIBA_CENTER = { lat: -25.4284, lng: -49.2731 };
const BATEL = { lat: -25.4417, lng: -49.2892 };
const SAO_PAULO = { lat: -23.5505, lng: -46.6333 };

describe("haversineDistance", () => {
  describe("cálculo de distância", () => {
    it("retorna 0 para o mesmo ponto", () => {
      const dist = haversineDistance(CURITIBA_CENTER, CURITIBA_CENTER);
      expect(dist).toBeCloseTo(0, 5);
    });

    it("calcula distância correta entre dois bairros de Curitiba (~2 km)", () => {
      const dist = haversineDistance(CURITIBA_CENTER, BATEL);
      // Distância real entre centro e Batel: ~2 km
      expect(dist).toBeGreaterThan(1.5);
      expect(dist).toBeLessThan(2.5);
    });

    it("calcula distância Curitiba para São Paulo dentro de margem de 10 km (~339 km)", () => {
      const dist = haversineDistance(CURITIBA_CENTER, SAO_PAULO);
      expect(dist).toBeGreaterThan(334);
      expect(dist).toBeLessThan(344);
    });

    it("é simétrica: dist(A,B) === dist(B,A)", () => {
      const distAB = haversineDistance(CURITIBA_CENTER, BATEL);
      const distBA = haversineDistance(BATEL, CURITIBA_CENTER);
      expect(distAB).toBeCloseTo(distBA, 10);
    });

    it("retorna valor em quilômetros (não metros)", () => {
      // Distância curta mas não zero: confirma que não está em metros
      const dist = haversineDistance(CURITIBA_CENTER, BATEL);
      expect(dist).toBeLessThan(100);
    });

    it("atravessa o meridiano 0° corretamente", () => {
      const london = { lat: 51.5074, lng: -0.1278 };
      const paris = { lat: 48.8566, lng: 2.3522 };
      const dist = haversineDistance(london, paris);
      expect(dist).toBeGreaterThan(330);
      expect(dist).toBeLessThan(350);
    });
  });

  describe("validação de entrada", () => {
    it("lança TypeError para coordenada null", () => {
      expect(() => haversineDistance(null, BATEL)).toThrow(TypeError);
    });

    it("lança TypeError para coordenada undefined", () => {
      expect(() => haversineDistance(CURITIBA_CENTER, undefined)).toThrow(TypeError);
    });

    it("lança TypeError para lat fora do intervalo [-90, 90]", () => {
      expect(() => haversineDistance({ lat: 91, lng: 0 }, BATEL)).toThrow(TypeError);
      expect(() => haversineDistance({ lat: -91, lng: 0 }, BATEL)).toThrow(TypeError);
    });

    it("lança TypeError para lng fora do intervalo [-180, 180]", () => {
      expect(() => haversineDistance({ lat: 0, lng: 181 }, BATEL)).toThrow(TypeError);
      expect(() => haversineDistance({ lat: 0, lng: -181 }, BATEL)).toThrow(TypeError);
    });

    it("lança TypeError para coordenada sem propriedades lat/lng", () => {
      expect(() => haversineDistance({ x: 10, y: 20 }, BATEL)).toThrow(TypeError);
    });

    it("lança TypeError para lat e lng não-numéricos", () => {
      expect(() => haversineDistance({ lat: "abc", lng: 0 }, BATEL)).toThrow(TypeError);
    });

    it("aceita coordenadas nos limites exatos do intervalo", () => {
      expect(() => haversineDistance({ lat: 90, lng: 180 }, { lat: -90, lng: -180 })).not.toThrow();
    });
  });
});
