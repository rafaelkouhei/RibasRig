/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock' (padrão) ou 'http' (Django REST). Ver services/api.ts. */
  readonly VITE_API?: 'mock' | 'http';
  /** Origem da API quando não é a mesma do front (ex.: http://127.0.0.1:8000). Vazio = mesma origem. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
