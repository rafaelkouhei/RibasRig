# Sistema RibasRig — Guia do front-end

**Projeto:** Sistema Integrado para Geração Automatizada de Planos de Rigging (Guindastes Ribas Ltda.)
**Jornada de Aprendizagem · 6º semestre · Engenharia de Software · UniSENAI PR**
**Parte:** protótipo de telas e front-end
**Atualizado em:** 08/10/2026

> **Atualização (novembro/2026):** este guia descreve o front-end como entregue em 08/10/2026, ainda com o mock.
> Depois disso o back-end (`ribasrig-backend`) e o aplicativo Electron (`ribasrig-desktop`) foram feitos e ligados ao
> front: o que as seções 11 e 15 tratavam como "previsto" ou "simulado" agora é real no modo `VITE_API=http` (sempre
> usado pelo aplicativo). Visão atual do sistema: [README](../README.md), [guia do usuário](../GUIA_DO_USUARIO.md) e
> [arquitetura](../ARQUITETURA.md); contrato da API (endpoints, erros, garantias): [docs/backend.md](backend.md). Números,
> contagens e caminhos de arquivo abaixo são os de 08/10/2026 (ex.: a CI hoje fica em `.github/workflows/` na raiz e o `DOMINIO.md` virou [docs/dominio.md](dominio.md)).

Este guia reúne tudo o que é preciso para desenvolver o front-end do RibasRig: ferramentas, organização do código, identidade visual, regras de negócio aplicadas na tela, todas as funcionalidades de cada tela, rotas, permissões, integração com o back-end, testes e o que significa "pronto". A referência visual é o protótipo **"RibasRig — Telas"** (19 telas, versão corrigida depois da auditoria de 07/10/2026). O código de referência é o projeto `ribasrig-frontend`.

---

## Sumário

