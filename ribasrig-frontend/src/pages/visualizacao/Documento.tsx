import { createContext, useContext, type ReactNode } from 'react';
import { Box } from '@mui/material';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import { enderecoObra } from '../../domain/art';
import { fmt } from '../../domain/formatacao';
import type { Acessorio, Cliente, Configuracoes, Guindaste, PlanoRigging } from '../../domain/types';
import { comoDigitado, type ValoresFicha } from './vistas';
import logoCompleto from '../../assets/logo-ribas-completo.png';

/** Liga o destaque amarelo dos dados preenchidos pelo sistema. */
export const DestaqueCtx = createContext(true);

/** Dado preenchido pelo sistema (destacado quando a chave está ligada). */
function V({ children }: { children: ReactNode }) {
  const on = useContext(DestaqueCtx);
  return <Box component="span" sx={on ? { bgcolor: '#FFF1B8', boxShadow: '0 0 0 1px #E0B84C' } : undefined}>{children}</Box>;
}

const folha = { width: 540, minHeight: 764, bgcolor: '#FFFFFF', boxSizing: 'border-box', boxShadow: '0 6px 24px rgba(31, 42, 64, 0.18)', display: 'flex', flexDirection: 'column', flexShrink: 0 } as const;
const cel = { border: '1px solid #1F2A40', padding: '2px 4px' } as const;
const centro = { ...cel, textAlign: 'center' } as const;
const tituloBloco = { fontWeight: 700, fontSize: 10 } as const;

function Linha({ k, children }: { k: string; children: ReactNode }) {
  return <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '6px', whiteSpace: 'nowrap' }}><span>{k}</span><b>{children}</b></Box>;
}

export interface PropsFicha {
  plano: PlanoRigging;
  cliente: Cliente | null;
  guindaste: Guindaste | null;
  acessorios: Acessorio[];
  config: Configuracoes;
  valores: ValoresFicha;
}

