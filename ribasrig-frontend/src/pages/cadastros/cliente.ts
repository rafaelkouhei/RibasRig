// Lógica pura da tela de Clientes: formulário, validação (CNPJ numérico e alfanumérico) e locais de obra.
import { cnpjValido, formatarCnpj, normalizarCnpj, somenteDigitos } from '../../domain/formatacao';
import type { Cliente, LocalObra } from '../../domain/types';

export interface FormCliente {
  razaoSocial: string; nomePasta: string; cnpj: string; endereco: string; cidade: string; uf: string; cep: string;
  contato: string; telefone: string; email: string;
  locais: LocalObra[];
}

export const LOCAL_VAZIO: LocalObra = { nome: '', endereco: '', cidade: '', uf: '', cep: '' };

export function formDoCliente(c: Cliente | null): FormCliente {
  if (!c) return { razaoSocial: '', nomePasta: '', cnpj: '', endereco: '', cidade: '', uf: '', cep: '', contato: '', telefone: '', email: '', locais: [] };
  return {
    razaoSocial: c.razaoSocial, nomePasta: c.nomePasta, cnpj: c.cnpj, endereco: c.endereco, cidade: c.cidade, uf: c.uf, cep: c.cep,
    contato: c.contato, telefone: c.telefone, email: c.email, locais: c.locaisObra.map((l) => ({ ...l })),
  };
}

/** CNPJ vazio = "CNPJ não informado" (permitido). Preenchido: 14 caracteres, numérico ou alfanumérico, DV conferido. */
export function erroCnpj(v: string): string | null {
  const c = normalizarCnpj(v);
  if (!c) return null;
  if (c.length !== 14) return `O CNPJ tem 14 caracteres (você digitou ${c.length}).`;
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c)) return 'Os 2 últimos caracteres (dígitos verificadores) são números.';
  return cnpjValido(c) ? null : 'CNPJ inválido: confira os dígitos verificadores.';
}

export const erroUf = (uf: string) => (!uf.trim() || /^[A-Za-z]{2}$/.test(uf.trim()) ? null : 'Use a sigla com 2 letras (ex.: PR).');
export const erroCep = (cep: string) => (!cep.trim() || somenteDigitos(cep).length === 8 ? null : 'O CEP tem 8 dígitos (ex.: 81460-000).');
export const erroEmail = (e: string) => (!e.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) ? null : 'E-mail inválido (ex.: compras@empresa.com.br).');

export const formatarCep = (cep: string) => { const d = somenteDigitos(cep); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep.trim(); };

export function errosCliente(f: FormCliente, tentou: boolean) {
  const e = {
    razaoSocial: tentou && !f.razaoSocial.trim() ? 'Informe a razão social.' : null,
    cnpj: erroCnpj(f.cnpj), uf: erroUf(f.uf), cep: erroCep(f.cep), email: erroEmail(f.email),
  };
  return { ...e, total: Object.values(e).filter(Boolean).length + (f.razaoSocial.trim() ? 0 : 1) };
}

export function errosLocal(l: LocalObra, tentou: boolean) {
  return {
    nome: tentou && !l.nome.trim() ? 'Informe a empresa / planta.' : null,
    endereco: tentou && !l.endereco.trim() ? 'Informe o endereço.' : null,
    cidade: tentou && !l.cidade.trim() ? 'Informe a cidade.' : null,
    uf: erroUf(l.uf) ?? (tentou && !l.uf.trim() ? 'Informe a UF.' : null),
    cep: erroCep(l.cep),
  };
}

/** "Av. Juscelino K. de Oliveira, 11800 · Cidade Industrial · Curitiba/PR · CEP 81460-000" */
export const enderecoLocal = (l: LocalObra) =>
  [l.endereco, l.cidade && `${l.cidade}${l.uf ? `/${l.uf}` : ''}`, l.cep && `CEP ${l.cep}`].filter(Boolean).join(' · ');

const pastaDe = (razao: string) => razao.replace(/\b(Ltda|S\.?A|S\/A|EIRELI|ME|EPP)\.?$/i, '').replace(/\b(Serviços Industriais|do Brasil)\b/gi, '').replace(/\s+/g, ' ').trim();

export function clienteDoForm(f: FormCliente, base: Cliente | null): Cliente {
  const cnpj = normalizarCnpj(f.cnpj);
  return {
    id: base?.id ?? 0,
    razaoSocial: f.razaoSocial.trim(),
    nomePasta: f.nomePasta.trim() || pastaDe(f.razaoSocial.trim()),
    cnpj: cnpj ? formatarCnpj(cnpj) : '',
    endereco: f.endereco.trim(), cidade: f.cidade.trim(), uf: f.uf.trim().toUpperCase(), cep: formatarCep(f.cep),
    locaisObra: f.locais.map((l) => ({ nome: l.nome.trim(), endereco: l.endereco.trim(), cidade: l.cidade.trim(), uf: l.uf.trim().toUpperCase(), cep: formatarCep(l.cep) })),
    contato: f.contato.trim(), telefone: f.telefone.trim(), email: f.email.trim(),
    exemplo: base?.exemplo ?? false,
  };
}
