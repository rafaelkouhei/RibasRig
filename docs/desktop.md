# RibasRig · Aplicativo para o computador (`ribasrig-desktop/`)

Empacota o front (`ribasrig-frontend`) como aplicativo do Windows (e, para testes, do macOS). Fala com o servidor
(`ribasrig-backend`, Docker Compose) e cuida do que o navegador não faz: gravar o PDF do plano, o memorial e a
planilha do carimbo na pasta do cliente, abrir esses arquivos e escolher a pasta dos planos.

**Stack:** Electron 44 · TypeScript · electron-builder (instalador NSIS para Windows).
Visão geral do sistema: [README](../README.md), [guia do usuário](../GUIA_DO_USUARIO.md) e [arquitetura](../ARQUITETURA.md).
Os comandos abaixo rodam dentro da pasta `ribasrig-desktop/`.

## Como funciona

```
Janela (front React, modo VITE_API=http)
   │  app://ribasrig/index.html   ← arquivos do pacote (pasta app/), com CSP
   │  app://ribasrig/api/...      ← repassado para http://127.0.0.1:8000 (Django no Docker)
   │  window.ribasrig.*           ← ponte (preload): gravar/abrir arquivos do plano, escolher pasta
Processo principal (src/main.ts)
```

- **Mesma origem:** a página e a API ficam em `app://ribasrig`, então o front usa as mesmas URLs relativas
  (`/api/...`) do desenvolvimento, sem CORS e sem `file://`.
- **Servidor fora do ar:** mostra uma página genérica ("O servidor do RibasRig está fora do ar") e confere de novo a
  cada 5 s. Com a pasta do back-end configurada (servidor neste computador), antes tenta `docker compose up -d` uma vez.
