# Camada de domínio e dados — guia para as telas

Código em `ribasrig-frontend/src/domain/` (caminhos abaixo relativos a `ribasrig-frontend/`). Tudo é TypeScript puro (sem React).
As telas importam de `src/domain/*` e falam com os dados **só** por `src/services/api.ts`.
Fonte das regras: especificação de 07/10/2026 (protótipo corrigido). Testes: `npx vitest run src/domain src/services`.
O servidor (`ribasrig-backend`, pasta `motor/`) tem a mesma lógica em Python: mudou aqui, muda lá.

**Regras de ouro**
- Nada é arredondado antes do cálculo. Só `fmt`/`fmtPct`/`fmtUn` arredondam, na hora de mostrar (2 casas no que é calculado).
- "Hoje" é `HOJE` (de `formatacao.ts`): `'2026-10-07'` no mock; com o servidor, `definirHoje` (chamado em `main.tsx`) troca pela data de `GET /api/sistema/` antes de montar as telas. Nunca use `new Date()` para datas do negócio; use `diasEntre(HOJE, iso)`.
- Valor inválido = `NaN` nos cálculos e "—" na tela, e o plano fica **Bloqueado** (nunca "dentro do limite").
- Massa em kg, força em kgf; carga bruta = **Pb**. Situação do documento (Rascunho/Emitido) ≠ situação de segurança (calculada).

---

## 1. `formatacao.ts` — números, datas, CNPJ

| Função | Entrada → saída | Exemplo |
|---|---|---|
| `HOJE` / `definirHoje(iso)` | data das regras (mock: fixa; servidor: a do servidor) | `'2026-10-07'` |
| `lerNum(texto)` | texto pt-BR → número; vazio/negativo/inválido = `NaN` | `'3.450'`→3450 · `'3.450,5'`→3450,5 · `'4.2'`→4,2 · `'5,0'`→5 · `'-1'`→NaN |
| `lidoComo(texto, casas?, unidade?)` | `"lido como …"` quando o texto tem ponto; senão `null` | `lidoComo('4.2',1,'m')` → `'lido como 4,2 m'` |
| `fmt(v, casas=2)` | milhar + casas fixas; inválido = `'—'` | `fmt(3746.62)` → `'3.746,62'` |
| `fmtPct(v, casas=2)` / `fmtUn(v, casas, un)` | `'40,46%'` / `'7.940,68 kgf'`; inválido = `'—'` | |
| `numParaTexto(v, minCasas=0)` | número → texto do formulário, sem arredondar | `3450`→`'3.450'`, `(5,1)`→`'5,0'` |
| `casasDe(v)` | casas decimais do valor (até 4) | |
| `dataBR(iso)` / `dataHoraBR(iso)` | `'06/10/2026'` / `'07/10/2026 às 14h12'`; inválida = `'—'` | |
| `isoDeBR('15/10/2026')` | `'2026-10-15'` ou `null` (formato errado/data inexistente) | |
| `diasEntre(de, ate)` | dias corridos (NaN se inválida) | `diasEntre(HOJE,'2026-10-20')` → 13 |
| `dataIsoValida(iso)` | boolean | |
| `cnpjValido(v)` | numérico **e alfanumérico** (letras nas 12 primeiras posições; DV numérico, valor = ASCII − 48) | `'12.ABC.345/01DE-35'` → true |
| `formatarCnpj(v)` / `normalizarCnpj(v)` / `somenteDigitos(v)` | máscara / sem pontuação em maiúsculas / só dígitos | |

Nomes antigos `formatarNumero`, `formatarData`, `formatarPercentual`, `lerNumero` ainda existem como `@deprecated`, mas nenhuma tela usa mais. Não use em código novo.

## 2. `validacao.ts` — faixas e validação de campo

