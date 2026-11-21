// Etapas 1 (dados gerais), 2 (carga), 3 (lingada) e 6 (revisão) do formulário do plano.
import { Autocomplete, Box, Button, Checkbox, FormControlLabel, IconButton, Link, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import DeleteOutline from '@mui/icons-material/DeleteOutlineOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { enderecoContratante, enderecoObra } from '../../domain/art';
import { LIMITE_PCT, capacidadeDeTrabalho } from '../../domain/calculos';
import { casasDe, dataBR, dataHoraBR, fmt, fmtUn, HOJE, numParaTexto } from '../../domain/formatacao';
import { partesNumero } from '../../domain/numeracao';
import { POSICOES, ROTULO_POSICAO, type Etapa, type FormItemLingada } from '../../domain/plano';
import type { PosicaoLingada } from '../../domain/types';
import type { PropsEtapa } from './tipos';
import { Aviso, ChipSituacao, COR, CampoNum, Info, Nota, Secao, TituloEtapa, ValorFixo, ajudaCampo, corNivel, taxaTexto } from './ui';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const linhaGrade = (colunas: string) => ({ display: 'grid', gridTemplateColumns: { xs: '1fr', md: colunas }, gap: 2, alignItems: 'start' });
const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// =============================================================================================
// Etapa 1 · Dados gerais
// =============================================================================================

function ajudaNumero(numero: string | null, criadoEm: string | null): string {
  if (!numero) return 'Gerado pelo sistema no primeiro salvamento · não é digitado';
  const p = partesNumero(numero);
  const ordem = p ? ` · ${String(p.sequencia).padStart(3, '0')}º plano de ${MESES[p.mes - 1]} de ${p.ano}` : '';
  return `Gerado pelo sistema: criado em ${dataHoraBR(criadoEm)}${ordem}`;
}

export function EtapaDados(p: PropsEtapa & { criadoEm: string | null }) {
  const { f, set, patch, r, cad, tentou } = p;
  const cliente = cad.clientes.find((c) => c.id === f.clienteId) ?? null;
  const locais = cliente?.locaisObra ?? [];
  const iLocal = locais.findIndex((l) => l.nome === f.obraNome && l.endereco === f.obraEndereco && l.cidade === f.obraCidade);
  const outroLocal = iLocal < 0;
  const obraOk = f.obraMesmoEndereco ? !!cliente?.endereco.trim() : !!f.obraEndereco.trim() && !!f.obraCidade.trim();
  const obraNaArt = enderecoObra({ mesmoEnderecoContratante: f.obraMesmoEndereco, nome: f.obraNome, endereco: f.obraEndereco, cidade: f.obraCidade, uf: f.obraUf, cep: f.obraCep }, cliente);
  const sugestaoRigger = `${cad.config.responsavel.nomeAssinatura} — ${cad.config.responsavel.rpp}`;
  // Data vazia só vira erro depois de tentar seguir; data digitada e inválida aparece na hora
  const erroData = !!r.dataOperacao.erro && (tentou || !!f.dataOperacao);

  const escolherLocal = (v: string) => {
    if (v === 'outro') { patch({ obraNome: '', obraEndereco: '', obraCidade: '', obraUf: '', obraCep: '' }); return; }
    const l = locais[Number(v)];
    if (l) patch({ obraNome: l.nome, obraEndereco: l.endereco, obraCidade: l.cidade, obraUf: l.uf, obraCep: l.cep });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TituloEtapa titulo="Dados gerais da operação" texto="Esses dados vão para o cabeçalho, os desenhos, o procedimento e a ART." />
      <Box sx={linhaGrade('260px 190px minmax(0, 1fr)')}>
        <ValorFixo rotulo="Nº do Plano de Rigging" icone={<LockOutlined sx={{ fontSize: 16 }} />} ajuda={ajudaNumero(p.numero, p.criadoEm)}>
          {p.numero ?? <Box component="span" sx={{ fontWeight: 400, color: COR.sec, fontSize: 14 }}>será gerado ao salvar</Box>}
        </ValorFixo>
        <Box>
          <TextField label="Data da operação *" type="date" value={f.dataOperacao} onChange={(e) => set('dataOperacao', e.target.value)}
            error={erroData} helperText={erroData ? 'Informe a data da operação. O laudo e as inspeções são conferidos contra ela.' : 'O laudo e as inspeções são conferidos contra ela.'}
            sx={erroData ? { '& .MuiOutlinedInput-root': { bgcolor: '#FFF8F1' } } : undefined} />
          {r.dataOperacao.anteriorAHoje && (
            <Box sx={{ mt: 0.5, fontSize: 12, color: COR.alertaTexto, bgcolor: COR.alertaFundo, borderLeft: `3px solid ${COR.alerta}`, p: '4px 8px' }}>
              Aviso: data anterior a hoje ({dataBR(HOJE)}). Confira antes de emitir.
            </Box>
          )}
        </Box>
        <TextField select label="Tipo de içamento *" value={f.tipoIcamentoId} onChange={(e) => set('tipoIcamentoId', e.target.value)}
          helperText={r.tipo ? undefined : 'Tipo não cadastrado: escolha outro.'} error={!r.tipo}>
          {cad.tipos.map((t) => <MenuItem key={t.id} value={t.id}>{t.nome}{t.origem === 'exemplo' ? ' (exemplo)' : ''}</MenuItem>)}
        </TextField>
      </Box>
      <TextField label="Descrição da operação" value={f.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Ex.: Içamento de chiller — movimentação de equipamento na Bosch" />

      <Secao nota="Quem contrata o serviço e assina a ART como contratante.">Contratante</Secao>
      <Box sx={linhaGrade('minmax(0, 1fr) 220px')}>
        <TextField select label="Contratante (razão social) *" value={f.clienteId ?? ''} onChange={(e) => set('clienteId', e.target.value === '' ? null : Number(e.target.value))}
          error={tentou && !cliente} helperText={tentou && !cliente ? 'Selecione o contratante.' : <>Lista do cadastro. Cliente novo? <Link component={RouterLink} to="/clientes">Cadastre em Cadastros › Clientes</Link></>}>
          <MenuItem value=""><em>Escolha o contratante</em></MenuItem>
          {cad.clientes.map((c) => <MenuItem key={c.id} value={c.id}>{c.razaoSocial}{c.exemplo ? ' (exemplo)' : ''}</MenuItem>)}
        </TextField>
        <ValorFixo rotulo="CNPJ do contratante">{cliente ? cliente.cnpj || <Box component="span" sx={{ fontWeight: 400, color: COR.sec }}>não informado</Box> : '—'}</ValorFixo>
      </Box>
      <ValorFixo rotulo="Endereço do contratante" ajuda={cliente ? 'Preenchido pelo cadastro do cliente.' : undefined}>
        {cliente ? enderecoContratante(cliente) || <Box component="span" sx={{ fontWeight: 400, color: COR.sec }}>não informado no cadastro</Box> : '—'}
      </ValorFixo>

      <Secao nota="Onde o guindaste vai operar (pode ser outra empresa). Sai na ART e no procedimento.">Local da obra</Secao>
      <FormControlLabel control={<Checkbox checked={f.obraMesmoEndereco} onChange={(e) => set('obraMesmoEndereco', e.target.checked)} />} label="A obra é no próprio endereço do contratante" sx={{ mt: -1 }} />
      {!f.obraMesmoEndereco && (
        <>
          {locais.length > 0 && (
            <TextField select label="Local da obra" value={outroLocal ? 'outro' : String(iLocal)} onChange={(e) => escolherLocal(e.target.value)}
              helperText="Locais cadastrados para este contratante.">
              {locais.map((l, i) => <MenuItem key={l.nome} value={String(i)}>{l.nome} · {l.cidade}/{l.uf}</MenuItem>)}
              <MenuItem value="outro">Outro local (digitar)</MenuItem>
            </TextField>
          )}
          {outroLocal && (
            <>
              <Box sx={linhaGrade('minmax(0, 1fr) 170px')}>
                <TextField label="Empresa onde será a operação" value={f.obraNome} onChange={(e) => set('obraNome', e.target.value)} />
                <TextField label="CEP" value={f.obraCep} onChange={(e) => set('obraCep', e.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
              </Box>
              <Box sx={linhaGrade('minmax(0, 1fr) 200px 90px')}>
                <TextField label="Endereço da obra *" value={f.obraEndereco} onChange={(e) => set('obraEndereco', e.target.value)}
                  error={tentou && !obraOk} helperText={tentou && !obraOk ? 'Informe o endereço e a cidade da obra.' : undefined} />
                <TextField label="Cidade *" value={f.obraCidade} onChange={(e) => set('obraCidade', e.target.value)} error={tentou && !f.obraCidade.trim()} />
                <TextField label="UF" value={f.obraUf} onChange={(e) => set('obraUf', e.target.value.toUpperCase())} slotProps={{ htmlInput: { maxLength: 2 } }} />
              </Box>
            </>
          )}
        </>
      )}
      <Box sx={{ p: '10px 14px', border: `1px solid ${COR.borda}`, borderRadius: '3px', bgcolor: COR.cinza, fontSize: 14, color: '#3A465E' }}>
        Endereço da obra na ART: <b>{obraNaArt || '—'}</b>
        {!f.obraMesmoEndereco && !outroLocal && f.obraCep && <> · CEP {f.obraCep}</>}
      </Box>

      <Secao>Responsáveis e ART</Secao>
      <Box sx={{ ...linhaGrade('minmax(0, 1fr) minmax(0, 1fr) auto') }}>
        <Autocomplete freeSolo options={[sugestaoRigger]} inputValue={f.rigger} onInputChange={(_, v) => set('rigger', v)}
          renderInput={(params) => <TextField {...params} label="Rigger / supervisor responsável" helperText={`Supervisor e responsável técnico: ${cad.config.responsavel.nomeAssinatura} · ${cad.config.responsavel.crea}`} />} />
        <TextField label="Nº da ART do plano" value={f.art} onChange={(e) => set('art', e.target.value)} placeholder="13 dígitos"
          error={!!r.art.erro} helperText={r.art.erro ?? 'Pode ser preenchida depois; é exigida para emitir.'} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
        <Button variant="outlined" startIcon={<ContentCopy />} onClick={p.abrirArt} sx={{ height: 52, borderColor: COR.marinho, whiteSpace: 'nowrap' }}>Dados para a ART</Button>
      </Box>
      <Link component={RouterLink} to="/planos/lote" sx={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: 600 }}>Operação repetida? Criar vários planos iguais →</Link>
    </Box>
  );
}

// =============================================================================================
// Etapa 2 · Carga
// =============================================================================================

export function EtapaCarga({ f, set, r, tentou }: PropsEtapa) {
  const peso = r.campos.peso;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TituloEtapa titulo="Dados da carga" texto="O peso informado aqui é a carga líquida (massa, em kg) usada em todos os cálculos." />
      <TextField label="Descrição da carga" value={f.cargaDescricao} onChange={(e) => set('cargaDescricao', e.target.value)} placeholder="Ex.: Chiller" />
      <Box sx={linhaGrade('repeat(4, minmax(0, 1fr))')}>
        <CampoNum label="Comprimento (m)" valor={f.comprimento} mudar={(v) => set('comprimento', v)} campo={r.campos.comprimento} tentou={tentou} />
        <CampoNum label="Largura (m)" valor={f.largura} mudar={(v) => set('largura', v)} campo={r.campos.largura} tentou={tentou} />
        <CampoNum label="Altura (m)" valor={f.altura} mudar={(v) => set('altura', v)} campo={r.campos.altura} tentou={tentou} />
        <CampoNum label="Peso da carga (kg) *" valor={f.peso} mudar={(v) => set('peso', v)} campo={peso} tentou={tentou} destaque
          helperText={peso && Number.isFinite(peso.valor) ? `= ${fmt(peso.valor / 1000, 2)} t` : undefined} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: '14px 16px', bgcolor: '#F3F5F8', border: `1px solid ${COR.borda}`, borderRadius: '3px', fontSize: 14, color: '#3A465E' }}>
        <InfoOutlined sx={{ color: COR.azul, fontSize: 20 }} />
        <div>Tudo à direita é recalculado na hora: carga bruta (Pb), taxas do guindaste e dos acessórios, esforço nas sapatas e RMET. Taxa acima do limite ({LIMITE_PCT}%) ou valor vazio/fora da faixa bloqueia o plano. Decimais com vírgula (4,7); um ponto sem grupo de milhar é lido como decimal ("4.2" = 4,2).</div>
      </Box>
    </Box>
  );
}

