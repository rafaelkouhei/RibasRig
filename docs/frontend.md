# RibasRig · Front-end (`ribasrig-frontend/`)

Sistema de geração de Planos de Rigging da Guindastes Ribas Ltda.
Jornada de Aprendizagem · 6º semestre de Engenharia de Software · UniSENAI PR.

**Stack (a mesma do artigo):** React 19 + **TypeScript** (modo `strict`, sem `any`) + **Material UI 9**,
com Vite, React Router 7 (`HashRouter`, compatível com Electron) e Vitest. Sistema só para computador
(web local empacotada em Electron).

Os dados vêm do servidor (`ribasrig-backend`, Django REST) ou, para demonstração e testes, de um mock em
memória (`src/data/mock.ts`). A escolha é feita no build pela variável `VITE_API` (veja "Mock e servidor"); as telas
usam sempre as mesmas funções de `src/services/api.ts`.

- [docs/dominio.md](dominio.md): referência das funções de regra de negócio, para quem escreve telas.
- [docs/especificacao-front-end-2026-10.md](especificacao-front-end-2026-10.md): especificação das telas, regras, rotas e permissões escrita
  em 08/10/2026, antes do back-end (documento histórico, com nota de atualização).
- Visão geral do sistema: [README](../README.md), [guia do usuário](../GUIA_DO_USUARIO.md) e [arquitetura](../ARQUITETURA.md).

Os comandos abaixo rodam dentro da pasta `ribasrig-frontend/`.

---

## Contrato com o back-end

O servidor recalcula tudo com uma cópia das regras daqui. Estes arquivos são o contrato; mudou aqui, muda lá:

| arquivo | espelho no `ribasrig-backend` |
|---|---|
| `src/domain/types.ts` | models e JSON (em `snake_case`) |
| `src/domain/` (cálculos, plano, regras, validação, numeração) | `motor/` (em `Decimal`) |
| `src/domain/plano.test.ts` | casos de aceitação do 2607036 em `tests/test_motor_*` |
| `src/auth/permissoes.ts` | `contas/permissoes.py` |
| `src/services/api.ts` (endpoint no comentário de cada função) | endpoints de [docs/backend.md](backend.md#endpoints) |

Na camada de API (`api.ts`): a conversão `camelCase ⇄ snake_case` fica só em `paraApi`/`daApi`; erro vira `ErroApi`
com o status HTTP e a mensagem `detail` do servidor, que as telas mostram. Endpoints, códigos de erro, usuários de
teste e o que o servidor garante: [docs/backend.md](backend.md).

---

## Como rodar

Pré-requisito: Node.js 22.12 ou mais novo (o Vitest 5 não roda no Node 20).

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # domínio, API mock, cliente HTTP, gráfico e lógica das telas
npm run typecheck  # checagem de tipos
npm run build      # gera dist/
```

Login de demonstração (qualquer senha preenchida no mock):

| usuário | perfil |
|---|---|
| `giuliano.breda` | Administrador (inclui tudo do Engenheiro) |
| `rigger.campo` | Operação (só consulta) |

Com o servidor, o login é de verdade: usuários e senha de teste vêm do servidor ([docs/backend.md](backend.md#como-rodar-servidor-local)).

**Teste de ponta a ponta** (`src/services/servidor.e2e.test.ts`): usa a mesma `api.ts` e o mesmo motor das telas
contra o servidor real e compara os resultados. Pula sozinho sem as variáveis. Ele cria e emite planos: rode contra um
banco de teste, não contra o da empresa.

```bash
RIBASRIG_E2E_URL=http://127.0.0.1:8000 RIBASRIG_E2E_SENHA=<senha de teste> npx vitest run src/services/servidor.e2e.test.ts
```

## Cenário de exemplo (mock)

"Hoje" no sistema é **07/10/2026** (`HOJE` em `src/domain/formatacao.ts`).

| nº | situação | o que mostra |
|---|---|---|
| 2607036 | Emitido · Rev. 2 | Rev. 1 emitida no Excel (24/07/2026, capacidade 7.948 kg, errada) e Rev. 2 recalculada pelo sistema (9.260 kg; taxas 40,46%, 58,36%, 68,09%; sapatas 7.940,68 kgf; RMET 3,18) |
| 2610001 | Rascunho, etapa 4 | Cópia do 2607036 para operação em 15/10/2026, bloqueada porque o laudo do MD 45.007 venceu em 06/10/2026 |
| 2610002 | Rascunho (exemplo) | Bloqueado por taxa acima de 85% |

## Estrutura

```
src/
├── domain/              Regras de negócio puras, sem React (explicadas em docs/dominio.md)
│   ├── types.ts             Modelo de dados (espelha os models do Django)
│   ├── formatacao.ts        lerNum (leitura pt-BR estrita), fmt (2 casas), datas, CNPJ (inclusive alfanumérico)
│   ├── validacao.ts         Faixas válidas de cada campo e validarCampo
│   ├── calculos.ts          Gráfico de carga (interpolação + referência conservadora), trações por posição,
│   │                        sapatas, RMET, níveis de atenção e limite (75% / 85% no padrão), situação de laudo e de inspeção
│   ├── plano.ts             calcularPlano (formulário → resultados, checklist, podeEmitir), rascunho local
│   ├── numeracao.ts         AAMM + 3 dígitos pela data de criação, zera todo mês
│   ├── regras.ts            Avaliador de fórmulas seguro (sem eval), catálogo de regras e tipos de içamento
│   ├── art.ts               Campos para preencher a ART no portal do CREA-PR
│   └── *.test.ts
├── data/mock.ts         Cenário de exemplo acima
├── services/api.ts      Camada de acesso (mock ou Django, por VITE_API), com o endpoint de cada função e a conversão de nomes
├── services/arquivos.ts Arquivos no computador: pasta do plano pelo aplicativo (window.ribasrig) ou download no navegador
├── auth/                Sessão, permissoes.ts (matriz única por perfil) e proteção de rotas
├── components/          Menu lateral, atalhos de teclado, cabeçalhos (Cabecalho, BarraPlano), Dica (ícone "i"
│                        com explicação), GraficoCapacidade (gráfico de carga), notificações, ícones próprios
│                        e o esquema do içamento
├── usePlanoCalculado.ts Carrega um plano e os cadastros e calcula
└── pages/
    ├── Login.tsx, RedefinirSenha.tsx       Entra com usuário; senha provisória dada pelo administrador
    ├── Inicio.tsx                          Painel, atenção, frota, planos recentes, recuperação de rascunho
    ├── NovoPlano/                          Formulário em 6 etapas, resumo, dados da ART, emissão e somente leitura
    ├── Lote.tsx                            Vários planos iguais com números em sequência
    ├── Visualizacao.tsx + visualizacao/    Documento do plano, seletor de revisão, histórico resumido
    ├── GerarPdf.tsx, Memorial.tsx, Historico.tsx
    ├── ConsultaRapida.tsx                  Capacidade da frota (quais guindastes atendem a carga)
    ├── Guindastes.tsx, Acessorios.tsx, Clientes.tsx + cadastros/
    ├── Calculos.tsx + calculos/            Abas Regras de cálculo e Tipos de içamento
    └── Usuarios.tsx, Configuracoes.tsx
```

Rotas, perfis e o que cada tela faz: seções 7 a 9 da [especificação](especificacao-front-end-2026-10.md).

## Padrões de interface

- Identidade visual da Guindastes Ribas: fonte Exo 2, marinho `#34446A`, cantos de 3 px (seção 5 do guia).
- Explicações (para que serve a tela, a etapa, a seção) ficam no ícone "i" ao lado do título (`components/Dica.tsx`);
  erros, alertas e valores calculados ficam sempre visíveis.
- Cadastros com lista + cartão não rolam a página: cada parte rola por dentro (`AreaRolavel` em `pages/cadastros/ui.tsx`).
- Gráfico de carga (capacidade × alcance) num componente só, `components/GraficoCapacidade.tsx`, usado no cadastro de
  guindastes e na etapa Guindaste do plano (lá com o ponto do raio em destaque): eixos em números redondos, área suave,
  dica ao passar o mouse em cada extensão.
- Barras de taxa de utilização (guindaste, cinta, manilha) com a marca do limite (Configurações; 85% no padrão), no Início, no formulário, no
  resumo e na consulta rápida.
- Erro de campo em laranja (nunca vermelho), situação sempre com texto (nunca só cor), foco visível e navegação por teclado.

## Mock e servidor

No **mock** (padrão) continua simulado: login (qualquer senha), gravação em memória, PDF, anexos, laudo,
certificado, carimbo e pastas; essas ações mostram uma notificação dizendo o que fariam.

Com **`VITE_API=http`** tudo é real: login JWT, dados no PostgreSQL, upload dos anexos, do laudo, do certificado,
da logo e da assinatura, PDF do plano e memorial gerados pelo servidor na emissão, planilha do carimbo e o "hoje"
do servidor e o limite da taxa (`definirHoje` e `definirLimite`, em `main.tsx`; o limite também é atualizado quando
o Administrador salva as Configurações). O token de acesso fica só em memória e o refresh no `sessionStorage`; um
401 renova o token uma vez e repete a chamada.

```bash
VITE_API=http npm run dev        # telas falando com o Django em 127.0.0.1:8000 (proxy /api do Vite)
VITE_API=http npm run build      # build sem o mock e sem os dados de exemplo (o ribasrig-desktop faz este build)
```

No aplicativo (`ribasrig-desktop`) os arquivos gerados vão para a pasta do cliente (`services/arquivos.ts` + ponte
`window.ribasrig`, cuja interface é `PonteDesktop`, espelhada no `preload.ts` do desktop); no navegador, são baixados.

## CI

`.github/workflows/frontend.yml` (na raiz) roda checagem de tipos, testes, build e `npm audit` (dependências do app) quando o
front muda. O `desktop.yml` também roda nessa hora, porque o aplicativo empacota o front.