- `FAIXAS`: faixas da especificação como dados (`{ min, max, inteiro?, unidade, rotulo, exemplo, vazio? }`). Chaves: `pesoCarga` 1–100.000 kg · `dimensao` 0,1–50 m · `quantidade` inteiro 1–50 · `capacidadeAcessorio` 0,1–100 t · `pesoAcessorio` 0,01–5.000 kg · `angulo` 0–60° · `raio` 0,5–30 m · `vento` 0–20 m/s · `distanciaA`/`aberturaB` 0,5–15 m · `pesoGuindaste` 500–100.000 kgf · `dormente` 10–200 cm · `dormentesPorSapata` inteiro 1–50 · `cargasExtras` ≥ 0 · `pesoDispositivo` · `comprimentoLanca` · `raioIsolamento` · `pctAdicional` 1–99 · `alcanceGrafico` · `capacidadeGrafico` · `anoGuindaste` · `capacidadeNominal` · `limitePct` 50–100 · `avisoAtencaoPct` 50–100 (e menor que o limite) · `ventoPadrao`.
- `validarCampo(nome, texto)` → `{ valor, erro, lidoComo }`. `valor` é `NaN` quando há erro. Mostre `erro` (laranja) e, se houver, `lidoComo` abaixo do campo.
  - `validarCampo('angulo','95')` → `{ valor: NaN, erro: 'Fora da faixa: 0° a 60° (a partir da vertical).', lidoComo: null }`
  - `validarCampo('pesoCarga','3.450')` → `{ valor: 3450, erro: null, lidoComo: 'lido como 3.450 kg' }`
- `validarFaixa(faixa, texto)`: o mesmo para uma faixa avulsa. `faixaTexto(faixa)` → `'1 kg a 100.000 kg'`.
- `erroNumeroArt(art)` (13 dígitos) · `erroLogin(login)` · `erroNomeArquivo(nome)` (precisa de `{nº}` e `{rev}`) → mensagem ou `null`.

## 3. `types.ts` — modelo (espelha os models do Django)

- **Guindaste** `{ id, modelo, codigo, veiculo, placa, chassi, ano, capacidadeNominalT, comprimentoLancaM (informativo), aM, bM, pgKgf, laudos: Laudo[], tabelas: TabelaCapacidade[], dadosPendentes, ativo }`
  - `TabelaCapacidade { id, nome ('lança principal'), pontos: { alcanceM, capacidadeKg }[] }` — mostre com `nomeGrafico(t)`.
  - `Laudo { inicio, fim, art, arquivo, atual }` (um `atual` por guindaste).
- **Acessorio** `{ id, tipo ('cinta'|'tubular'|'manilha'|'laco'|'dispositivo'), descricao, nomeCurto, medida, norma, capacidadeT, capacidadeTrabalhoT (null = usa capacidadeT), unidadeCapacidade ('t'|'tf'), pesoKg, situacao ('uso'|'inspecao'|'descartado'|'inativo'), ultimaInspecao, proximaInspecao, dataEntrada, certificado, certificadoArquivo, vencimento, motivoDescarte (obrigatório se descartado), inspecoes: RegistroInspecao[], historico: {data, descricao}[], planos: string[] }`
- **PadraoInspecao** `{ tipo, referencia, itens: string[], atualizadoEm }` (um por tipo de acessório, editável pelo engenheiro) · **RegistroInspecao** `{ data, responsavel, resultado ('aprovado'|'reprovado'), itens: {texto, conforme}[] (cópia), observacao, proxima }`
- **ItemLingada** `{ acessorioId, quantidade, posicao }`, `PosicaoLingada = 'pernasInferiores' | 'pernasSuperiores' | 'carga' | 'gancho'`.
- **TipoIcamento** `{ id, nome, descricao, origem ('sistema'|'exemplo'|'criado'), balancim, pernas, pernasSuperiores, campos {anguloInferior, anguloSuperior, anguloUnico, pesoBalancim, capacidadeLaco}, regras: string[] (ids), acessoriosSugeridos, geometria, avisoSemAcessorio, autor, versao, planos }`
- **RegraCalculo** `{ id, nome, categoria, descricao, formula, resultadoNome, resultadoUnidade, variaveis: {simbolo, nome, unidade, origem, teste}[], limite, origemCapacidade, capacidadeTeste, noResumo, noMemorial, automatica, origem, autor, versao, versoes: VersaoRegra[], planos }`
- **Cliente** `{ id, razaoSocial, nomePasta, cnpj ('' = não informado), endereco, cidade, uf, cep, locaisObra: LocalObra[], contato, telefone, email, exemplo }`; `LocalObra { nome, endereco, cidade, uf, cep }`.
- **PlanoRigging** = `DadosPlano` + `{ id, numero, situacaoDocumento ('rascunho'|'emitido'), revisoes: Revisao[], criadoEm, criadoPor, atualizadoEm }`.
  - `DadosPlano`: `clienteId, obra {mesmoEnderecoContratante, nome, endereco, cidade, uf, cep}, dataOperacao, descricaoOperacao, rigger, art, artRegistradaEm, contratoArt {numero, celebradoEm, valor, termino}, carga {descricao, comprimentoM, larguraM, alturaM, pesoKg}, tipoIcamentoId, lingada, anguloInferiorGraus (sem balancim = ângulo único), anguloSuperiorGraus, dispositivo {acessorioId, descricao, quantidade, pesoUnitarioKg}, cargasExtrasKg, guindasteId, tabelaId, comprimentoLancaM, raioM, guindastesAdicionais {guindasteId, tabelaId, raioM, pct}[], quadranteInicial, quadranteFinal, ventoMaxMs, raioIsolamentoM, dormente {larguraCm, comprimentoCm, quantidade}, anexos {desenhos, artPlano, arquivoArt}, etapaAtual, copiaDe, exemplo`. Números podem ser `null` (rascunho).
  - `Revisao { numero, emitidaEm, emitidaPor, origem ('excel'|'sistema'), cadastradaEm, resultados: ResultadosRevisao, arquivoPdf, observacao }`.
  - `ResultadosRevisao`: cópia de **todos** os resultados por item — `cargaKg, lingadaKg, dispositivosKg, extrasKg, pbKg, guindastes[] (principal + adicionais: raio, %, carga, capacidade, taxa, laudo), capacidadeKg, taxaGuindastePct, referenciaConservadoraKg, taxaReferenciaPct, posicoes[] (posição, acessório, ângulo, tração, unidade, capacidade, taxa), sapatas {momentoKgfm, forcaKgf, esforcoKgf, areaCm2, rmet}, raioIsolamentoM, ventoMaxMs, situacaoSeguranca, comoNoDocumento` (só Rev. do Excel: textos como impressos, ex. `cap: '7,95'`). Campos `null` = não consta / inválido.
  - Rascunho não tem número de revisão; a primeira emissão é a Rev. 1. Rascunho com `revisoes.length > 0` = "Rascunho da Rev. N+1".