// =============================================================================================
// Etapa 3 · Lingada
// =============================================================================================

const selNativo = { select: { native: true } } as const;
const celCab = { fontSize: 12, letterSpacing: '0.8px', py: 1, px: 1.25 };
const cel = { py: 0.75, px: 1.25, verticalAlign: 'top', fontSize: 14 };

function LinhaItem({ p, it, i }: { p: PropsEtapa; it: FormItemLingada; i: number }) {
  const { r, cad, f } = p;
  const calc = r.itens[i];
  const a = calc?.acessorio ?? null;
  const disponiveis = cad.acessorios.filter((x) => x.tipo !== 'dispositivo' && (x.situacao === 'uso' || x.id === it.acessorioId));
  const insp = a ? r.inspecoes.itens.find((x) => x.acessorio.id === a.id) : undefined;
  const vencidaOp = !!insp && !!r.dataOperacao.iso && !insp.naOperacao.aprovado;
  const diasHoje = insp?.hoje.dias ?? null;
  const breve = diasHoje != null && diasHoje <= 30;
  const inspTexto = a ? (a.situacao !== 'uso' ? `indisponível: ${insp?.naOperacao.texto ?? a.situacao}`
    : `inspeção até ${dataBR(a.proximaInspecao)}${a.vencimento ? ` · validade até ${dataBR(a.vencimento)}` : ''}${vencidaOp ? ` · ${insp?.naOperacao.motivo === 'validade' ? 'validade vencida' : 'vencida'} na data da operação` : breve ? ` · ${insp?.hoje.motivo === 'validade' ? 'validade vence' : 'vence'} em ${diasHoje} ${diasHoje === 1 ? 'dia' : 'dias'}` : ''}`) : '';
  const qtd = ajudaCampo(r.campos[`lingada.${i}.quantidade`], p.tentou || it.quantidade.trim() !== '');
  const capT = capacidadeDeTrabalho(a);
  const mudar = (patch: Partial<FormItemLingada>) => p.set('lingada', f.lingada.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remover = () => p.confirmar({ titulo: 'Remover item da lingada?', texto: `${a?.descricao ?? `Item ${i + 1}`} sai da lingada deste plano. O cadastro do acessório não muda.`, acao: 'Remover' },
    () => p.set('lingada', f.lingada.filter((_, j) => j !== i)));
  const nominal = a ? (a.tipo === 'manilha' ? a.norma : a.capacidadeT != null ? `nominal ${fmt(a.capacidadeT, casasDe(a.capacidadeT))} ${a.unidadeCapacidade}` : '') : '';
  return (
    <TableRow>
      <TableCell sx={cel}>
        <TextField select size="small" value={it.acessorioId ?? ''} onChange={(e) => mudar({ acessorioId: e.target.value === '' ? null : Number(e.target.value) })}
          slotProps={{ ...selNativo, htmlInput: { 'aria-label': `Acessório do item ${i + 1}` } }} error={!!calc?.erroAcessorio}>
          <option value="">Escolha…</option>
          {disponiveis.map((x) => <option key={x.id} value={x.id}>{x.descricao}{x.situacao !== 'uso' ? ' (indisponível)' : ''}</option>)}
        </TextField>
        {inspTexto && <Typography sx={{ fontSize: 12, mt: 0.5, color: vencidaOp || a?.situacao !== 'uso' ? COR.alertaTexto : breve ? COR.alertaTexto : COR.sec, fontWeight: vencidaOp ? 600 : 400 }}>{inspTexto}</Typography>}
      </TableCell>
      <TableCell sx={cel}>
        <TextField select size="small" value={it.posicao} onChange={(e) => mudar({ posicao: e.target.value as PosicaoLingada | '' })}
          slotProps={{ ...selNativo, htmlInput: { 'aria-label': `Posição na lingada do item ${i + 1}` } }} error={!!calc?.erroPosicao}>
          <option value="">Escolha…</option>
          {POSICOES.map((pos) => <option key={pos} value={pos}>{ROTULO_POSICAO[pos]}</option>)}
        </TextField>
        {calc?.erroPosicao && <Typography sx={{ fontSize: 12, mt: 0.5, color: COR.alertaTexto, fontWeight: 600 }}>{calc.erroPosicao}</Typography>}
      </TableCell>
      <TableCell sx={cel}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#3A465E', pt: '3px' }}>{a && Number.isFinite(capT) ? `${fmt(capT, 1)} ${a.unidadeCapacidade}` : '—'}</Typography>
        <Typography sx={{ fontSize: 12, color: COR.fraco }}>{nominal}</Typography>
      </TableCell>
      <TableCell sx={cel}>
        <TextField size="small" value={it.quantidade} onChange={(e) => mudar({ quantidade: e.target.value })} error={qtd.erro}
          slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Quantidade do item ${i + 1}` } }} />
        {qtd.texto && <Typography sx={{ fontSize: 12, mt: 0.5, color: qtd.erro ? COR.alertaTexto : COR.marinho, fontWeight: qtd.erro ? 600 : 400 }}>{qtd.texto}</Typography>}
      </TableCell>
      <TableCell sx={{ ...cel, pt: 1.5, color: '#3A465E' }}>{a ? fmt(a.pesoKg, 2) : '—'}</TableCell>
      <TableCell sx={{ ...cel, pt: 1.5, fontWeight: 600, color: COR.marinho }}>{fmt(calc?.pesoTotalKg ?? NaN, 2)}</TableCell>
      <TableCell sx={{ ...cel, px: 0.5 }}>
        <IconButton aria-label={`Remover item ${i + 1}`} onClick={remover} size="small" sx={{ color: COR.fraco, mt: 0.25 }}><DeleteOutline fontSize="small" /></IconButton>
      </TableCell>
    </TableRow>
  );
}

function TabelaTracoes({ r }: { r: PropsEtapa['r'] }) {
  return (
    <Box sx={{ border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'auto' }}>
      <Table size="small" aria-label="Tração por posição da lingada">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...celCab, width: 200 }}>POSIÇÃO · FÓRMULA</TableCell>
            <TableCell sx={celCab}>ACESSÓRIO QUE GOVERNA</TableCell>
            <TableCell sx={{ ...celCab, width: 84 }}>TRAÇÃO</TableCell>
            <TableCell sx={{ ...celCab, width: 90 }}>CAPACIDADE</TableCell>
            <TableCell sx={{ ...celCab, width: 112 }}>TAXA</TableCell>
            <TableCell sx={{ ...celCab, width: 128 }}>SITUAÇÃO</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {r.porPosicao.map((x) => (
            <TableRow key={x.posicao}>
              <TableCell sx={{ ...cel, verticalAlign: 'middle' }}>
                <Typography sx={{ fontWeight: 600, color: COR.marinho, fontSize: 14 }}>{ROTULO_POSICAO[x.posicao]}</Typography>
                <Typography sx={{ fontSize: 12, color: COR.sec }}>{x.formula}</Typography>
              </TableCell>
              <TableCell sx={{ ...cel, verticalAlign: 'middle', fontSize: 13, color: x.problema ? COR.alertaTexto : COR.texto, fontWeight: x.problema ? 600 : 400 }}>
                {x.problema ? `Bloqueado · ${x.problema}` : `${cap1(x.governante?.nomeCurto ?? '')}${x.quantidadeItens > 1 ? ` (menor capacidade entre ${x.quantidadeItens} itens)` : ''}`}
              </TableCell>
              <TableCell sx={{ ...cel, verticalAlign: 'middle' }}>{fmtUn(x.tracao, 2, x.unidade)}</TableCell>
              <TableCell sx={{ ...cel, verticalAlign: 'middle' }}>{x.problema ? '—' : fmtUn(x.capacidadeGovernante, 2, x.unidade)}</TableCell>
              <TableCell sx={{ ...cel, verticalAlign: 'middle', fontWeight: 700, color: corNivel(x.nivel) }}>{x.problema ? '—' : taxaTexto(x.taxaPct, x.nivel).replace(/^(Bloqueado|Atenção) · /, '')}</TableCell>
              <TableCell sx={{ ...cel, verticalAlign: 'middle' }}><ChipSituacao nivel={x.nivel} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export function EtapaLingada(p: PropsEtapa) {
  const { f, set, patch, r, cad, tentou } = p;
  const balancim = r.balancim;
  const dispositivos = cad.acessorios.filter((a) => a.tipo === 'dispositivo' && (a.situacao === 'uso' || a.id === f.dispositivoAcessorioId));
  const adicionar = () => {
    const primeiro = cad.acessorios.find((a) => a.tipo !== 'dispositivo' && a.situacao === 'uso');
    set('lingada', [...f.lingada, { acessorioId: primeiro?.id ?? null, quantidade: '1', posicao: '' }]);
  };
  const escolherDispositivo = (v: string) => {
    if (v === '') { patch({ dispositivoAcessorioId: null }); return; }
    const a = cad.acessorios.find((x) => x.id === Number(v));
    if (a) patch({ dispositivoAcessorioId: a.id, dispositivoDescricao: a.descricao, dispositivoPeso: numParaTexto(a.pesoKg) });
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TituloEtapa titulo="Lingada, amarras e dispositivos" texto="Escolha os acessórios do cadastro: peso e capacidade de trabalho vêm do cadastro (só leitura). Indique a posição de cada um na lingada." />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, p: '12px 14px', border: '1px solid #BCC6DA', borderRadius: '3px', bgcolor: '#F3F5F9', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <TextField select label="Tipo de içamento *" value={f.tipoIcamentoId} onChange={(e) => set('tipoIcamentoId', e.target.value)} sx={{ width: 340, flexShrink: 0 }}>
          {cad.tipos.map((t) => <MenuItem key={t.id} value={t.id}>{t.nome}{t.origem === 'exemplo' ? ' (exemplo)' : ''}</MenuItem>)}
        </TextField>
        <Typography sx={{ flexGrow: 1, fontSize: 13, color: '#3A465E' }}>{r.tipo ? `${r.tipo.descricao} ${r.tipo.balancim ? 'Pede os ângulos inferior e superior.' : 'Sem balancim: ângulo único das pernas.'}` : 'Tipo não cadastrado.'}</Typography>
        <Link component={RouterLink} to="/calculos/tipos" sx={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>Cadastrar tipo →</Link>
      </Box>
      {r.tipo?.avisoSemAcessorio && <Aviso>{r.tipo.avisoSemAcessorio}</Aviso>}

      <Box sx={{ border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'auto' }}>
        <Table size="small" aria-label="Acessórios da lingada" sx={{ tableLayout: 'fixed', minWidth: 660 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={celCab}>ACESSÓRIO (CADASTRO)</TableCell>
              <TableCell sx={{ ...celCab, width: 172 }}>POSIÇÃO</TableCell>
              <TableCell sx={{ ...celCab, width: 96 }}>CAP. TRABALHO</TableCell>
              <TableCell sx={{ ...celCab, width: 68 }}>QTD</TableCell>
              <TableCell sx={{ ...celCab, width: 66 }}>UNIT. (KG)</TableCell>
              <TableCell sx={{ ...celCab, width: 76 }}>TOTAL (KG)</TableCell>
              <TableCell sx={{ ...celCab, width: 44 }}><Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Remover</Box></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {f.lingada.map((it, i) => <LinhaItem key={i} p={p} it={it} i={i} />)}
            {f.lingada.length === 0 && (
              <TableRow><TableCell colSpan={7} sx={{ ...cel, color: COR.alertaTexto, fontWeight: 600 }}>Nenhum acessório na lingada. Adicione os itens do cadastro.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <Box sx={{ display: 'flex', alignItems: 'center', p: '8px 12px', borderTop: '1px solid #E4E8EE', bgcolor: '#FAFBFC' }}>
          <Button onClick={adicionar} sx={{ minHeight: 38, border: `1px dashed ${COR.bordaCampo}`, color: COR.marinho }}>+ Adicionar acessório</Button>
          <Box sx={{ flexGrow: 1 }} />
          <Typography sx={{ fontSize: 14, color: '#3A465E' }}>Peso total da lingada: <Box component="strong" sx={{ color: COR.marinho }}>{fmtUn(r.lingadaKg, 2, 'kg')}</Box></Typography>
        </Box>
      </Box>

      <Secao nota={<>P = carga + cargas extras ({fmtUn(r.pT, 2, 't')}): as cargas extras entram na tração das cintas e manilhas (premissa da equipe, a favor da segurança). Cada posição usa a menor capacidade entre os itens dela.</>}>{r.tipo?.geometria ?? 'Geometria da lingada'}</Secao>
      <Box sx={linhaGrade('repeat(3, minmax(0, 1fr))')}>
        {balancim ? (
          <>
            <CampoNum label="Ângulo pernas inferiores, ° (a partir da vertical)" valor={f.anguloInferior} mudar={(v) => set('anguloInferior', v)} campo={r.campos.anguloInferior} tentou={tentou} />
            <CampoNum label="Ângulo pernas superiores, ° (a partir da vertical)" valor={f.anguloSuperior} mudar={(v) => set('anguloSuperior', v)} campo={r.campos.anguloSuperior} tentou={tentou} />
          </>
        ) : (
          <CampoNum label="Ângulo das pernas, ° (a partir da vertical)" valor={f.anguloInferior} mudar={(v) => set('anguloInferior', v)} campo={r.campos.anguloInferior} tentou={tentou} />
        )}
        <Nota sx={{ pt: 0.75 }}>Faixa válida: 0° a 60°, medido a partir da vertical. Campo vazio não vale como 0°.</Nota>
      </Box>

      <TabelaTracoes r={r} />

      <Secao nota={balancim ? 'O balancim entra na carga bruta (Pb) e na tração das pernas superiores.' : 'Este tipo de içamento não usa balancim: ele não entra na carga bruta.'}>{balancim ? 'Balancim e cargas extras' : 'Cargas extras (sem balancim neste tipo)'}</Secao>
      <Box sx={linhaGrade(balancim ? 'minmax(0, 1fr) 110px 150px 170px' : '220px')}>
        {balancim && (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField select label="Dispositivo (cadastro)" value={f.dispositivoAcessorioId ?? ''} onChange={(e) => escolherDispositivo(e.target.value)}>
                <MenuItem value="">Outro (sem cadastro)</MenuItem>
                {dispositivos.map((a) => <MenuItem key={a.id} value={a.id}>{a.descricao}{a.situacao !== 'uso' ? ' (indisponível)' : ''}</MenuItem>)}
              </TextField>
              {f.dispositivoAcessorioId == null && <TextField label="Descrição do dispositivo" value={f.dispositivoDescricao} onChange={(e) => set('dispositivoDescricao', e.target.value)} />}
            </Box>
            <CampoNum label="Qtd (pç)" inteiro valor={f.dispositivoQtd} mudar={(v) => set('dispositivoQtd', v)} campo={r.campos.dispositivoQtd} tentou={tentou} />
            <CampoNum label="Peso unitário (kg)" valor={f.dispositivoPeso} mudar={(v) => set('dispositivoPeso', v)} campo={r.campos.dispositivoPeso} tentou={tentou} />
          </>
        )}
        <CampoNum label="Cargas extras (kg)" valor={f.extras} mudar={(v) => set('extras', v)} campo={r.campos.extras} tentou={tentou} />
      </Box>
    </Box>
  );
}

// =============================================================================================
// Etapa 6 · Revisão final
// =============================================================================================

export function EtapaRevisao({ r, irPara, podeMemorial }: Pick<PropsEtapa, 'r' | 'irPara'> & { podeMemorial: boolean }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TituloEtapa titulo="Revisão final" texto={<>
        <p>Todos os itens são conferidos com os dados atuais do plano. O plano só é emitido (e o PDF gerado) quando todos estiverem ok.</p>
        <p>Ordem do PDF: ficha de dados → desenhos → ART do plano → procedimento operacional → laudo e ART do guindaste.</p>
      </>} />
      <Box component="ul" aria-label="Itens da revisão" sx={{ m: 0, p: 0, listStyle: 'none', border: `1px solid ${COR.borda}`, borderRadius: '3px', overflow: 'hidden' }}>
        {r.checklist.map((c, i) => (
          <Box component="li" key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '9px 14px', borderTop: i ? '1px solid #E4E8EE' : 0 }}>
            <Box aria-hidden="true" sx={{ width: 26, height: 26, borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, boxSizing: 'border-box',
              ...(c.ok ? { bgcolor: COR.azul, color: '#fff' } : { bgcolor: COR.alertaFundo, color: COR.alertaTexto, border: `1.5px solid ${COR.alerta}` }) }}>{c.ok ? '✓' : '!'}</Box>
            <Box sx={{ flexGrow: 1, fontSize: 15, color: COR.texto, minWidth: 0 }}>
              <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{c.ok ? 'Ok: ' : 'Pendente: '}</Box>
              {c.rotulo} <Box component="span" sx={{ fontSize: 13, color: COR.sec }}>— {c.detalhe}</Box>
            </Box>
            {!c.ok && <Button variant="outlined" onClick={() => irPara(c.etapa as Etapa)} sx={{ minHeight: 36, flexShrink: 0, borderColor: COR.bordaCampo, fontSize: 13 }}>Ir para etapa {c.etapa}</Button>}
          </Box>
        ))}
      </Box>
      {r.motivosBloqueio.length > 0 && <Aviso titulo="Bloqueado">{cap1(r.motivosBloqueio.join('; '))}.</Aviso>}
      {r.situacaoSeguranca !== 'bloqueado' && r.checklist.every((c) => c.ok) && <Info>Tudo certo: o plano pode ser emitido. Depois de emitido ele fica somente leitura; para mudar algo, crie uma nova revisão.</Info>}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Button component={RouterLink} to="/planos/2607036" variant="outlined" sx={{ minHeight: 42, borderColor: COR.marinho }}>Ver exemplo de plano emitido (2607036)</Button>
        {podeMemorial && <Button component={RouterLink} to="/planos/2607036/memorial" variant="outlined" startIcon={<LockOutlined fontSize="small" />} sx={{ minHeight: 42, borderColor: COR.bordaCampo }}>Memorial do plano de referência (2607036)</Button>}
      </Box>
    </Box>
  );
}

