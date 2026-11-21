import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * data/mock.ts monta o cenário com chamadas no topo do módulo, que o Rollup trataria como efeito colateral.
 * Declarado sem efeitos, ele sai inteiro do build com VITE_API=http (nenhum dado de exemplo no app empacotado).
 */
const mockSemEfeitos = (): Plugin => ({
  name: 'ribasrig-mock-sem-efeitos',
  transform(codigo, id) {
    return /[\\/]src[\\/]data[\\/]mock\.ts$/.test(id) ? { code: codigo, map: null, moduleSideEffects: false } : null;
  },
});

// base './' permite empacotar depois no Electron (arquivos locais)
export default defineConfig({
  plugins: [react(), mockSemEfeitos()],
  base: './',
  server: {
    port: 5173,
    // Com VITE_API=http, as chamadas /api vão para o Django. 127.0.0.1 (e não "localhost"): o Docker publica a API
    // só em IPv4, e em alguns sistemas "localhost" resolve primeiro para ::1 (IPv6), e a conexão seria recusada.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: { environment: 'node' },
});