- **EventoHistorico** `{ id, planoNumero, tipo ('emissao'|'calculo'|'anexo'|'cadastro'|'edicao'), titulo, detalhe, usuario, quando }`.
- **Usuario** `{ id, nome, usuario (login), perfil ('admin'|'engenheiro'|'operacao'), ativo, principal, trocarSenha, ultimoAcesso, observacao }` — sem e-mail.
- **Configuracoes** `{ pastaRaiz, nomeArquivo ('Plano_de_Rigging_{nº}_Rev{rev}.pdf'), empresa {razaoSocial, cnpj, ie, endereco, cep}, responsavel {nomeCompleto, nomeAssinatura, titulo, crea, rnp, rpp, assinatura}, avisoAtencaoPct, ventoPadraoMs, numeracao {descricao} }`.

## 4. `calculos.ts` — funções puras do motor

| Função | Saída |
|---|---|
| `LIMITE_PADRAO_PCT` 85 · `LIMITE_PCT` (limite em uso; `definirLimite(pct)` troca) · `ATENCAO_PADRAO_PCT` 75 · `AVISO_VENCIMENTO_DIAS` 30 · `TOLERANCIA_PCT` 1e-9 | constantes |
| `nivelTaxa(taxa, aviso=75, limite=LIMITE_PCT)` | `'ok'|'atencao'|'bloqueado'`; acima do limite bloqueia (o valor exato passa, com tolerância só de ponto flutuante); ≥ aviso = atenção; NaN/negativo = bloqueado |
| `piorSituacao(lista)` | pior nível |
| `taxaPct(carga, capacidade)` | carga ÷ capacidade × 100; inválido/negativo/capacidade ≤ 0 = NaN |
| `capacidadeNoGrafico(pontos, raio)` | `{tipo:'sem-grafico'}` · `{tipo:'raio-invalido'}` · `{tipo:'fora-do-grafico', lado:'abaixo'|'acima', alcanceMinM, alcanceMaxM}` (**bloqueia**) · `{tipo:'exato', capacidadeKg, ponto}` · `{tipo:'interpolado', capacidadeKg, p1, p2}`. MD 45.007: 5,0 m → 9.260; 5,26 → 8.740; 3 e 18 → fora |
| `capacidadeKg(r)` | número ou NaN |
| `extensaoQueAlcanca(pontos, raio)` | referência conservadora `{alcanceM, capacidadeKg}` do primeiro ponto com alcance ≥ raio (5,0 m → 5,98 m / 7.300 kg) ou `null` |
| `pontosOrdenados(pontos)` | pontos válidos ordenados ou `null` (inválido/repetido) |
| `tabelaDoGuindaste(g, tabelaId)` / `nomeGrafico(t)` | gráfico escolhido (ou o 1º) / `'Gráfico de carga · lança principal (8 extensões)'` |
| `tracoesPorPosicao({pT, balancimT, anguloInferior, anguloSuperior, balancim})` | `Record<Posicao, number>`: com balancim inf = P/(2cos αi), sup = (P+B)/(2cos αs), carga = P/(4cos αi), gancho = 2·sup; sem balancim pernas = carga = P/(2cos α), gancho = 2·pernas, sup = NaN. cos ≤ 0 = NaN |
| `formulaPosicao(pos, balancim, angInfTxt, angSupTxt)` | texto da fórmula |
| `capacidadeDeTrabalho(acessorio)` | capacidade de trabalho (ou nominal) ou NaN |
| `esforcoSapatas({pbKg, raioM, pgKgf, aM, bM, dormente})` | `{momentoKgfm, forcaKgf, esforcoKgf, areaCm2, rmet}` (2607036: 7.940,68 kgf, RMET 3,1763) |
| `laudoAtual(g)` | laudo vigente ou `null` |
| `situacaoLaudo(g, dataRef)` | `{situacao: 'vencido'|'vence-em-breve'(≤30 d)|'em-dia'|'nao-cadastrado'|'sem-data', aprovado, dias, fim, laudo, texto}`. No plano, `dataRef` = data da operação; no cadastro, `HOJE`. Sem laudo, sem fim ou sem data = reprova |
| `situacaoInspecao(acessorio, dataRef)` | `{situacao: 'em-dia'|'vence-em-breve'|'vencida'|'sem-inspecao'|'indisponivel'|'sem-data', aprovado, dias, proxima, motivo ('inspecao'|'validade'), texto}`: inspeção e vencimento do item, vale o que vence primeiro (cinta 3 m em HOJE: vence em 13 dias; cinta tubular de exemplo: validade em 23 dias) |
| `isolamentoCobre(isol, raio)` | isolamento ≥ raio |