/** Pág. 1 — ficha de dados (antes feita no Excel), com todos os campos do modelo. */
export function FichaDados({ plano, cliente, guindaste, acessorios, config, valores: v }: PropsFicha) {
  const itens = plano.lingada.map((l) => {
    const a = acessorios.find((x) => x.id === l.acessorioId) ?? null;
    return { ...l, a, total: a ? l.quantidade * a.pesoKg : NaN };
  });
  const disp = plano.dispositivo;
  const dispTotal = (disp.quantidade ?? NaN) * (disp.pesoUnitarioKg ?? NaN);
  const resp = config.responsavel;
  const g = guindaste;
  return (
    <Box sx={{ ...folha, p: '26px 28px', fontSize: 9, color: '#111827', gap: '6px', fontFamily: 'Arial, Helvetica, sans-serif', '& table': { borderCollapse: 'collapse', width: '100%' } }}>
      <Box sx={{ display: 'flex', border: '1.5px solid #111827' }}>
        <Box sx={{ width: 170, borderRight: '1.5px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'center', p: '6px', flexShrink: 0 }}>
          <img src={logoCompleto} alt="Guindastes Ribas" style={{ width: 120, height: 68, objectFit: 'contain' }} />
        </Box>
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', borderBottom: '1px solid #111827', p: '3px 6px', gap: '6px' }}><b>CLIENTE:</b><V>{cliente?.razaoSocial ?? '—'}</V></Box>
          <Box sx={{ display: 'flex', borderBottom: '1px solid #111827', p: '3px 6px', gap: '6px' }}>
            <b>LOCAL:</b><V>{enderecoObra(plano.obra, cliente) || '—'}</V><Box sx={{ flexGrow: 1 }} /><b>DATA:</b><Box component="span" sx={{ whiteSpace: 'nowrap' }}><V>{v.data}</V></Box>
          </Box>
          <Box sx={{ p: '8px 6px', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>PLANO DE RIGGING nº <V>{plano.numero}</V></Box>
        </Box>
      </Box>

      <Box sx={tituloBloco}>DADOS DA CARGA:</Box>
      <table>
        <thead><tr><th style={{ ...cel, width: '50%', textAlign: 'left' }}>Descrição da carga</th><th style={cel}>Comp. (m)</th><th style={cel}>Largura (m)</th><th style={cel}>Altura (m)</th><th style={cel}>Peso (kg)</th></tr></thead>
        <tbody><tr>
          <td style={cel}><V>{plano.carga.descricao || '—'}</V></td>
          <td style={centro}><V>{comoDigitado(plano.carga.comprimentoM)}</V></td>
          <td style={centro}><V>{comoDigitado(plano.carga.larguraM)}</V></td>
          <td style={centro}><V>{comoDigitado(plano.carga.alturaM)}</V></td>
          <td style={centro}><V>{v.liq}</V></td>
        </tr></tbody>
      </table>

      <Box sx={tituloBloco}>LINGADA / AMARRAS</Box>
      <table>
        <thead><tr><th style={{ ...cel, width: 26 }}>Item</th><th style={{ ...cel, textAlign: 'left' }}>Descrição</th><th style={cel}>Qtd.</th><th style={cel}>Unit. (kg)</th><th style={cel}>Total (kg)</th></tr></thead>
        <tbody>
          {itens.map((i, k) => (
            <tr key={k}>
              <td style={centro}>{k + 1}</td>
              <td style={cel}><V>{i.a ? `${i.a.descricao}${i.a.norma ? ` - ${i.a.norma}` : ''}` : 'Acessório não encontrado no cadastro'}</V></td>
              <td style={centro}><V>{i.quantidade}</V></td>
              <td style={centro}><V>{comoDigitado(i.a?.pesoKg)}</V></td>
              <td style={centro}><V>{comoDigitado(i.total)}</V></td>
            </tr>
          ))}
          {!itens.length && <tr><td style={centro} colSpan={5}>Sem itens de lingada</td></tr>}
          <tr><td style={{ ...cel, textAlign: 'right' }} colSpan={4}><b>PESO TOTAL DA LINGADA / AMARRAÇÃO:</b></td><td style={{ ...centro, fontWeight: 700 }}><V>{v.lingada}</V></td></tr>
        </tbody>
      </table>

      <Box sx={tituloBloco}>DISPOSITIVOS / BALANCIM</Box>
      <table>
        <tbody><tr>
          <td style={{ ...centro, width: 26 }}>{itens.length + 1}</td>
          <td style={cel}><V>{disp.descricao || '—'}</V></td>
          <td style={{ ...centro, width: 40 }}><V>{comoDigitado(disp.quantidade)}</V></td>
          <td style={{ ...centro, width: 60 }}><V>{comoDigitado(disp.pesoUnitarioKg)}</V></td>
          <td style={{ ...centro, width: 60, fontWeight: 700 }}><V>{comoDigitado(dispTotal)}</V></td>
        </tr></tbody>
      </table>

      <Box sx={{ ...tituloBloco, borderTop: '1.5px solid #111827', pt: '4px' }}>INFORMAÇÕES DO GUINDASTE</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 12px' }}>
        <div>Modelo <b><V>{g?.modelo ?? '—'}</V></b></div><div>Placas <b><V>{g?.placa || '—'}</V></b></div>
        <div>Caminhão <b><V>{g?.veiculo || '—'}</V></b></div><div>Ano de fabricação <b><V>{g?.ano ?? '—'}</V></b></div>
        <div>Chassi <b><V>{g?.chassi || '—'}</V></b></div>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', borderTop: '1.5px solid #111827', pt: '4px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <Box sx={{ ...tituloBloco, textAlign: 'center' }}>CONFIGURAÇÃO DO GUINDASTE</Box>
          <Linha k="Capacidade nominal"><V>{fmt(g?.capacidadeNominalT, 1)}</V> t</Linha>
          <Linha k="Comprimento da lança"><V>{fmt(plano.comprimentoLancaM ?? g?.comprimentoLancaM, 1)}</V> m</Linha>
          <Linha k="Raio de operação"><V>{v.raio}</V> m</Linha>
          <Linha k="Capacidade de carga"><V>{v.capCarga}</V> t</Linha>
          <Linha k="Quadrante operacional">Inicial <V>{plano.quadranteInicial.toUpperCase() || '—'}</V> · Final <V>{plano.quadranteFinal.toUpperCase() || '—'}</V></Linha>
          <Box sx={{ ...tituloBloco, textAlign: 'center', mt: '4px' }}>RESUMO DOS CÁLCULOS</Box>
          <Linha k="Total da carga bruta"><V>{v.pbT}</V> t</Linha>
          <Linha k="Capacidade do guindaste"><V>{v.cap}</V> t</Linha>
          <Linha k="Taxa de utilização do guindaste"><V>{v.taxa}</V> %</Linha>
          <Linha k="Taxa de utilização da cinta plana"><V>{v.cinta}</V> %</Linha>
          <Linha k="Taxa de utilização da cinta tubular">{v.tubular === '–' ? '–' : <V>{v.tubular}</V>} %</Linha>
          <Linha k="Taxa de utiliz. laço de cabo de aço">{v.laco === '–' ? '–' : <V>{v.laco}</V>} %</Linha>
          <Linha k="Taxa de utilização da manilha"><V>{v.manilha}</V> %</Linha>
          <Linha k="Esforço nas sapatas"><V>{v.es}</V> kgf</Linha>
          <Linha k="Resistência mínima do terreno"><V>{v.rmet}</V> kgf/cm²</Linha>
          <Linha k="Raio de isolamento"><V>{v.isolamento}</V> m</Linha>
          <Linha k="Velocidade máxima do vento"><V>{v.vento}</V> m/s</Linha>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <Box sx={{ ...tituloBloco, textAlign: 'center' }}>COMPOSIÇÃO DA CARGA BRUTA</Box>
          <Linha k="Carga líquida"><V>{v.liq}</V> kg</Linha>
          <Linha k="Lingada / Amarração"><V>{v.lingada}</V> kg</Linha>
          <Linha k="Dispositivos / Balancim"><V>{v.dispositivos}</V> kg</Linha>
          <Linha k="Cargas extras">{v.extras === '–' ? '–' : <V>{v.extras}</V>} kg</Linha>
          <Linha k="Carga bruta"><V>{v.pb}</V> kg</Linha>
          <Box sx={{ border: '1.5px solid #111827', mt: '6px', flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', p: '8px' }}>
            <Box component="span" sx={{ fontSize: 8, alignSelf: 'flex-start' }}>Observações / Anexos:</Box>
            <Box component="b" sx={{ fontSize: 12 }}>ART {plano.art ? <V>{plano.art}</V> : <Box component="span" sx={{ color: '#566075', fontWeight: 400 }}>ainda não informada</Box>}</Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', gap: '30px', pt: '8px' }}>
        <Box sx={{ flex: 1, borderTop: '1px solid #111827', textAlign: 'center', pt: '3px' }}>Rigger <V>{resp.nomeAssinatura} · {resp.rpp}</V></Box>
        <Box sx={{ flex: 1, borderTop: '1px solid #111827', textAlign: 'center', pt: '3px' }}>Supervisor responsável <V>{resp.nomeAssinatura} · {resp.crea}</V></Box>
      </Box>
    </Box>
  );
}

/** Págs. 6–7 — procedimento operacional: modelo da empresa + dados do plano (destacados). */
export function Procedimento({ plano, cliente, guindaste, config, isolamento }: { plano: PlanoRigging; cliente: Cliente | null; guindaste: Guindaste | null; config: Configuracoes; isolamento: string }) {
  const emp = config.empresa;
  const sec = { fontWeight: 700, fontSize: 11, mt: '4px' } as const;
  const ref = { color: '#374151' } as const;
  return (
    <Box sx={{ ...folha, p: '26px 34px', fontSize: 10, color: '#111827', gap: '8px', fontFamily: 'Calibri, Arial, sans-serif' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #111827', pb: '8px' }}>
        <img src={logoCompleto} alt="Guindastes Ribas" style={{ width: 110, height: 62, objectFit: 'contain' }} />
        <Box sx={{ flexGrow: 1, textAlign: 'center' }}><Box sx={{ fontSize: 17, fontWeight: 700 }}>Procedimento</Box><Box sx={{ fontWeight: 700 }}>Içamento <V>{plano.carga.descricao || '—'}</V></Box></Box>
        <Box sx={{ textAlign: 'center', fontSize: 9 }}>ART<br /><b>{plano.art ? <V>{plano.art}</V> : '—'}</b><br />RIGGING<br /><b><V>{plano.numero}</V></b></Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr)', gap: '2px 8px', p: '4px 0 6px', borderBottom: '1px solid #D1D5DB' }}>
        <b>Contratante:</b><span><V>{cliente?.razaoSocial ?? '—'}</V></span>
        <b>Local da obra:</b><span><V>{enderecoObra(plano.obra, cliente) || '—'}</V></span>
      </Box>
      <Box sx={{ ...sec, mt: 0 }}>1. ISOLAMENTO DA ÁREA</Box>
      <div><b>Objetivo:</b> Garantir segurança de pessoas e equipamentos durante a operação.</div>
      <div>• Delimitar e sinalizar a área de risco num raio de <b><V>{isolamento}</V> m</b> a partir do centro de giro do guindaste.<br />• Impedir circulação de pessoas não autorizadas.<br />• Verificar ausência de interferências: rede elétrica, estruturas, veículos.<br />• Liberar área somente após checagem.</div>
      <Box sx={ref}>Referências: NR-18.5.3 / NR-18.4.2(a) · NR-11.7.1 / NR-11.7.2 · NR-18.15.47</Box>
      <Box sx={sec}>2. PATOLAMENTO DO GUINDASTE <V>{guindaste?.codigo ?? '—'}</V></Box>
      <div><b>Objetivo:</b> Garantir estabilidade e segurança do equipamento de içamento.</div>
      <div>• Posicionar o guindaste conforme plano.<br />• Avaliar capacidade do solo (RMET) e posicionar os dormentes.<br />• Estender e nivelar estabilizadores a 100%.</div>
      <Box sx={ref}>Referências: NR-18.14.22 / NR-18.14.24 · NR-11.5.1 · NR-18.14.4</Box>
      <Box sx={sec}>3. POSICIONAMENTO DO VEÍCULO DE CARGA</Box>
      <div>• Aproximar carreta ou veículo guiado pelo sinaleiro.<br />• Acionar freio, calçar rodas e desligar motor.<br />• Garantir espaço para manobra do gancho e acesso à carga.</div>
      <Box sx={sec}>4. IÇAMENTO DA CARGA</Box>
      <div>• Verificar cintas, manilhas e pontos de ancoragem.<br />• Montar amarração conforme plano de rigging.<br />• Realizar elevação de teste (10–20 cm).<br />• Elevar carga lentamente, mantendo comunicação com sinaleiro.</div>
      <Box sx={sec}>5. DESCARGA DA CARGA</Box>
      <div>• Aproximar lentamente da posição de apoio.<br />• Baixar carga de forma controlada.<br />• Garantir apoio estável antes de soltar amarrações.</div>
      <Box sx={{ mt: 'auto', borderTop: '1px solid #9CA3AF', pt: '4px', fontSize: 8, color: '#4B5563' }}>
        {emp.razaoSocial} · {emp.endereco} · CEP {emp.cep} · CNPJ {emp.cnpj} · IE {emp.ie}
      </Box>
    </Box>
  );
}

/** Páginas que entram no PDF sem alteração (desenhos, ART, laudo). `pendente` = ainda falta para emitir. */
export function PaginaAnexo({ titulo, linhas, nota, pendente }: { titulo: string; linhas: string[]; nota: string; pendente?: string | null }) {
  return (
    <Box sx={{ ...folha, p: '34px' }}>
      <Box sx={{ flexGrow: 1, border: '2px dashed #B9C2D2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#34446A', textAlign: 'center', p: '20px' }}>
        <InsertDriveFileOutlined sx={{ fontSize: 48 }} aria-hidden />
        <Box sx={{ fontSize: 18, fontWeight: 600 }}>{titulo}</Box>
        {linhas.map((l) => <Box key={l} sx={{ fontSize: 14, color: '#5A6478' }}>{l}</Box>)}
        {pendente && <Box sx={{ fontSize: 14, fontWeight: 600, color: '#8A3F04', bgcolor: '#FBE1C6', px: 1.5, py: 0.75, borderRadius: '3px' }}>{pendente}</Box>}
        <Box sx={{ fontSize: 13, color: '#566075', maxWidth: 360 }}>{nota}</Box>
      </Box>
    </Box>
  );
}