1. [O que o front-end precisa entregar](#1-o-que-o-front-end-precisa-entregar)
2. [Ferramentas](#2-ferramentas)
3. [Preparar o ambiente](#3-preparar-o-ambiente)
4. [Arquitetura do front-end](#4-arquitetura-do-front-end)
5. [Identidade visual e componentes padrão](#5-identidade-visual-e-componentes-padrão)
6. [Regras de negócio que a tela aplica](#6-regras-de-negócio-que-a-tela-aplica)
7. [Funcionalidades de cada tela](#7-funcionalidades-de-cada-tela)
8. [Rotas](#8-rotas)
9. [Perfis e permissões](#9-perfis-e-permissões)
10. [Modelo de dados usado pelo front](#10-modelo-de-dados-usado-pelo-front)
11. [Integração com o back-end (Django REST)](#11-integração-com-o-back-end-django-rest)
12. [Qualidade: estados de tela, acessibilidade e formatação](#12-qualidade-estados-de-tela-acessibilidade-e-formatação)
13. [Testes e integração contínua](#13-testes-e-integração-contínua)
14. [Dados de exemplo para demonstração](#14-dados-de-exemplo-para-demonstração)
15. [O que ainda é simulado](#15-o-que-ainda-é-simulado)
16. [Checklist de pronto](#16-checklist-de-pronto)

---

## 1. O que o front-end precisa entregar

O engenheiro da Ribas hoje monta cada Plano de Rigging à mão, juntando Excel (ficha de dados e cálculos), SolidWorks (desenhos), Word (procedimento e laudo) e as ARTs do portal do CREA-PR, e redigita os mesmos dados em 3 ou 4 arquivos. O front-end é a parte do sistema que o engenheiro usa para:

- cadastrar os dados da operação **uma vez**, num formulário guiado;
- ver os cálculos **na hora**, com o limite de segurança de 85% e o bloqueio quando algo não fecha;
- anexar desenhos e ARTs e emitir um **PDF único** na ordem certa;
- manter os cadastros que alimentam os cálculos (guindastes, acessórios, clientes, regras de cálculo);
- consultar planos, revisões, histórico e memorial de cálculo interno.

Premissas do cliente que afetam o front:

| Premissa | Consequência na tela |
|---|---|
| Uso só pela equipe interna, sistema "web rodando localmente" | Navegador no PC da empresa; não há cadastro público nem e-mail |
| Sem fluxo de aprovação; emissão direta | Botão "Emitir" no fim do formulário, sem etapa de aprovação |
| ART preenchida à mão no portal do CREA | O sistema só organiza os dados para copiar (janela "Dados para a ART") |
| Capacidade por interpolação da tabela do fabricante | Cálculo automático no formulário e na consulta rápida |
| Nada se arredonda antes do cálculo; apresentação com 2 casas | Campos guardam o texto digitado; formatação só na exibição |
| Numeração automática AAMM + 3 dígitos, zera todo mês | Número gerado pelo sistema, nunca digitado |
| Supervisor responsável = o próprio engenheiro | Assinatura dupla com o mesmo nome (Rigger e Supervisor) |
| Acessórios com histórico e alerta de inspeção | Cadastro de acessórios com situação e aviso 30 dias antes |
| Troca de acessório sem regra fixa: o engenheiro informa os dados e o sistema avisa (resposta 25, 08/10/2026) | Data de entrada, certificado, tempo de uso, **vencimento** (aviso 30 dias antes, bloqueio depois), **motivo do descarte** e **padrão de inspeção por tipo** |
| Memorial de cálculo não vai para o cliente | Tela de memorial separada, só para Administrador e Engenheiro |

---

## 2. Ferramentas

### 2.1 Usadas no projeto

| Categoria | Ferramenta | Versão | Para que serve |
|---|---|---|---|
| Linguagem | **TypeScript** | 5.9 (modo `strict`) | Tipagem de todo o código; evita erro de unidade e de campo |
| Biblioteca de interface | **React** | 19 | Componentes e estado das telas |
| Componentes visuais | **Material UI (MUI)** | 9 | Campos, tabelas, diálogos, abas, botões, notificações |
| Ícones | **@mui/icons-material** | 9 | Ícones de ação (buscar, PDF, copiar…), importados um a um |
| Ícones próprios | SVG | — | Ícones do menu, da Frota e da aba do navegador, feitos para o sistema (`components/Icone.tsx`, arquivos em `src/assets/icones/`) |
| Estilo | **Emotion** (`@emotion/react`, `@emotion/styled`) | 11 | Motor de estilo do MUI (`sx` e tema) |
| Fonte | **@fontsource/exo-2** | 5 | Fonte Exo 2 da identidade visual, empacotada (funciona sem internet) |
| Rotas | **React Router** (`react-router-dom`) | 7 | Navegação entre telas com `HashRouter` (funciona servido localmente) |
| Build e servidor de desenvolvimento | **Vite** + `@vitejs/plugin-react` | 8 | Sobe a aplicação em segundos, gera a versão de produção, faz proxy de `/api` para o Django |
| Testes | **Vitest** | 5 | Testes do motor de cálculo, da API simulada e da lógica das telas |
| Testes de tela | **Playwright** (Chromium) | — | Capturas e testes de ponta a ponta das telas rodando |
| Runtime | **Node.js** | 20.19 ou mais novo (testado no 22) | Rodar Vite, testes e build |
| Gerenciador de pacotes | **npm** (`package-lock.json`) | — | `npm ci` instala exatamente as mesmas versões em qualquer máquina |
| Versionamento | **Git + GitHub** | — | Código, revisões e histórico da equipe |
| Integração contínua | **GitHub Actions** (`.github/workflows/ci.yml`) | — | Roda checagem de tipos, testes e build a cada push e pull request |
| Protótipo | Protótipo de telas "RibasRig — Telas" e **Figma** (login do Victor) | — | Referência visual e de comportamento de cada tela |
| Gestão | **Trello** (quadro "Jornada de Aprendizagem – 6º Semestre") | — | Cards de protótipo, segurança/auditoria e módulo de documentação |

### 2.2 Recomendadas para completar o projeto

| Ferramenta | Por quê |
|---|---|
| **ESLint** (com `typescript-eslint` e `eslint-plugin-react-hooks`) | Pegar erros de hooks e código morto; hoje há comentários `eslint-disable` sem o ESLint instalado |
| **Prettier** | Mesmo formato de código para os 5 integrantes |
| **@testing-library/react** + `jsdom` | Testar componentes (cliques, campos, mensagens) além da lógica pura |
| **Zod** | Validar a resposta do Django antes de usar (o `DecimalField` chega como texto) |
| **TanStack Query** (opcional) | Cache, recarregar e estados de carregamento/erro das chamadas à API, quando o back-end estiver ligado |
| **VS Code** com as extensões ESLint, Prettier, Vitest e "Error Lens" | Ambiente igual para todos |

### 2.3 Back-end com que o front conversa (de outra parte da equipe)

Python + Django REST Framework, PostgreSQL e Docker. O front não depende disso para rodar: enquanto o back-end não está pronto, tudo funciona com uma API simulada em memória (seção 11).

---

## 3. Preparar o ambiente

```bash
# 1. Node 20.19+ instalado (node -v)
# 2. Dentro da pasta do projeto:
npm ci              # instala as dependências exatas
npm run dev         # abre em http://localhost:5173
npm test            # roda os testes (219 em 08/10/2026)
npm run typecheck   # checagem de tipos
npm run build       # versão de produção em dist/
```

Login de demonstração (qualquer senha preenchida no mock): `giuliano.breda` (Administrador) ou `rigger.campo` (Operação). O login é só por usuário, sem e-mail.

> **Importante para o back-end:** ao ligar o Django, esses dois usuários precisam existir no servidor com exatamente este login, senão a tela de login recusa e não dá para testar o front. Detalhes na seção 11.

Quando o Django estiver rodando em `http://localhost:8000`, o Vite já redireciona as chamadas `/api` para ele (`vite.config.ts`).

---

## 4. Arquitetura do front-end

### 4.1 Camadas

```
┌────────────────────────────────────────────────────────────┐
│  Telas (src/pages)  ·  React + MUI                         │
│  mostram dados, recebem o que o usuário digita             │
└───────────────┬───────────────────────────┬────────────────┘
                │ chamam                    │ calculam com
┌───────────────▼──────────────┐ ┌──────────▼─────────────────┐
│  API (src/services/api.ts)   │ │  Domínio (src/domain)      │
│  hoje: mock em memória       │ │  regras puras, sem React:  │
│  amanhã: Django REST (/api)  │ │  cálculos, validação,      │
│  converte camelCase ⇄ snake  │ │  numeração, regras, ART    │
└───────────────┬──────────────┘ └────────────────────────────┘
                │ dados de exemplo
┌───────────────▼──────────────┐
│  src/data/mock.ts            │
└──────────────────────────────┘
```

Regra de ouro: **nenhuma tela faz conta sozinha**. Toda regra de negócio fica em `src/domain` (testada) e as telas só chamam essas funções. O mesmo motor deve existir no back-end (em `Decimal`) para validar antes de emitir.

### 4.2 Pastas

```
src/
├── domain/                 Regras de negócio puras (documentadas em domain/DOMINIO.md)
│   ├── formatacao.ts           lerNum, lidoComo, fmt, datas pt-BR, HOJE, CNPJ (inclusive alfanumérico)
│   ├── validacao.ts            FAIXAS de cada campo e validarCampo
│   ├── calculos.ts             gráfico de carga, trações, sapatas, RMET, níveis, laudo, inspeção e validade
│   ├── inspecao.ts             padrões de inspeção por tipo de acessório e registro de inspeção
│   ├── plano.ts                calcularPlano, formDoPlano/planoDoForm, rascunho local, nome do arquivo
│   ├── numeracao.ts            proximoNumero, numerosParaLote
│   ├── regras.ts               avaliador de fórmulas seguro, catálogo de regras, tipos de içamento
│   ├── art.ts                  campos e texto para a ART
│   ├── types.ts                modelo de dados
│   └── *.test.ts
├── data/mock.ts            Cenário de exemplo
├── services/api.ts         Única porta de entrada de dados
├── auth/                   Sessão (AuthContext), permissoes.ts, RequireAuth
├── components/             AppLayout (menu), Atalhos, Cabecalho (BotaoVoltar, Cabecalho, BarraPlano),
│                           CartaoAcesso, EsquemaIcamento, Icone (ícones próprios), Notificacao
├── hooks.ts                useCarregar (dados + carregando + erro + recarregar)
├── usePlanoCalculado.ts    Carrega plano + cadastros e calcula
├── theme.ts                Tema do MUI (cores, fonte, botões, campos)
├── App.tsx                 Rotas, com carregamento sob demanda (React.lazy)
└── pages/                  Uma tela por arquivo/pasta (seção 7)
```

### 4.3 Decisões técnicas

| Decisão | Motivo |
|---|---|
| `HashRouter` | Funciona servido de uma pasta local ou por qualquer servidor, sem configurar rotas no servidor |
| Campos numéricos guardam **texto** | Permite mostrar "lido como…" e não arredondar nada antes do cálculo |
| `HOJE` fixo no domínio (2026-10-07) para a demonstração | As regras de laudo e inspeção ficam reproduzíveis; no sistema real vem do servidor |
| `React.lazy` por rota | O código que abre primeiro caiu de 771 kB para 322 kB |
| Toda chamada passa por `api.ts` | Trocar o mock pelo Django sem mexer nas telas |
| Permissões num mapa único (`permissoes.ts`) | A mesma lista protege rotas, esconde botões e desenha a matriz da tela Usuários |

---

## 5. Identidade visual e componentes padrão

Baseada na tela de login feita no Figma por Victor Hugo.

| Token | Valor | Uso |
|---|---|---|
| Fonte | Exo 2 (300 a 700) | Todo o sistema |
| Marinho | `#34446A` | Títulos, menu, cabeçalho de cartões |
| Azul | `#4A6192` | Destaques, barras "dentro do limite", item ativo do menu |
| Botão principal | `#3F4D6E` | Ações principais (altura 44 px) |
| Claro | `#BCC6DA` | Detalhes sobre fundo escuro |
| Fundo | `#ECEEF2` | Fundo das páginas |
| Borda | `#D5DAE3` (cartões) · `#8F9AB0` (campos) | Contornos |
| Alerta | `#C2610C` (barra/borda) · `#FBE1C6` (fundo) · `#8A3F04` (texto) | Atenção e bloqueio |
| Erro de campo | `#9A4A08` | Mensagem e borda de campo inválido (contraste 6:1) |
| Texto | `#1F2A40` · secundário `#5A6478` | Leitura |
| Raio | 3 px | Cantos |

Componentes padrão (não criar variações):

- **`BotaoVoltar`**: igual em todas as telas secundárias.
- **`Cabecalho`**: cadastros e administração, com sobretítulo (ex.: "CADASTROS"), título dentro da página, Voltar à esquerda e ação principal à direita. A descrição da tela não aparece como texto: vira o ícone "i" ao lado do título.
- **`Dica`** (ícone "i"): toda frase que só explica algo (para que serve a tela, a etapa, a seção ou o cartão; notas de rodapé) fica no ícone ao lado do título e aparece ao passar o mouse ou ao focar com Tab. Já está ligada em `Cabecalho`, `TituloEtapa`, `Secao`, `TituloGrupo` (`dica`), `Cartao` (`dica`) e `TituloSecao` (`dica`). Continuam visíveis: erro, alerta, valor calculado, dica dentro do campo (faixa, formato, "lido como") e lista vazia. Com `texto`, mostra um rótulo curto ao lado do ícone (ex.: "Resultado indicativo").
- **`GraficoCapacidade`**: o gráfico de carga (capacidade × alcance), um componente só para o cadastro de guindastes e a etapa Guindaste (com o ponto do raio em destaque). Uma série, sem legenda; linha de 2 px com área suave; grade discreta com marcas em números redondos; dica ao passar o mouse.
- **`AreaRolavel`**: cadastro com lista + cartão (Clientes, Guindastes, Acessórios, Cálculos) não rola a página; cada parte rola por dentro, com sombra no corte e o aviso "Role para ver mais".
- **`BarraPlano`**: telas do plano, com barra branca no topo, Voltar, caminho ("Planos de Rigging / nº …"), título, selo (Rascunho / Emitido · Rev. N) e ações.
- **Campos com legenda na borda** (estilo do login), mensagem de erro no próprio campo e "lido como…" embaixo quando houver ponto.
- **Selos de situação sempre com texto**, nunca só cor: Dentro do limite / Atenção / Bloqueado; Rascunho / Emitido; Laudo vencido / em dia.
- **Diálogo de confirmação** para qualquer ação que apaga ou desativa.
- **Notificação** (canto inferior direito, `aria-live`) para o resultado de cada ação.

---

## 6. Regras de negócio que a tela aplica

Valores de referência: plano 2607036, Rev. 2 (recalculada pelo sistema).

### 6.1 Leitura e apresentação de números

- `lerNum` aceita `3450`, `3.450`, `3.450,5`, `5,0` e `4.2` (um ponto sem grupo de 3 dígitos = decimal). Vazio, negativo ou inválido = inválido.
- Quando o texto tem ponto, o campo mostra **"lido como …"** para o usuário conferir.
- Apresentação sempre com `fmt`: separador de milhar e **2 casas** em tudo que é calculado (9,26 t; 3.746,62 kg; 7.940,68 kgf; 40,46%; 3,18 kgf/cm²).
- **Nada é arredondado antes do cálculo.**
- Massa em **kg**, força em **kgf**; carga bruta = símbolo **Pb**.

### 6.2 Faixas válidas (fora da faixa = erro no campo e plano bloqueado)

| Campo | Faixa |
|---|---|
| Peso da carga | 1 a 100.000 kg |
| Dimensões da carga | 0,1 a 50 m |
| Quantidade de acessórios | inteiro de 1 a 50 |
| Capacidade de acessório | 0,1 a 100 t |
| Ângulo das pernas (a partir da **vertical**) | 0° a 60° (vazio não vale como 0°) |
| Raio de operação | 0,5 a 30 m |
| Vento máximo | 0 a 20 m/s |
| Distâncias a e b das sapatas | 0,5 a 15 m |
| Peso do guindaste (Pg) | 500 a 100.000 kgf |
| Dormente | 10 a 200 cm |
| Cargas extras | 0 ou mais |

### 6.3 Cálculos

| Grandeza | Regra | 2607036 Rev. 2 |
|---|---|---|
| Carga bruta (Pb) | carga + lingada + dispositivos/balancim + cargas extras | 3.746,62 kg |
| Capacidade no raio | interpolação linear no gráfico de carga: C = C1 + (r − r1)(C2 − C1)/(r2 − r1) | 9.260,00 kg |
| Referência conservadora | capacidade da extensão que alcança o raio (primeiro ponto com alcance ≥ raio) | 7.300 kg (51,32%) |
| Taxa do guindaste | Pb ÷ capacidade | 40,46% |
| Cinta das pernas inferiores | Te = P ÷ (2 cos α) | 1,95 t → 46,52% |
| Cinta das pernas superiores | Te = (P + balancim) ÷ (2 cos α) | 2,45 t → 58,36% |
| Manilha na carga | P ÷ (4 cos α) | 0,98 tf → 17,76% |
| Manilha no gancho | 2 × Te superior | 4,90 tf → 68,09% |
| Esforço nas sapatas | ES = Pg/2 + Pb·R/(a + b) | 7.940,68 kgf |
| RMET | ES ÷ (largura × comprimento × nº de dormentes) | 3,18 kgf/cm² |

- P = carga + cargas extras (premissa da equipe, lado seguro).
- Cada item da lingada tem uma **posição** (pernas inferiores, pernas superiores, carga, gancho); a taxa de cada posição usa a **menor capacidade** dos itens daquela posição, vinda do cadastro.
- Tipos sem balancim usam ângulo único e não somam o balancim.
- Raio **fora do gráfico** (abaixo do primeiro ou acima do último alcance) **bloqueia**.
- Gráfico de carga do MD 45.007 (guindaste articulado; cada ponto é o alcance máximo de uma extensão): 4,18 m/10.900 kg · 5,98/7.300 · 7,83/5.200 · 9,68/3.900 · 11,53/3.300 · 13,46/1.900 · 15,46/1.200 · 17,51/900.

### 6.4 Limites de segurança

- Até **74,99%**: Dentro do limite. De **75% a 85,00%**: Atenção (85,00% exato passa). **Acima de 85%**: Bloqueado.
- Resultado negativo, infinito ou inválido = Bloqueado (nunca "dentro do limite").
- O aviso de 75% é configurável (entre 50 e 85) em Configurações; o limite de 85% é fixo.

### 6.5 Laudo e inspeções

- O laudo do guindaste é conferido contra a **data da operação**. Sem laudo, sem data ou laudo vencido = reprova e bloqueia a emissão.
- Na tela, a situação do laudo usa a data de hoje: vencido / vence em N dias (até 30) / em dia / não cadastrado.
- Acessórios: próxima inspeção **e vencimento (validade)** comparados com a data da operação; vale o que vence primeiro; aviso 30 dias antes; vencido, descartado ou inativo não pode ser escolhido.
- Não há regra fixa de troca por número de usos ou por meses (resposta do engenheiro em 08/10/2026: as NRs mudam). O engenheiro define o vencimento de cada item, e a inspeção pelo **padrão do tipo** aprova (fica em uso) ou reprova (descartado com motivo, ou em inspeção para reparo).

### 6.6 Numeração e revisões

- Número = **AAMM + 3 dígitos**, pela **data de criação**, zera todo mês, gerado pelo sistema no primeiro salvamento. Ex.: o primeiro plano de outubro/2026 é 2610001. Passar de 999 no mês = erro.
- Rascunho não tem número de revisão; a **primeira emissão é a Rev. 1**.
- **Plano emitido é imutável**: a revisão guarda uma cópia completa (entradas, itens com capacidade, gráfico usado, versão das regras, todos os resultados, arquivo PDF). Qualquer mudança = **nova revisão** (Rev. N+1, mesmo número). As revisões anteriores ficam guardadas.
- Nome do arquivo: `Plano_de_Rigging_{nº}_Rev{rev}.pdf`, em `<pasta raiz>\<cliente>\<nº>\Relatório\`.

### 6.7 Outras regras

- Raio de isolamento menor que o raio de operação = bloqueio.
- Guindastes adicionais: sem repetir modelo; soma dos percentuais até 100%; cada um com laudo e gráfico próprios.
- ART do plano: número de 13 dígitos; não pode repetir a ART de outro plano; o nome do PDF anexado tem que bater com o número informado.
- Ordem do PDF final: ficha de dados → desenhos → ART do plano → procedimento operacional → laudo e ART do guindaste.

---

## 7. Funcionalidades de cada tela

### 7.1 Login (`/login`)

- Cartão sobre a foto do guindaste (estilo do Figma do Victor): "Bem-vindo ao Sistema RibasRig" + logo Guindastes Ribas.
- Campos **Usuário** e **Senha**, botão para mostrar/ocultar senha, botão **Entrar**. O login é só por usuário (sem e-mail).
- Mensagem de erro vinda da API ("Usuário ou senha incorretos.", campos vazios).
- Link **"Esqueci a senha"** → Redefinir senha. Texto "Problemas para entrar? Fale com o administrador do sistema."
- Usuário com senha provisória é levado direto para criar a senha nova.

### 7.2 Redefinir senha (`/redefinir-senha`)

- Sem e-mail: o administrador entrega uma **senha provisória**.
- Etapa 1: usuário + senha provisória.
- Etapa 2: nova senha + confirmação, com regras visíveis (8 caracteres, letras e números, iguais, diferente da provisória).
- Etapa 3: "Senha criada" → ir para o login.
- Links "Voltar ao login" e "Trocar usuário".

### 7.3 Layout geral (todas as telas internas)

- **Marca no topo do menu**: logo da Ribas à esquerda, "RibasRig" em destaque e "GUINDASTES RIBAS" pequeno embaixo, num bloco só.
- **Menu lateral**: Início · Novo plano · Consulta rápida · CADASTROS: Guindastes, Clientes, Acessórios de lingada, Cálculos · ADMINISTRAÇÃO (só Administrador): Usuários e perfis, Configurações.
- Item ativo correto (ex.: "Novo plano" acende também em lote, editar, duplicar e revisão; "Cálculos" nas duas abas).
- Rodapé do menu: nome e perfil do usuário logado, botão **Sair**, link **Atalhos de teclado (Ctrl + /)**.
- Link "Pular para o conteúdo" e foco visível em todo elemento.
- **Atalhos de teclado**: Ctrl+/ abre a lista; Alt+N novo plano; "/" ou Ctrl+K buscar plano; Ctrl+Enter próxima etapa; Alt+← etapa anterior; Ctrl+S salvar rascunho; Ctrl+P visualizar PDF; Esc fecha janela. Sem Ctrl+N/T/W (o navegador não deixa capturar).
- Notificações e carregamento sob demanda das telas.

### 7.4 Início (`/`)

- Cabeçalho: sobretítulo "PAINEL", título "Planos de Rigging", campo **Buscar plano** e botão **+ Novo Plano de Rigging**.
- **Último plano emitido** (ex.: 2607036 · Rev. 2): esquema do içamento (ilustração própria com lança e raio do plano por cima), guindaste, Pb, capacidade no raio, RMET, barras de taxa (guindaste, cinta, manilha) com o limite de 85% marcado e a situação em texto, nota das revisões, botões **Abrir plano**, **Baixar PDF**, **Duplicar para nova operação**.
- **Precisa da sua atenção** (calculado dos dados): laudo vencido ou vencendo → "Atualizar laudo"; planos bloqueados com o motivo; inspeção ou validade de acessório vencendo; rascunhos incompletos agrupados.
- **Frota**: cada guindaste com a situação do laudo ou "Dados incompletos".
- **Planos recentes**: nº, contratante, carga, guindaste, data, situação (Rascunho / Emitido · Rev. N + motivo do bloqueio) e ações (**Continuar**, **Revisar cálculo**, **Abrir**, duplicar, baixar PDF).
- Abas com contagem (Todos, Rascunhos, Bloqueados, Emitidos), filtro de período (pela data de criação) e busca por número, razão social (com ou sem acento) ou carga.
- **Recuperação de rascunho**: se houver rascunho não salvo no navegador, abre uma janela com nº, contratante, carga, guindaste e "parou na etapa N às HH:MM", com **Continuar** ou **Descartar** (com confirmação).

### 7.5 Novo plano / editar rascunho (`/planos/novo`, `/planos/:numero/editar`, `/duplicar`, `/revisao`)

Formulário em **6 etapas**, com navegação clicável, marcador de pendência por etapa, rodapé "← Etapa anterior / Próximo →" e **resumo dos cálculos sempre visível** à direita (Pb, capacidade, taxas por posição, sapatas, RMET e situação).

Comum a todas as etapas:
- **BarraPlano** com Voltar, caminho, "Novo Plano de Rigging" ou "Plano nº …", selo e indicador **"Rascunho salvo automaticamente às HH:MM"** (salvamento real com espera de 0,8 s e nova tentativa em caso de erro).
- Número gerado no primeiro salvamento e mostrado só leitura ("Gerado pelo sistema: criado em …").
- `/editar` abre na etapa salva; `/duplicar` cria um novo número com os dados copiados (sem ART e anexos); `/revisao` abre o rascunho da Rev. N+1 do mesmo número.

**Etapa 1 · Dados gerais**
- Data da operação (obrigatória; aviso se for anterior a hoje).
- **Contratante** (do cadastro de clientes) × **Local da obra** (locais do cliente, mesmo endereço ou outro local), com uma nota curta explicando a diferença.
- Tipo de içamento, descrição da operação.
- Rigger e supervisor responsável (o engenheiro).
- Nº da ART do plano + botão **Dados para a ART** (janela com contratante, endereço da obra, datas, atividade, quantidade e observação, cada campo com botão copiar e "Copiar tudo").
- Link "Operação repetida? Criar vários planos iguais →" (Lote).

**Etapa 2 · Carga**
- Descrição, comprimento, largura, altura e peso, com validação e "lido como".

**Etapa 3 · Lingada**
- Tipo de içamento (balancim 4 pernas + 2 superiores; sem balancim 2 pernas; laço de cabo de aço).
- Itens do catálogo de acessórios: quantidade, **posição** e peso e capacidade vindos do cadastro (só leitura).
- Ângulos inferior e superior (ou ângulo único) "a partir da vertical".
- Balancim/dispositivos (só nos tipos com balancim) e cargas extras, com a nota da premissa.
- Tabela de tração por posição: fórmula, item que governa, tração, capacidade, taxa e situação.

**Etapa 4 · Guindaste**
- Guindaste principal e dados do cadastro (caminhão, placa, chassi, ano, capacidade nominal, laudo, ART do laudo).
- **Gráfico de carga** (lista das tabelas do guindaste; sem gráfico = bloqueio com link "Cadastrar gráfico") e comprimento da lança (informativo, sai na ficha).
- Raio de operação, quadrantes inicial e final, vento máximo (padrão das Configurações), raio de isolamento.
- Capacidade interpolada com a conta mostrada passo a passo, gráfico de carga com o **ponto do raio em destaque** ("Raio 5,00 m · 9.260 kg", com guias até os eixos), referência conservadora e barra da taxa.
- **Alerta de laudo vencido na data da operação**, com "Mudar data da operação", **"Anexar laudo renovado"** (validade final digitada + PDF; só desbloqueia se cobrir a data da operação) e "Atualizar no cadastro".
- Link **"+ Adicionar outro guindaste"**: tabela de adicionais (modelo, gráfico, raio, % da carga, carga, taxa, laudo) só quando usada.
- Sapatas: dormente (largura, comprimento, quantidade) e resultados (momento, força, ES, RMET).

**Etapa 5 · Anexos**
- Área de soltar arquivos (clique ou arraste os PDFs do SolidWorks e do CREA).
- Lista de anexos com origem e situação: desenhos, ART do plano (checagem do número e de ART já usada), laudo e ART do guindaste (vindos do cadastro, não removíveis).
- **Documentos auxiliares**: Dados para a ART e **Planilha do carimbo (.xlsx)** para o SolidWorks.
- Ordem das páginas do PDF final.

**Etapa 6 · Revisão**
- Checklist calculado de verdade, com "Ir para etapa" em cada item: campos com valores válidos; data da operação; laudo válido na data da operação; raio dentro do gráfico; guindaste(s) até 85%; acessórios até 85%; inspeções em dia na data da operação; anexos obrigatórios; ART; isolamento.
- Links para ver um plano emitido de exemplo e o memorial.
- Botão **Emitir** só com tudo aprovado.

**Depois de emitir**
- O plano vira **Emitido · Rev. N** e fica **somente leitura**: as etapas mostram um aviso "Plano emitido. Para mudar algo, crie uma nova revisão; a Rev. N fica guardada", com resumo.
- Faixa com o nome e o caminho do PDF salvo, links **Ver plano** e **Abrir PDF**; botão **Criar nova revisão**.

### 7.6 Planos em lote (`/planos/lote`)

- Para operações repetidas (ex.: 10 injetoras idênticas).
- Formulário único: contratante × local da obra, data da operação obrigatória, carga com validação, quantidade (1 a 50).
- Números automáticos em sequência a partir do próximo livre (ex.: 2610003 a 2610012), só leitura, sem invadir o mês seguinte.
- Campo de nº de série por plano (ex.: "INJ-001").
- **Criar N rascunhos** → diálogo com a faixa de números criada e link para o Início.

### 7.7 Visualização do plano (`/planos/:numero`)

- **BarraPlano**: selo "EMITIDO · REV. N" ou "RASCUNHO", "Somente leitura", chave **"Destacar dados preenchidos pelo sistema"** (realça em amarelo o que veio do sistema), botão **Abrir PDF da Rev. N** (ou "Continuar editando" no rascunho).
- Miniaturas das seções à esquerda: ficha de dados, desenhos, ART do plano, procedimento operacional, laudo e ART do guindaste.
- Página do documento ao centro, fiel ao modelo da Ribas:
  - cabeçalho com logo, cliente, local, data e nº do plano;
  - dados da carga; lingada/amarras com pesos; dispositivos/balancim;
  - informações do guindaste (modelo, caminhão, placa, chassi, ano);
  - configuração do guindaste (capacidade nominal, lança, raio, capacidade de carga, quadrantes);
  - composição da carga bruta;
  - resumo dos cálculos (carga bruta, capacidade, taxas do guindaste, cinta plana, cinta tubular, laço, manilha, sapatas, RMET, isolamento, vento);
  - ART, assinaturas Rigger e Supervisor responsável, rodapé com endereço, CEP, CNPJ e IE da Ribas;
  - procedimento operacional (isolamento, patolamento, posicionamento, içamento e descarga).
- **Seletor de revisão**: cada revisão mostra os valores gravados nela (a Rev. 1 do Excel aparece como no documento original), com a nota explicando a revisão.
- Lateral: plano bloqueado para edição, **Criar nova revisão**, **Duplicar para nova operação**, **Memorial de cálculo** (só Administrador e Engenheiro), revisões e histórico resumido com "Ver tudo".
- Rascunho: prévia com o cálculo atual, marcada "Prévia — rascunho".

### 7.8 PDF gerado (`/planos/:numero/pdf`)

- Confirmação do PDF salvo: título "Plano de Rigging nº … · Rev. N", nome do arquivo, caminho completo e árvore de pastas (cliente › nº › Relatório).
- Ordem das páginas do documento.
- **Abrir PDF** (volta à visualização) e **Abrir pasta** (notificação com o caminho).
- Rascunho: mensagem "ainda não tem PDF" com "Ver prévia" e "Continuar editando".

### 7.9 Memorial de cálculo interno (`/planos/:numero/memorial`)

- Só **Administrador e Engenheiro**; **não vai no PDF do cliente**.
- Documento com o raciocínio completo: carga bruta, interpolação passo a passo, referência conservadora, trações por posição com os ângulos a partir da vertical, manilha no gancho, sapatas (M, F, ES), RMET, tudo com 2 casas e símbolo Pb.
- Lateral: "Por que fica separado", "Onde é salvo" (pasta Cálculo do plano) e "Revisão" com seletor.
- Botão para salvar o memorial em PDF (`Memorial_{nº}_Rev{rev}.pdf`).

### 7.10 Histórico de alterações (`/planos/:numero/historico`)

- Linha do tempo: quem, quando e o que mudou (ex.: "Capacidade no raio: 7.948 kg → 9.260 kg").
- Filtros **Tudo / Cálculos / Anexos / Emissões** com contagem.
- Etiqueta de tipo em texto (Emissão, Cálculo, Anexo, Cadastro); mudanças que alteram cálculos em destaque.
- Caminho de navegação com links.

### 7.11 Consulta rápida (`/consulta`)

- **Capacidade da frota** (título; antes "Qual guindaste dá?") sem criar plano: peso da carga, lingada + dispositivos e raio, com validação; Pb calculado ao vivo.
- **Consultar** (ou Enter) calcula para cada guindaste da frota: capacidade no raio, referência conservadora, taxa, barra com a situação em texto.
- Situações: Atende / Atende, perto do limite (75% a 85,00%) / Não atende (acima de 85%) / Raio fora do gráfico / Gráfico não cadastrado (com "Cadastrar gráfico").
- Laudo vencido: "não pode ser usado" + link **Atualizar laudo**; guindaste liberado: **Criar plano com ele**.
- Nota "Resultado indicativo; o plano oficial passa por todas as etapas".

### 7.12 Guindastes (`/guindastes`)

- Lista com selo do laudo de cada guindaste.
- Formulário completo: nome/modelo (obrigatório), caminhão, placa, chassi, ano, capacidade nominal, comprimento da lança (informativo), a, b e Pg, com validação e "lido como".
- **Laudo técnico**: validade início e fim, ART do laudo, PDF do laudo, situação calculada, **histórico de laudos**; "+ Registrar novo laudo" move o atual para o histórico ao salvar.
- **Gráfico de carga** por configuração: chips "Gráfico de carga · lança principal (N extensões)", "+ Configuração", nome da configuração, linhas "Alcance da extensão (m) × Capacidade (kg)" com erro na própria linha (inválida, repetida, fora de ordem), gráfico desenhado com `GraficoCapacidade` (eixos em números redondos, área suave, pontos com anel, dica ao passar o mouse em cada extensão) e a faixa válida do gráfico embaixo, explicação do guindaste articulado.
- Salvar e Descartar alterações no rodapé; aviso ao trocar de guindaste com alterações não salvas; "+ Novo guindaste".
- A página não rola: a lista de guindastes e o cadastro rolam cada um por dentro (`AreaRolavel`), e o rodapé com Salvar fica sempre visível.

### 7.13 Clientes (`/clientes`)

- Lista com busca por nome ou CNPJ e número de planos de cada cliente.
- Formulário: razão social, CNPJ validado (numérico ou alfanumérico) ou "CNPJ não informado", endereço, contato, telefone, e-mail do contato.
- **Locais de obra** (contratante ≠ local da obra): nome, endereço, cidade, UF, CEP; remover pede confirmação e só vale ao salvar.
- Planos do cliente com a situação; **Novo plano para este cliente**.
- A página não rola: lista e "Dados do cliente" rolam cada um por dentro (`AreaRolavel`), com sombra no corte e o aviso **"Role para ver mais"** (seta quicando) enquanto houver conteúdo abaixo; cabeçalho e rodapé do cartão (Salvar) ficam sempre visíveis.

### 7.14 Acessórios de lingada (`/acessorios`)

- Abas por tipo (cintas planas, cintas tubulares, manilhas, laços de cabo, dispositivos) e **Inativos**, com contagem.
- Tabela com situação calculada (em uso, vence em N dias, inspeção vencida, validade em N dias, validade vencida, em inspeção, descartado, inativo), uso ("usado em 1 plano (2607036)") e tempo de uso ("em uso há 1 ano e 6 meses").
- Formulário: descrição, medida, norma, capacidade e **capacidade de trabalho** (não pode passar da capacidade), peso unitário.
- **Compra e certificado**: data de entrada (compra, não pode ser futura), **tempo de uso** calculado, nº do certificado e PDF do certificado (anexo).
- **Controle e inspeção**: situação; **motivo do descarte** (obrigatório quando descartado); última e próxima inspeção (em ordem); **vencimento (validade)**, depois da data de entrada, definido pelo engenheiro, com aviso 30 dias antes e bloqueio no plano depois.
- **Registrar inspeção pelo padrão** (acessório salvo, em uso ou em inspeção): data, responsável, cada item do padrão do tipo como **Conforme / Não conforme** ("Marcar todos como conformes"). Aprovado pede a próxima inspeção e deixa "Em uso"; reprovado pede **Descartar** (motivo já vem com os itens não conformes) ou **Deixar "Em inspeção"** (reparo). O registro guarda a cópia dos itens.
- **Padrões de inspeção** (botão no cabeçalho): itens que o inspetor confere em cada tipo (cinta plana, cinta tubular, manilha, laço de cabo de aço, balancim) e as normas de referência. O engenheiro edita; Operação só consulta. Os itens iniciais vieram das normas (NBR 15637-1 e -2, NBR 13541-2, NBR ISO 4309, manual do fabricante) e estão marcados "a validar pelo engenheiro"; os limites numéricos ficam na norma e no manual, não no sistema.
- **Histórico** do acessório (inspeções, mudanças de situação, planos em que foi usado).
- **Desativar** com confirmação (vai para Inativos sem apagar o histórico) e **Reativar**.
- Igual a Clientes: a página não rola; a tabela (com o cabeçalho parado) e o formulário rolam por dentro, com "Role para ver mais". Colunas apertadas ("Cap. trab." com a explicação no ícone "i") para a descrição caber em 1280 px.

### 7.15 Cálculos (`/calculos/regras` e `/calculos/tipos`)

Uma tela com duas abas, para o engenheiro criar, reutilizar, editar e apagar fórmulas sem digitar a mesma conta duas vezes.
Nas duas abas a página não rola: a lista e o editor rolam cada um por dentro, com o rodapé de ações parado embaixo.

**Aba Regras de cálculo**
- Lista com busca e filtros (Todas / Do sistema / Exemplos e criadas), selo de origem e onde a regra é usada.
- Editor: nome, categoria, para que serve, **variáveis** (símbolo, descrição, unidade, origem do valor no plano, valor de teste), **fórmula**, nome e unidade do resultado.
- Fórmulas com + − × ÷ ^, parênteses, cos/sen/tg (graus), raiz, min, max, abs; vírgula decimal e **";" separando argumentos**; avaliador seguro (sem `eval`).
- **Teste ao vivo** com os valores do plano 2607036 (resultado inválido em alerta).
- Comparar com uma capacidade (que vem do acessório ou guindaste do plano) → taxa e situação com o limite de 85%.
- Opções: mostrar no resumo, incluir no memorial, aplicar automaticamente.
- **Versões** (planos emitidos guardam a versão usada), duplicar, **excluir com confirmação** (bloqueado se algum tipo usa a regra). Regras do sistema são só leitura.
- Catálogo do sistema: carga bruta, capacidade no raio, taxa do guindaste, trações (pernas inferiores e superiores), manilha da carga, manilha do gancho, sapatas, RMET.

**Aba Tipos de içamento**
- Lista dos tipos (balancim 4 + 2; sem balancim 2 pernas; laço de cabo de aço).
- Editor: com ou sem balancim, nº de pernas e de pernas superiores, campos pedidos no formulário, **regras aplicadas** (mesmos nomes do catálogo), acessórios previstos.
- **Esquema da lingada** desenhado conforme a montagem.
- Salvar exige regra de tração e de taxa do guindaste; excluir com confirmação; aviso quando não há acessório cadastrado para o tipo (ex.: laço).

### 7.16 Usuários e perfis (`/usuarios`) — só Administrador

- Tabela: usuário (nome, login e observação juntos), perfil, último acesso, ativo, senha provisória (botão **Gerar senha**). A matriz de permissões fica ao lado só a partir de 1800 px; abaixo disso, embaixo da tabela.
- O administrador principal é travado (não perde o perfil nem é desativado).
- **Novo usuário**: nome, usuário, perfil → mostra uma **senha provisória** uma vez ("Anote e entregue ao usuário; ele troca no primeiro acesso").
- **Gerar senha provisória** (com confirmação) para quem esqueceu a senha.
- **Matriz de permissões** gerada do mapa único (seção 9).

### 7.17 Configurações (`/configuracoes`) — só Administrador

- **Pasta dos planos**: pasta raiz no computador onde o sistema está instalado, nome do arquivo com `{nº}` e `{rev}` (validados), exemplo calculado e árvore de pastas até Relatório.
- **Parâmetros gerais**: limite de 85% (fixo), aviso de atenção (50 a 85), casas decimais e unidades (informativo), vento padrão (0 a 20 m/s, editável em cada plano), numeração (só leitura, com "Próximo livre").
- **Dados da empresa**: razão social, CNPJ, endereço, CEP, IE, logo (usada na ficha e no procedimento).
- **Responsável técnico**: nome completo, nome nas assinaturas, título, CREA, RNP, RPP, assinatura digitalizada; GOV.BR "em breve".
- Salvar com validação e aviso de alterações não salvas ao sair.

---

## 8. Rotas

| Rota | Tela | Perfis |
|---|---|---|
| `/login` | Login | todos |
| `/redefinir-senha` | Redefinir senha | todos |
| `/` | Início | todos logados |
| `/planos/novo` | Novo plano | Administrador, Engenheiro |
| `/planos/:numero/editar` | Continuar rascunho (emitido abre só leitura) | Administrador, Engenheiro |
| `/planos/:numero/duplicar` | Novo plano a partir de outro | Administrador, Engenheiro |
| `/planos/:numero/revisao` | Nova revisão | Administrador, Engenheiro |
| `/planos/lote` | Planos em lote | Administrador, Engenheiro |
| `/planos/:numero` | Visualização (`?rev=1` para outra revisão) | todos logados |
| `/planos/:numero/pdf` | PDF gerado | todos logados |
| `/planos/:numero/memorial` | Memorial de cálculo | Administrador, Engenheiro |
| `/planos/:numero/historico` | Histórico | Administrador, Engenheiro |
| `/consulta` | Consulta rápida | todos logados |
| `/guindastes`, `/clientes`, `/acessorios` | Cadastros | todos veem; editar: Administrador, Engenheiro |
| `/calculos/regras`, `/calculos/tipos` | Cálculos | todos veem; editar: Administrador, Engenheiro |
| `/usuarios` | Usuários e perfis | Administrador |
| `/configuracoes` | Configurações | Administrador |

---

## 9. Perfis e permissões

Mapa único em `src/auth/permissoes.ts` (`pode(perfil, acao)`), usado nas rotas, nos botões e na tela Usuários.

| Ação | Administrador | Engenheiro | Operação |
|---|:-:|:-:|:-:|
| Consultar planos e baixar PDF | ✓ | ✓ | ✓ |
| Criar e editar rascunhos | ✓ | ✓ | — |
| Emitir plano (com ART) | ✓ | ✓ | — |
| Criar nova revisão | ✓ | ✓ | — |
| Ver memorial de cálculo | ✓ | ✓ | — |
| Editar cadastros (guindastes, acessórios, clientes, cálculos) | ✓ | ✓ | — |
| Ver histórico de alterações | ✓ | ✓ | — |
| Gerenciar usuários, perfis e senhas provisórias | ✓ | — | — |
| Alterar configurações | ✓ | — | — |

O front esconde o que o perfil não pode fazer, mas **quem garante a permissão é o servidor**.

Na tela, para o perfil Operação: o menu não mostra "Novo plano" (e Alt+N não faz nada); o Início não mostra criar, duplicar nem continuar (o rascunho abre em "Ver"); Guindastes, Clientes e Acessórios abrem só para leitura, com a faixa "Seu perfil pode consultar os cadastros, mas não alterá-los" (contexto `SomenteLeitura` em `pages/cadastros/ui.tsx`).

---

## 10. Modelo de dados usado pelo front

Definido em `src/domain/types.ts` (espelha os models do Django).

| Entidade | Campos principais |
|---|---|
| **Cliente** | razão social, CNPJ, endereço, cidade, UF, CEP, contato, telefone, e-mail, **locais de obra** (nome, endereço, cidade, UF, CEP) |
| **Guindaste** | modelo, veículo, placa, chassi, ano, capacidade nominal, comprimento da lança, a, b, Pg, **laudos** (início, fim, ART, arquivo, atual), **tabelas** (nome da configuração, pontos alcance × capacidade) |
| **Acessório** | tipo, descrição, medida, norma, capacidade, capacidade de trabalho, peso, situação, última e próxima inspeção, **data de entrada, certificado (nº e PDF), vencimento, motivo do descarte**, **inspeções**, histórico, planos em que foi usado |
| **Padrão de inspeção** | tipo de acessório (um por tipo), itens a conferir, normas de referência, atualizado em |
| **Inspeção** (do acessório) | data, responsável, resultado (aprovado/reprovado), **cópia dos itens** com conforme/não conforme, observação, próxima inspeção |
| **Tipo de içamento** | nome, balancim, pernas, pernas superiores, campos pedidos, regras aplicadas, versão, origem |
| **Regra de cálculo** | nome, categoria, variáveis (símbolo, unidade, origem), fórmula, resultado, comparação com capacidade, opções, versões, origem |
| **Plano de Rigging** | número, situação do documento (rascunho/emitido), contratante, local da obra, data da operação, descrição, ART, contrato, carga, tipo de içamento, lingada (item, quantidade, **posição**), ângulos, dispositivos, cargas extras, guindaste principal + adicionais (gráfico, raio, %), quadrantes, vento, isolamento, dormente, anexos, etapa atual, criado em/por, **revisões** |
| **Revisão** | número, emitida em, origem (Excel/sistema), **cópia completa dos resultados**, arquivo PDF, observação |
| **Evento de histórico** | data/hora, usuário, tipo (emissão, cálculo, anexo, cadastro), título, detalhe |
| **Usuário** | nome, usuário (login), perfil, ativo, principal, trocar senha, último acesso |
| **Configurações** | pasta raiz, nome do arquivo, empresa (razão social, CNPJ, endereço, CEP, IE), responsável técnico, aviso de atenção, vento padrão, numeração |

---

## 11. Integração com o back-end (Django REST)

Toda chamada passa por `src/services/api.ts`. Cada função tem duas implementações com a mesma assinatura, o mock e o Django (`apiHttp`), escolhidas no build por `VITE_API` (a tabela abaixo é a de 08/10/2026; o contrato completo, com anexos, PDF, memorial, carimbo e imagens, está em [docs/backend.md](backend.md#endpoints)). A conversão `camelCase ⇄ snake_case` fica num lugar só (`paraApi` / `daApi`).

| Função | Endpoint |
|---|---|
| `login` | `POST /api/auth/token/` (JWT, simplejwt; `usuario` = login) |
| `sair` | `POST /api/auth/logout/` |
| `trocarSenha` | `POST /api/auth/trocar-senha/` |
| `listarPlanos` · `obterPlano` | `GET /api/planos/` · `GET /api/planos/{numero}/` |
| `criarPlano` | `POST /api/planos/` (número gerado pelo servidor) |
| `salvarRascunho` | `PATCH /api/planos/{numero}/` (plano emitido recusa com 409) |
| `emitirPlano` | `POST /api/planos/{numero}/emitir/` (servidor recalcula e cria a revisão) |
| `novaRevisao` | `POST /api/planos/{numero}/nova-revisao/` |
| `duplicarPlano` | `POST /api/planos/{numero}/duplicar/` |
| `criarLote` | `POST /api/planos/lote/` |
| `historicoPlano` | `GET /api/planos/{numero}/historico/` |
| `listarGuindastes` · `salvarGuindaste` | `GET /api/guindastes/` · `POST`/`PUT /api/guindastes/{id}/` |
| `listarAcessorios` · `salvarAcessorio` | `GET /api/acessorios/` · `POST`/`PUT /api/acessorios/{id}/` |
| `desativarAcessorio` · `reativarAcessorio` | `POST /api/acessorios/{id}/desativar/` · `/reativar/` |
| `registrarInspecao` | `POST /api/acessorios/{id}/inspecoes/` (itens conferidos, resultado, próxima; reprovado: descartar com motivo ou deixar em inspeção) |
| `listarPadroesInspecao` · `salvarPadraoInspecao` | `GET /api/padroes-inspecao/` · `PUT /api/padroes-inspecao/{tipo}/` |
| `listarClientes` · `salvarCliente` | `GET /api/clientes/` · `POST`/`PUT /api/clientes/{id}/` |
| `listarTiposIcamento` · `salvarTipoIcamento` · `excluirTipoIcamento` | `/api/tipos-icamento/` |
| `listarRegras` · `salvarRegra` · `excluirRegra` | `/api/regras/` |
| `listarUsuarios` · `criarUsuario` · `salvarUsuario` · `gerarSenhaProvisoria` | `/api/usuarios/` · `PATCH /api/usuarios/{id}/` · `POST /api/usuarios/{id}/senha-provisoria/` |
| `obterConfiguracoes` · `salvarConfiguracoes` | `GET`/`PUT /api/configuracoes/` |

Códigos de erro tratados pelas telas: 400 dados inválidos, 401 login, 404 não encontrado, 409 conflito (ex.: plano emitido), 422 regra de negócio.

**⚠ Login e usuários de teste (fazer antes de testar o front com o back-end):**
- O front entra só com **usuário** + senha (sem e-mail). `POST /api/auth/token/` recebe `{ "usuario", "senha" }`; no Django, `usuario` é o `username`. O mesmo vale para `trocar-senha`.
- Cadastrar no servidor os usuários de teste com exatamente este login, senão não dá para entrar no front:

| perfil | usuário |
|---|---|
| Administrador (principal) | `giuliano.breda` |
| Operação | `rigger.campo` |

- O login aceita letras minúsculas, números, ponto, hífen e sublinhado (3 a 30), igual à validação do front (`erroLogin`).
- A senha de teste é combinada na equipe e não vai para o repositório.

Combinados com o back-end:
- O servidor **recalcula com as mesmas regras** (em `Decimal`) antes de emitir; os testes de `domain/plano.test.ts` servem de casos de aceitação.
- O servidor gera o número (com bloqueio e unicidade), grava a revisão imutável e o PDF, e recusa alteração em plano emitido.
- Números chegam do Django como número JSON (o servidor calcula em `Decimal` e serializa como número).
- O servidor gera e guarda o PDF na emissão; o aplicativo grava uma cópia na pasta do plano no computador (no navegador, o PDF é baixado).

Segurança que o servidor precisa garantir (da auditoria de 08/10/2026; o front não substitui nada disto):
- **Permissão em toda rota**: `IsAuthenticated` como padrão e uma permissão por perfil copiando `permissoes.ts`.
- **Token**: access curto só em memória no front; refresh no `sessionStorage`, nunca no `localStorage`; ao abrir, renovar e pegar o perfil de `GET /api/auth/me/` em vez de confiar no que está salvo no navegador; 401 volta para o login. Hoje a sessão do mock fica inteira no `sessionStorage`.
- **Senha**: hasher do Django; senha provisória aleatória, de uso único e com validade; o servidor não emite token completo enquanto a troca estiver pendente; limite de tentativas no login e na troca.
- **Uploads**: conferir que é PDF pelos bytes (`%PDF-`), tamanho máximo, nome gerado pelo servidor, guardar fora da pasta pública; logo e assinatura só PNG/JPEG.
- **Caminho de arquivo**: limpar pasta raiz, nome da pasta do cliente e modelo do nome do arquivo, e conferir que o caminho final fica dentro da pasta raiz.
- **Fórmulas**: se o servidor recalcular com as regras do engenheiro, parser próprio igual ao do front (nunca `eval`/`sympify`), com limite de tamanho e de expoente.
- **Electron**: `contextIsolation` ligado, `nodeIntegration` desligado, CSP no build, sem carregar por `file://`, e nunca empacotar com o mock ligado.

---

## 12. Qualidade: estados de tela, acessibilidade e formatação

**Estados de tela** (nenhuma tela fica em branco):
- Carregando: barra de progresso ou esqueleto.
- Erro: mensagem com **"Tentar de novo"** (`useCarregar` devolve `erro` e `recarregar`).
- Vazio: texto explicando e ação para começar (ex.: "Nenhum plano encontrado · Limpar filtros").
- Enviando: botão desabilitado durante a gravação (evita duplicar plano ou lote).
- Sucesso: notificação dizendo o que aconteceu.
- Alterações não salvas: aviso ao sair da tela.

**Acessibilidade:**
- Todo campo com rótulo; botões só de ícone com `aria-label`.
- Contraste de pelo menos 4,5:1 em texto e 3:1 em bordas (branco sobre laranja usa `#9A4A08`).
- Foco visível em todos os elementos; navegação por teclado; link "Pular para o conteúdo".
- Situação nunca só por cor (sempre com texto ou ícone).
- Diálogos com título associado; notificações com `aria-live`.
- Tabelas com cabeçalho; `lang="pt-BR"`.

**Formatação pt-BR:** números com vírgula decimal e ponto de milhar, datas `dd/mm/aaaa`, horas `HHhMM`, unidades sempre explícitas.

**Desempenho:** carregamento sob demanda por rota; ícones importados um a um; fonte só com os subconjuntos necessários (melhoria pendente).

---

## 13. Testes e integração contínua

| Tipo | Ferramenta | O que cobre hoje |
|---|---|---|
| Unitário do domínio | Vitest | 2607036 e 2610001 com os valores da Rev. 2; `lerNum`; faixas; ângulo 95° e vazio bloqueiam; capacidade nula bloqueia; raio 3 m e 18 m bloqueiam; 85,00% passa e 85,06% bloqueia; 75% é atenção; laudo vencido/sem data/sem laudo; numeração (outubro, virada de ano, 999); avaliador (`min(3;45)`, −2^2 = −4, cos 90 inválido); sem arredondamento (raio 5,26 → 8.740 kg) |
| API simulada | Vitest | Criar, salvar, emitir, nova revisão, lote, plano emitido recusa alteração |
| Lógica das telas | Vitest | Início, Lote, Visualização, Memorial, cadastros, Cálculos, permissões, eixos do gráfico de carga, inspeção de acessórios (padrões, aprovado/reprovado, validade, tempo de uso, motivo do descarte) |
| Ponta a ponta | Playwright (rodado à parte na revisão de 08/10/2026; ainda não faz parte do repositório nem do CI) | Capturas de todas as rotas sem erro no console; fluxos do formulário (4.2, ângulo 95, data vazia, ART repetida, laudo renovado, emitir, somente leitura) |

Total em 08/10/2026: **219 testes passando**, checagem de tipos sem erro, build fechando e `npm audit` sem vulnerabilidade.

**Integração contínua** (`.github/workflows/ci.yml`, Node 22, permissão só de leitura): `npm ci` → `npm run typecheck` → `npm test` → `npm run build` → `npm audit --omit=dev --audit-level=high` em todo push e pull request. Recomendado acrescentar `npm run lint` quando o ESLint entrar.

---

## 14. Dados de exemplo para demonstração

"Hoje" no sistema: **07/10/2026**.

| Nº | Situação | Para mostrar |
|---|---|---|
| **2607036** | Emitido · Rev. 2 | Rev. 1 emitida no Excel em 24/07/2026 com capacidade 7.948 kg (erro de interpolação) e Rev. 2 recalculada pelo sistema; visualização, PDF, memorial, histórico |
| **2610001** | Rascunho, etapa 4 | Cópia do 2607036 para 15/10/2026, bloqueada porque o laudo do MD 45.007 venceu em 06/10/2026; mostra o alerta e o "Anexar laudo renovado" |
| **2610002** | Rascunho (exemplo) | Bloqueio por taxa acima de 85% |

Cadastros: Kaefer Rip Serviços Industriais Ltda. (local de obra Bosch, Cidade Industrial, Curitiba/PR); Palfinger MD 45.007 completo (placa IUL8A16, gráfico de carga com 8 extensões); MD 55, DM 130 e MD 300L sem dados (a empresa não forneceu); cintas planas 3 m e 4 m de 6 t (4,2 t de trabalho), manilhas 7/8" (5,5 t) e 1" (7,2 t), balancim 250 kg. Esses acessórios reais ainda não têm data de entrada, certificado nem vencimento (a empresa não informou). Para demonstrar o vencimento há uma **cinta tubular 3 m · 3 t (exemplo)**, o exemplo dado pelo próprio engenheiro, com dados de demonstração: entrada 10/03/2025, vencimento 30/10/2026 (aviso na tela inicial) e uma inspeção aprovada.

Por que a Rev. 1 estava errada (texto que aparece no sistema): a capacidade saiu 7.948 kg porque a interpolação não dividiu pela distância entre 4,18 m e 5,98 m (o certo é 9.260 kg); a taxa do guindaste herdou esse erro; as sapatas deram 7.914 kgf porque o Excel não somou a lingada; cinta e manilha saíram 60% e 70% porque a tração foi arredondada para 2,5 t antes de dividir.

---

## 15. O que ainda é simulado

**No modo mock** (padrão do `npm run dev`, usado nos testes e na demonstração), continua simulado:

- Login (aceita qualquer senha para usuário existente) e troca de senha.
- Gravação dos dados (em memória; recarregar a página volta ao cenário de exemplo).
- Geração do PDF único, gravação na pasta e abertura da pasta.
- Upload dos anexos (desenhos, ART, laudo, certificado do acessório).
- Planilha do carimbo (.xlsx) para o SolidWorks.
- Renovação de laudo feita dentro do formulário (só fica guardada enquanto a página está aberta).
- Logo e assinatura digitalizada em Configurações (só prévia).

**Com o servidor** (`VITE_API=http`, sempre no aplicativo), tudo isso já é real (11/2026): login JWT e troca de senha,
dados no PostgreSQL, PDF único e memorial gerados pelo servidor na emissão e gravados na pasta do plano pelo
aplicativo, upload dos anexos, do laudo (inclusive o renovado no formulário), do certificado, da logo e da assinatura,
e a planilha do carimbo.

**Ainda pendente:** a assinatura digitalizada desenhada no PDF (a imagem já é guardada); a ART do laudo do guindaste
como arquivo separado; a conferência do número da ART lido de dentro do PDF (hoje vale o nome do arquivo,
`ART_<nº>.pdf`); a assinatura GOV.BR (recurso futuro).

---

## 16. Checklist de pronto

Uma tela ou funcionalidade só está pronta quando:

- [ ] Faz o mesmo que a tela correspondente do protótipo corrigido.
- [ ] Usa só as funções do domínio para regra de negócio (nenhuma conta dentro da tela).
- [ ] Busca e grava dados só pela `api.ts`.
- [ ] Campos numéricos validam a faixa, mostram erro no campo e "lido como" quando há ponto.
- [ ] Números exibidos com `fmt` (2 casas, separador de milhar) e unidade.
- [ ] Usa `BotaoVoltar`, `Cabecalho` ou `BarraPlano`, e os tokens de cor do tema.
- [ ] Tem estados de carregamento, erro (com "Tentar de novo"), vazio e enviando.
- [ ] Ações que apagam pedem confirmação; toda ação mostra notificação do resultado.
- [ ] Respeita o perfil (`pode()`): esconde o que não pode e a rota está protegida.
- [ ] Acessível: rótulos, foco visível, contraste, situação com texto.
- [ ] Sem `any`, sem `@ts-ignore`; `npm run typecheck` sem erro.
- [ ] Testes da lógica escritos ou atualizados; `npm test` passando.
- [ ] Captura da tela rodando conferida, sem erro no console.
- [ ] `npm run build` fechando e CI verde.