## 5. `plano.ts` — o plano inteiro

- `FormPlano`: formulário em **texto** (campos: `clienteId, obraMesmoEndereco, obraNome, obraEndereco, obraCidade, obraUf, obraCep, dataOperacao, descricao, rigger, art, artContrato, artCelebracao, artValor, artTermino, cargaDescricao, comprimento, largura, altura, peso, tipoIcamentoId, lingada: {acessorioId, quantidade, posicao}[], anguloInferior, anguloSuperior, dispositivoAcessorioId, dispositivoDescricao, dispositivoQtd, dispositivoPeso, extras, guindasteId, tabelaId, lanca, raio, isolamento, quadranteInicial, quadranteFinal, vento, guindastesAdicionais: {guindasteId, tabelaId, raio, pct}[], dormenteLargura, dormenteComprimento, dormenteQtd, anexos`). Não tem `numero` (gerado pela api).
- `calcularPlano({ form, numero, acessorios, guindastes, tipos, clientes, configuracoes: {avisoAtencaoPct}, hoje: HOJE, artsEmUso? })` → `ResultadoPlano`:
  - `campos[chave]` `{ valor, erro, lidoComo, rotulo, etapa, ativo }` — chaves = nomes do FormPlano + `lingada.<i>.quantidade`, `adicionais.<i>.raio`, `adicionais.<i>.pct`; `camposInvalidos[]`; `dataOperacao {iso, erro, anteriorAHoje}`; `art {numero, erro}` (13 dígitos, não repetir ART de outro plano).
  - `tipo, balancim, itens[] {acessorio, quantidade, pesoTotalKg, posicao, erroAcessorio, erroPosicao}`.
  - `cargaKg, lingadaKg, dispositivosKg, extrasKg, pbKg, pT (= carga + extras, t), bT`.
  - `guindaste, tabela, raioM, capacidade (CapacidadeNoGrafico), capacidadeKg, referenciaConservadora {alcanceM, capacidadeKg, taxaPct} | null, pctPrincipal, pbPrincipalKg, taxaGuindaste, nivelGuindaste`.
  - `adicionais[] {guindaste, tabela, raioM, pct, cargaKg, capacidade, capacidadeKg, taxaPct, nivel, repetido, laudo}`, `divisaoInvalida` (soma ≥ 100%).
  - `porPosicao[] {posicao, obrigatoria, formula, tracao, unidade, quantidadeItens, governante (menor capacidade), capacidadeGovernante, taxaPct, nivel, problema}`.
  - `sapatas {momentoKgfm, forcaKgf, esforcoKgf, areaCm2, rmet}`, `rmet`, `laudo` (principal, na data da operação), `inspecoes {itens: {acessorio, naOperacao, hoje}[], ok, detalhe}`, `isolamentoOk`, `anexosPendentes[]`.
  - `checklist[]` (etapa 6) `{ id, rotulo, ok, detalhe, etapa }`, ids: `campos, contratante, data, laudo, raio, guindaste, acessorios, inspecoes, isolamento, anexos, art` (botão "ir para a etapa" usa `etapa`).
  - `motivosBloqueio[]`, `maiorTaxaPct`, `situacaoSeguranca ('ok'|'atencao'|'bloqueado')`, `podeEmitir`.
  - Bloqueia: campo fora da faixa, NaN/negativo/cos ≤ 0, taxa acima do limite (`configuracoes.limitePct`, ou `LIMITE_PCT`), lingada incompleta, sem gráfico/raio fora, adicional repetido ou soma ≥ 100%, laudo reprovado na data da operação, inspeção vencida/indisponível, isolamento < raio. Falta de ART/anexos/contratante só impede emitir (`podeEmitir`).
