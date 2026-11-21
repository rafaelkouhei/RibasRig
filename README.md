# Sistema RibasRig

Sistema para gerar **Planos de Rigging** da Guindastes Ribas Ltda. O engenheiro descreve o içamento (carga, lingada,
guindaste, local), o sistema calcula a carga bruta, as taxas de utilização do guindaste e dos acessórios e o esforço
sobre o terreno, **bloqueia o que passa dos limites de segurança** e emite o PDF que vai para o cliente, com as
revisões guardadas como foram entregues.

Jornada de Aprendizagem · 6º semestre de Engenharia de Software · UniSENAI PR.

## Estrutura

```
ribasrig/
├── README.md               este arquivo: o que é, como rodar, testes
├── GUIA_DO_USUARIO.md      uso do sistema, tela por tela
├── ARQUITETURA.md          como funciona por dentro, com diagramas
├── docs/
│   ├── backend.md          servidor: como rodar, endpoints, variáveis, backup, documentos gerados
│   ├── frontend.md         telas: estrutura, modo demonstração × servidor, padrões de interface
│   ├── desktop.md          aplicativo: instalação, segurança do Electron, build do instalador
│   ├── dominio.md          referência das funções de regra de negócio (src/domain)
│   ├── especificacao-front-end-2026-10.md   especificação das telas de 08/10/2026 (histórica)
│   └── telas/              capturas do sistema real usadas no guia
├── .github/workflows/      CI do back-end, do front-end e do aplicativo
├── ribasrig-frontend/      telas (React + TypeScript + Material UI) e o motor de cálculo em TypeScript
├── ribasrig-backend/       API (Django + PostgreSQL, em Docker): cálculo oficial, emissão, revisões e PDFs
└── ribasrig-desktop/       aplicativo para o computador (Electron) e o instalador do Windows
```

**Ordem de leitura:** este README (o que é e como ligar) → [guia do usuário](GUIA_DO_USUARIO.md) (usar as telas) →
[arquitetura](ARQUITETURA.md) (como funciona por dentro) → o documento de cada parte em [`docs/`](docs/).

## Como rodar pela primeira vez

> **Por enquanto o sistema foi testado e roda só em máquina local:** o servidor (Django + PostgreSQL, em Docker)
> fica no mesmo computador do aplicativo. O **cenário ideal é um servidor dedicado para o back-end** (ex.: uma VPS),
> com um banco só para toda a equipe; o passo a passo está em
> [docs/backend.md](docs/backend.md#servidor-dedicado-vps), ainda não testado.

**Pré-requisitos:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) aberto e
[Node.js](https://nodejs.org/) 20.19 ou mais novo.

1. **Servidor:** siga "Como rodar" em [docs/backend.md](docs/backend.md#como-rodar-servidor-local) (criar o
   `.env`, `docker compose up -d --build` e, para a demonstração, `carregar_exemplo`).
2. **Aplicativo:** siga "Desenvolvimento" em [docs/desktop.md](docs/desktop.md#desenvolvimento) (`npm ci` no front e
   no desktop, depois `npm run build:front && npm start`). No Windows, `npm run dist:win` gera o instalador.
3. **Entrar:** usuário `giuliano.breda` (Administrador) ou `rigger.campo` (Operação), com a senha definida em
   `RIBASRIG_SENHA_TESTE` no `.env` do servidor.

O cenário de demonstração usa **07/10/2026 como "hoje"**, para os vencimentos de laudo e de inspeção aparecerem como
nas capturas do guia.

**Só para ver as telas, sem servidor:** `npm ci && npm run dev` em `ribasrig-frontend/` (dados de demonstração na
memória; qualquer senha entra).

## Testes

| projeto | comando | o que cobre | quantidade |
|---|---|---|---|
| `ribasrig-backend` | `.venv/bin/pytest` | motor de cálculo, API, permissões, documentos, limite de login, limite da taxa | 131 |
| `ribasrig-frontend` | `npm run typecheck && npm test` | regras em TypeScript, cliente HTTP, lógica das telas | 233 |
| ponta a ponta | no `ribasrig-frontend`, com o servidor no ar ([docs/frontend.md](docs/frontend.md#como-rodar)) | criar, anexar e emitir: o servidor recalcula o mesmo que a tela mostra | 5 |
| `ribasrig-desktop` | `npm test && npm run fumaca` | regras de caminho e protocolo; teste de fumaça do aplicativo | 9 + fumaça |

Os valores de aceitação vêm de um plano real da empresa (2607036): carga bruta 3.746,62 kg, capacidade no raio de
5,0 m de 9.260 kg, taxa do guindaste 40,46%, esforço nas sapatas 7.940,68 kgf, RMET 3,18 kgf/cm². A Rev. 1 desse
plano, feita no Excel, mostra o erro de interpolação que o sistema corrige (7.948 kg em vez de 9.260 kg).

## Integração contínua

Os workflows em `.github/workflows/` rodam só quando a parte deles muda:

| workflow | quando roda | o que faz |
|---|---|---|
| `backend.yml` | mudança em `ribasrig-backend/` | `check --deploy`, migrações pendentes e pytest num PostgreSQL 17 |
| `frontend.yml` | mudança em `ribasrig-frontend/` | tipos, testes, build e `npm audit` das dependências do app |
| `desktop.yml` | mudança em `ribasrig-desktop/` ou no front | testes do aplicativo e build do front em modo servidor |

## Limitações conhecidas

- [docs/backend.md](docs/backend.md#ainda-falta): assinatura digitalizada desenhada no PDF, ART do laudo do guindaste
  como arquivo separado, implantação num servidor dedicado (VPS: passo a passo
  pronto, ainda não testado).
- [docs/desktop.md](docs/desktop.md#ainda-falta): instalador sem assinatura de código e ainda não testado num
  computador Windows.