- **Segurança** (seção 11 da [especificação do front](especificacao-front-end-2026-10.md#11-integração-com-o-back-end-django-rest)): `contextIsolation`, `sandbox` e sem Node na página; CSP
  `script-src 'self'`; navegação para fora e janelas novas bloqueadas (links https abrem no navegador);
  permissões do navegador negadas; DevTools só fora do pacote; o front empacotado nunca tem o mock.
- **A ponte só faz o necessário:** grava apenas `.pdf` e `.xlsx`, apenas dentro de
  `<pasta raiz>\<cliente>\<nº>\<Relatório|Cálculo|Desenhos>` (nº com 7 dígitos e subpasta de uma lista fechada,
  conferidos no processo principal). A pasta raiz é a das Configurações (vem do servidor, alterada só pelo
  Administrador): o aplicativo confere que é um caminho absoluto sem `..`, não qual pasta é. Nomes limpos (sem `..`, sem `\ / : * ? " < > |`,
  sem nomes reservados do Windows); só abre ou mostra arquivos que o próprio aplicativo gravou; só atende pedidos
  vindos de `app://ribasrig`.
- **Idioma fixo em pt-BR** (`--lang=pt-BR`): campos de data em dd/mm/aaaa mesmo num computador com o sistema em outro
  idioma.

## Instalar no computador da empresa

1. O servidor no ar ([docs/backend.md](backend.md)). Hoje o sistema só foi testado com o servidor **neste mesmo
   computador** (Docker Desktop instalado). O cenário ideal é um servidor dedicado, acessado por `https://`
   ([Servidor dedicado (VPS)](backend.md#servidor-dedicado-vps), ainda não testado).
2. Rodar `RibasRig Setup 1.0.0.exe` (gerado por `npm run dist:win` em `release/`). O instalador cria os atalhos
   "RibasRig" na área de trabalho e no menu Iniciar, com o ícone do sistema.
3. Opcional: criar `%APPDATA%\RibasRig\configuracao.json` (macOS: `~/Library/Application Support/RibasRig/`).
   Com `backend`, o aplicativo consegue subir o servidor sozinho; `api` aceita `http://127.0.0.1:<porta>` ou um
   endereço `https://` (servidor remoto):

   ```json
   { "api": "http://127.0.0.1:8000", "backend": "C:\\RibasRig\\ribasrig-backend" }
   ```

   Com um servidor dedicado, só o endereço (sem `backend`, o aplicativo não tenta subir o Docker):

   ```json
   { "api": "https://ribasrig.exemplo.com.br" }
   ```

4. Em **Configurações › Pasta dos planos**, escolher a pasta raiz (o botão "Escolher pasta" abre o seletor do sistema).

No macOS, o `RibasRig.app` de teste abre pela primeira vez com clique direito › Abrir.

## Desenvolvimento

Pré-requisito: Node.js 22.12+ (o Electron 44 e o `node --test` com padrão de arquivos pedem isso) e o `ribasrig-frontend` clonado ao lado desta pasta, com as dependências instaladas
(`cd ../ribasrig-frontend && npm ci`).

```bash
npm ci                 # Electron 44.10.1 (o binário baixa na primeira execução)
npm run build:front    # gera ../ribasrig-frontend com VITE_API=http em ./app
npm start              # compila src/ e abre o aplicativo (back-end em http://127.0.0.1:8000)
npm test               # testes das regras de caminho e do protocolo (node:test)
npm run fumaca         # teste de fumaça: abre o sistema escondido, confere ponte, isolamento e proxy, e fecha
npm run dist:win       # instalador do Windows em release/ (funciona também a partir do macOS)
                       # Release no GitHub: tag v<versão> (workflow release.yml, num Windows; ver o README)
npm run app:mac        # RibasRig.app (sem instalador, sem assinatura) em release/mac-arm64, para testar no Mac
```

O `app/` é uma cópia do front: depois de mudar o front, rode `build:front` de novo (ou `dist:win`/`app:mac`, que já
rodam). O `build:front` não roda a checagem de tipos; antes de gerar uma versão, rode `npm run typecheck` e `npm test`
no front.

No teste de fumaça, `RIBASRIG_E2E_SENHA=<senha de teste>` inclui login e um upload pelo proxy (uma imagem inválida
que o servidor lê e recusa antes de gravar: o teste não deixa nada no banco), e `RIBASRIG_FUMACA_IMAGEM=tela.png`
salva a tela.

> Se o terminal foi aberto por outro aplicativo Electron (ex.: algumas extensões do VS Code), ele pode herdar
> `ELECTRON_RUN_AS_NODE=1`, e o Electron roda como Node. O aplicativo avisa; remova a variável
> (`env -u ELECTRON_RUN_AS_NODE npm start`).

Variáveis: `RIBASRIG_API_URL` (padrão `http://127.0.0.1:8000`), `RIBASRIG_BACKEND_DIR` (pasta do
docker-compose; em desenvolvimento usa `../ribasrig-backend`).

`npm audit` aponta um aviso moderado no `minimatch` usado pelo `electron-builder`. É ferramenta de empacotamento:
não vai para o aplicativo instalado (o pacote só tem `dist/`, `app/` e o ícone), e a "correção" sugerida rebaixaria o
electron-builder para uma versão antiga.

A CI (`.github/workflows/desktop.yml`, na raiz) roda `npm test` e o build do front em modo servidor quando o aplicativo
ou o front mudam (sem baixar o Electron).

## Arquivos

```
src/main.ts        janela, segurança, protocolo app://, servidor desligado, ponte (IPC), teste de fumaça
src/preload.ts     window.ribasrig (espelha PonteDesktop em ribasrig-frontend/src/services/arquivos.ts)
src/protocolo.ts   arquivos do pacote com CSP e repasse de /api para o Django
src/arquivos.ts    regras de onde e o que gravar
src/servidor.ts    confere/sobe o servidor e a página de servidor desligado
src/config.ts      configuracao.json (aceita BOM) e variáveis de ambiente
scripts/construir-front.mjs   build do front com VITE_API=http (também no Windows)
build/icon.png     ícone do aplicativo (o electron-builder gera o .ico e o .icns a partir dele)
```

## Ainda falta

- **Assinatura de código:** o instalador não é assinado (sem certificado), então o Windows SmartScreen pede
  confirmação na primeira instalação.
- **Teste num Windows real:** o instalador foi gerado e o aplicativo testado no macOS (inclusive o teste de fumaça do
  pacote); falta instalar e usar num computador Windows.