- `textoSituacao(r, aviso = 75)` → `{titulo, texto}` (a faixa de atenção usa o aviso das Configurações); `ROTULO_SEGURANCA` (`ok` → 'Dentro do limite', `atencao` → 'Atenção', `bloqueado` → 'Bloqueado').
- `resultadosDoCalculo(r)` → `ResultadosRevisao` (NaN → null) — é o que a emissão grava.
- `formDoPlano(dados)` / `planoDoForm(form, base)` / `dadosVazios(vento?)` / `formVazio(vento?)` / `artsEmUso(planos)`.
- `revisaoAtual(p)`, `proximaRevisao(p)`, `rotuloDocumento(p)` (`'Rascunho'`, `'Rascunho da Rev. 3'`, `'Emitido · Rev. 2'`).
- `nomeArquivoPlano(modelo, numero, rev)` → `'Plano_de_Rigging_2607036_Rev2.pdf'`; `caminhoPlano(config, nomePasta, numero, rev)` → `'C:\…\Planos de Rigging\Kaefer Rip\2607036\Relatório\Plano_de_Rigging_2607036_Rev2.pdf'` (com `/` quando a pasta raiz é do macOS/Linux); `pastaDe(caminho)` → a pasta do caminho, em qualquer sistema.
- Rascunho local: `CHAVE_RASCUNHO`, `lerRascunho()`, `gravarRascunho(r | null)`, `RascunhoLocal { numero, form, etapa, salvoEm }`.
- Constantes: `ETAPAS`, `POSICOES`, `NOME_POSICAO` ('pernas inferiores'), `ROTULO_POSICAO` ('Pernas inferiores').

```ts
const r = calcularPlano({ form: formDoPlano(plano), numero: plano.numero, acessorios, guindastes, tipos, clientes,
  configuracoes, hoje: HOJE, artsEmUso: artsEmUso(planos.filter((p) => p.numero !== plano.numero)) });
fmt(r.pbKg) // '3.746,62'   fmtPct(r.taxaGuindaste) // '40,46%'   r.situacaoSeguranca // 'ok'
```

## 6. `numeracao.ts`

- `proximoNumero(dataCriacaoISO, existentes)` → AAMM + 3 dígitos, zera no mês, virada de ano (`'2027-01-01'` → `'2701001'`); passou de 999 → `ErroNumeracao`. Hoje: `'2610003'`.
- `numerosEmSequencia(primeiro, quantidade)` → números seguidos; erro se passar de 999 (não invade o mês seguinte) ou quantidade inválida.
- `numerosParaLote(data, existentes, qtd)`, `partesNumero(n)`, `prefixoDaData(iso)`, `MAX_SEQUENCIA`.

## 7. `regras.ts` — avaliador e catálogo

