import "@testing-library/jest-dom";

// Suprimir logs de console durante testes (mantém erros visíveis)
global.console.log = vi.fn();
global.console.info = vi.fn();
