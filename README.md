# Sistema RibasRig

Sistema para gerar **Planos de Rigging** da Guindastes Ribas Ltda. O engenheiro descreve o içamento (carga, lingada,
guindaste, local), o sistema calcula a carga bruta, as taxas de utilização do guindaste e dos acessórios e o esforço
sobre o terreno, **bloqueia o que passa dos limites de segurança** e emite o PDF que vai para o cliente, com as
revisões guardadas como foram entregues.

Jornada de Aprendizagem · 6º semestre de Engenharia de Software · UniSENAI PR.

> **Avaliação:** para instalar e usar o sistema num computador Windows, siga
> [Avaliação no Windows (passo a passo do zero)](#avaliação-no-windows-passo-a-passo-do-zero). O instalador pronto
> também está nas [Releases](https://github.com/rafaelkouhei/RibasRig/releases/latest), caso não dê para compilar.

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
├── .github/workflows/      CI do back-end, do front-end e do aplicativo; instalador do Windows nas Releases
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
[Node.js](https://nodejs.org/) 22.12 ou mais novo (o Vitest e o Electron pedem isso; `.nvmrc` na raiz).

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

## Avaliação no Windows (passo a passo do zero)

O sistema tem duas partes que rodam no mesmo computador: o **servidor** (banco de dados e API, em Docker) e o
**aplicativo** (o programa instalado, `RibasRig Setup 1.0.0.exe`). O aplicativo sozinho não funciona: sem o servidor
ligado, ele mostra "O servidor do RibasRig está fora do ar". Por isso o passo a passo começa pelo servidor.

Todos os comandos são para o **PowerShell** do Windows 10 ou 11 (64 bits), um por linha.

### 1. Instalar os programas necessários

| programa | para quê | onde baixar |
|---|---|---|
| Docker Desktop | roda o servidor (PostgreSQL + API) | <https://www.docker.com/products/docker-desktop/> (aceite ativar o WSL 2 se ele pedir) |
| Node.js 22 LTS ou mais novo (≥ 22.12) | compila o aplicativo (passo 4) | <https://nodejs.org/> |
| Git | baixa o projeto | <https://git-scm.com/download/win> |

Depois de instalar, **abra o Docker Desktop** e espere aparecer "Engine running". Abra um PowerShell **novo** (para
ele enxergar os programas recém-instalados) e confira:

```powershell
docker --version
node --version          # v22.12 ou mais novo
git --version
```

Se o PowerShell recusar o `npm` com "a execução de scripts foi desabilitada neste sistema", libere os scripts só para
o seu usuário (uma vez) e abra outro PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 2. Baixar o projeto

```powershell
cd $HOME\Documents
git clone https://github.com/rafaelkouhei/RibasRig.git
cd RibasRig
```

Sem Git: no GitHub, **Code › Download ZIP**, extraia e abra o PowerShell dentro da pasta extraída.

### 3. Ligar o servidor com os dados de demonstração

```powershell
cd ribasrig-backend
Copy-Item .env.example .env
docker run --rm python:3.13-slim python -c "import secrets; print(secrets.token_urlsafe(50))"
notepad .env
```

O `docker run` mostra uma chave aleatória: copie-a. No Bloco de Notas, preencha estas linhas e salve:

```ini
POSTGRES_PASSWORD=uma-senha-qualquer-para-o-banco
DJANGO_SECRET_KEY=<a chave mostrada pelo docker run>
RIBASRIG_HOJE=2026-10-07
RIBASRIG_SENHA_TESTE=<a senha que você vai usar para entrar no sistema>
```

O `RIBASRIG_HOJE=2026-10-07` faz o sistema usar 07/10/2026 como "hoje", a data do cenário de demonstração (com a data
real, os laudos e as inspeções do exemplo aparecem todos vencidos). Depois, suba o servidor e carregue o exemplo:

```powershell
docker compose up -d --build
docker compose exec api python manage.py carregar_exemplo
cd ..
```

O primeiro `up --build` leva alguns minutos (baixa as imagens e monta a do servidor). Se o `carregar_exemplo` disser
que a API não está pronta, espere alguns segundos e repita. Para conferir: <http://127.0.0.1:8000/api/sistema/> no
navegador deve mostrar `{"hoje": "2026-10-07", ...}`.

### 4. Gerar o instalador do aplicativo

```powershell
cd ribasrig-frontend
npm ci
cd ..\ribasrig-desktop
npm ci
npm run dist:win
cd ..
```

O `dist:win` compila as telas, baixa o Electron (cerca de 100 MB, só na primeira vez) e gera o instalador em
**`ribasrig-desktop\release\RibasRig Setup 1.0.0.exe`**.

**Se a compilação falhar**, baixe o instalador pronto em
[Releases › RibasRig v1.0.0](https://github.com/rafaelkouhei/RibasRig/releases/latest) (`RibasRig-Setup-1.0.0.exe`).
Ele é gerado pelo GitHub Actions num Windows, a partir deste mesmo código
([`.github/workflows/release.yml`](.github/workflows/release.yml)). O servidor (passo 3) continua necessário.

### 5. Instalar e entrar

1. Execute o instalador. Ele não tem assinatura de código, então o Windows SmartScreen avisa: clique em
   **Mais informações › Executar assim mesmo**. O instalador cria o atalho **RibasRig** na área de trabalho e no menu
   Iniciar.
2. Abra o RibasRig e entre com o usuário **`giuliano.breda`** (Administrador) ou **`rigger.campo`** (Operação), com a
   senha que você pôs em `RIBASRIG_SENHA_TESTE`.
3. Para salvar os PDFs no computador: **Configurações › Pasta dos planos › Escolher pasta**.

O [guia do usuário](GUIA_DO_USUARIO.md) mostra o sistema tela por tela; o plano **2607036** é o caso real de
referência, já emitido.

### 6. Opcional: o aplicativo liga o servidor sozinho

O servidor volta sozinho quando o Docker Desktop abre (por exemplo, depois de reiniciar o computador). Para o
aplicativo também tentar `docker compose up -d` quando encontrar o servidor desligado, rode na pasta `RibasRig`:

```powershell
node -e "const p=require('path'),f=require('fs');const d=p.join(process.env.APPDATA,'RibasRig');f.mkdirSync(d,{recursive:true});f.writeFileSync(p.join(d,'configuracao.json'),JSON.stringify({api:'http://127.0.0.1:8000',backend:p.resolve('ribasrig-backend')}))"
```

Isso grava `%APPDATA%\RibasRig\configuracao.json` com o endereço da API e a pasta do servidor
([docs/desktop.md](docs/desktop.md#instalar-no-computador-da-empresa)). O Docker Desktop precisa estar aberto.

### Problemas comuns

| sintoma | o que fazer |
|---|---|
| "O servidor do RibasRig está fora do ar" | abra o Docker Desktop; em `RibasRig\ribasrig-backend`, rode `docker compose up -d` |
| `npm` recusado ("execução de scripts foi desabilitada") | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e abra outro PowerShell (passo 1) |
| `docker` não reconhecido, ou erro de conexão com o Docker | o Docker Desktop não está aberto, ou o PowerShell foi aberto antes de instalá-lo |
| login recusado | a senha é a de `RIBASRIG_SENHA_TESTE` **no momento do `carregar_exemplo`**; para trocar: `docker compose exec api python manage.py changepassword giuliano.breda` |
| porta 5432 ou 8000 ocupada | outro PostgreSQL ou servidor usa a porta; desligue-o ([docs/backend.md](docs/backend.md#problemas-comuns)) |
| `Hash Sum mismatch` no `docker compose up --build` | o espelho do Debian estava sincronizando; espere alguns minutos e repita |

### Publicar uma nova versão do instalador (equipe)

Altere `"version"` em `ribasrig-desktop/package.json`, faça o commit e envie uma tag com o mesmo número:

```bash
git tag v1.0.1
git push origin v1.0.1
```

O workflow [`release.yml`](.github/workflows/release.yml) roda os testes, gera o instalador num Windows e o publica
na Release da tag, com o SHA-256. Para só testar o build, sem publicar: aba **Actions › Instalador do Windows › Run
workflow** (o `.exe` fica nos Artifacts da execução).

## Testes

| projeto | comando | o que cobre | quantidade |
|---|---|---|---|
| `ribasrig-backend` | `.venv/bin/pytest` | motor de cálculo, API, permissões, documentos, limite de login, limite da taxa | 140 |
| `ribasrig-frontend` | `npm run typecheck && npm test` | regras em TypeScript, cliente HTTP, lógica das telas | 240 |
| ponta a ponta | no `ribasrig-frontend`, com o servidor no ar ([docs/frontend.md](docs/frontend.md#como-rodar)) | criar, anexar e emitir: o servidor recalcula o mesmo que a tela mostra | 5 |
| `ribasrig-desktop` | `npm test && npm run fumaca` | regras de caminho, protocolo e configuração; teste de fumaça do aplicativo | 12 + fumaça |

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
| `release.yml` | tag `v*` (ou à mão, em Actions) | testes, instalador do Windows num Windows do GitHub e publicação na Release |

## Limitações conhecidas

- [docs/backend.md](docs/backend.md#ainda-falta): assinatura digitalizada desenhada no PDF, ART do laudo do guindaste
  como arquivo separado, implantação num servidor dedicado (VPS: passo a passo
  pronto, ainda não testado).
- [docs/desktop.md](docs/desktop.md#ainda-falta): instalador sem assinatura de código e ainda não testado num
  computador Windows.