- `avaliarBruto(expr, env)` → número cru (lança `ErroExpressao`). `avaliarExpressao(expr, env)` → `{ok:true, valor}` | `{ok:false, erro, valor?}` (negativo/não finito = inválido). Sintaxe: `+ − * / ^` (e `× ÷ ·`), menos unário (`−2^2 = −4`), `cos/sen/tg` em graus (`cos(90) = 0`), `raiz`, `min`, `max`, `abs`, argumentos **só** com `;`, vírgula decimal. Sem `eval`.
- `REGRAS_CALCULO` (r1 carga bruta, r2 capacidade, r9 taxa do guindaste, r3/r4 tração cinta, r5 manilha da carga, r8 manilha do gancho, r6 sapatas, r7 RMET; u1/u2 = "Exemplo da equipe (fictício)"), `TIPOS_ICAMENTO` (t1 padrão com balancim; t2/t3 exemplos sem balancim).
- `ORIGENS_VARIAVEL`, `RESULTADOS_REGRA`, `ORIGENS_CAPACIDADE`, `conferirValor`, `faixaDaVariavel`, `valorDeTeste(catalogo, id)`, `testarRegra(regra, catalogo, aviso?)` → `{variaveis, resultado, capacidade, erroCapacidade, taxaPct, nivel, substituicao}`, `erroRegrasDoTipo(ids, catalogo)`, `rotuloOrigem`, `rotuloOrigemTipo`, `ID_REGRA_TAXA_GUINDASTE`.

## 8. `art.ts`

- `entradaArtDoPlano(numero, dadosPlano, cliente)` → `EntradaArt`; `camposArt(entrada)` → 14 `{campo, valor, pendente}`; `textoArt(campos)` ("Copiar tudo").
- `enderecoObra(obra, cliente)` → `'Bosch · Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial · Curitiba/PR'`; `enderecoContratante(cliente)`.
- Durante a edição: `entradaArtDoPlano('', planoDoForm(form, base), cliente)`.

## 8.1 `inspecao.ts` — padrões e registro de inspeção (resposta 25, 08/10/2026)

- Sem regra fixa de troca (nem n usos, nem n meses). `PADROES_INSPECAO`: itens iniciais por tipo (cinta plana, cinta tubular, manilha, laço, dispositivo), qualitativos, com a norma de referência e "a validar pelo engenheiro". `padraoDoTipo(padroes, tipo)`.
- Janela "Registrar inspeção": `formInspecao(itens, responsavel)` → `FormInspecao` com `marcas: (boolean|null)[]`; `resultadoDasMarcas` (um não conforme reprova; todos conformes aprovam; faltando item = null); `motivoSugerido` (itens não conformes); `validarInspecao` (data não futura e não anterior à última; todos os itens conferidos; próxima depois da data no aprovado; motivo no descarte); `registroDoForm`.
- `aplicarInspecao(acessorio, registro, destino, motivo)` → cópia do acessório: aprovado volta para 'uso' com última e próxima; reprovado vira 'descartado' (com motivo) ou 'inspecao' (reparo). Tudo entra no histórico.

## 9. `services/api.ts` (mock ou Django; endpoint no comentário de cada função)

Duas implementações com a mesma assinatura, escolhidas por `VITE_API`: `apiMock` (abaixo; toda resposta é cópia, mudar o objeto na tela não altera o "banco") e `apiHttp` (Django, com JWT). Erros: `ErroApi { status, message }` com o status HTTP do servidor. Além das funções abaixo: `retomarSessao`, `sistema`, uploads (`enviarAnexoPlano`, `removerAnexoPlano`, `enviarLaudoGuindaste`, `enviarCertificadoAcessorio`, `enviarImagemConfiguracao`) e arquivos gerados (`baixarPdfRevisao`, `baixarMemorial`, `baixarCarimbo`; no mock respondem 409, porque o mock não gera arquivos).

| Grupo | Funções |
|---|---|
| Acesso | `login(usuario, senha)` → `{token, usuario}` (perfil vem do usuário; usuários: `giuliano.breda`, `rigger.campo`; mock aceita qualquer senha preenchida) · `sair()` |
| Planos | `listarPlanos()` · `obterPlano(numero)` · `criarPlano(dados)` (número gerado, nunca digitado) · `duplicarPlano(numero)` · `salvarRascunho(plano)` (mantém id/número; emitido → 409) · `emitirPlano(numero, observacao?)` (recalcula; se `podeEmitir`, cria Revisão N+1 com cópia dos resultados e trava; senão 422 com motivos) · `novaRevisao(numero)` (volta a rascunho da Rev. N+1, mesmo número) · `criarLote(dados, qtd)` · `historicoPlano(numero)` |
| Cadastros | `listarGuindastes()` · `salvarGuindaste(g)` (ordena gráficos, 1 laudo atual) · `listarAcessorios()` · `salvarAcessorio(a)` · `desativarAcessorio(id)` (não apaga) · `registrarInspecao(id, registro, destino, motivo)` · `listarPadroesInspecao()` · `salvarPadraoInspecao(p)` (exige 1 item) · `listarClientes()` · `salvarCliente(c)` |
| Regras | `listarTiposIcamento()` · `salvarTipoIcamento(t)` · `listarRegras()` · `salvarRegra(r)` (nova versão) · `excluirRegra(id)` — itens do sistema são somente leitura (409) |
| Usuários | `listarUsuarios()` · `criarUsuario({nome, usuario, perfil})` → `{usuario, senhaProvisoria: 'Ribas-4821'}` · `salvarUsuario(u)` · `gerarSenhaProvisoria(id)` |
| Config. | `obterConfiguracoes()` · `salvarConfiguracoes(c)` |
| Infra | `paraApi`/`daApi` (camelCase ⇄ snake_case, único lugar), `http(metodo, url, corpo)` (fetch com JWT e renovação do token), `MODO_API`, `agora()` (HOJE + hora do relógio), `SENHA_PROVISORIA` (só no mock) |

## 10. `data/mock.ts` — cenário único

- **Planos**: `2607036` Kaefer · Bosch, chiller 4,7 × 1,95 × 2,3 m, 3.450 kg, MD 45.007, raio 5,0, operação 24/07/2026, ART 1720264496217, **Emitido** com Rev. 1 (Excel, números do documento: 7.948 kg, 47,1%, 60,0%, 70,0%, 7.914 kgf, 3,17; observação `OBS_REV1`) e Rev. 2 (sistema, 07/10/2026 09:40, resultados calculados pelo motor: Pb 3.746,62; 9.260 kg; 40,46%; 46,52/58,36/17,76/68,09%; ES 7.940,68; RMET 3,1763). `2610001` rascunho Kaefer, cópia do 2607036, criado 07/10/2026 14:12, etapa 4, operação 15/10/2026, sem ART/anexos → bloqueado (laudo vencido 06/10/2026). `2610002` Volvo (exemplo), prensa 4.800 kg, raio 7,83 → 98% → bloqueado. Próximo número: 2610003.
- **Guindastes**: MD 45.007 completo (Volvo/VM 270 6X2R, IUL8A16, 2013, 45,0 t, lança 5,1 m informativa, a 2,95, b 5,70, Pg 11.550, laudo 06/04–06/10/2026 ART 1720261926954, gráfico `lp8` "lança principal" com 8 pontos); MD 55, DM 130, MD 300L sem dados (`dadosPendentes: true`).
- **Acessórios**: 1 cinta plana 3 m (4,2 t, 4,87 kg, próx. inspeção 20/10/2026), 2 cinta plana 4 m (4,2 t, 5,97 kg), 3 manilha 7/8" (5,5 tf, 1,70 kg), 4 manilha 1" (7,2 tf, 2,50 kg), 5 balancim (250 kg), 6 cinta 3 m lote 2023 (descartada, motivo "Costura desgastada"), 7 cinta tubular 3 m · 3 t **(exemplo)** com entrada 10/03/2025, certificado e vencimento 30/10/2026 de demonstração (validade em 23 dias). Compra, certificado e vencimento dos itens reais: não informados. Uso: só o 2607036. **Padrões**: `PADROES` (cópia de `PADROES_INSPECAO`).
- **Clientes**: Kaefer (CNPJ 07.522.191/0048-64, local Bosch), Volvo e Renault (exemplo, CNPJ não informado).
- **Usuários**: Giuliano Breda (`giuliano.breda`, admin, principal), Rigger de campo (exemplo) (`rigger.campo`, operação). **Configurações** completas (empresa, IE, CEP, responsável com CREA/RNP/RPP, aviso 75%, vento 7,0 m/s).
- `TIPOS`, `REGRAS` (cópias do catálogo), `EVENTOS` (histórico do 2607036, 2610001, 2610002), `OBS_REV1`, `OBS_REV2`, `HOJE`.
