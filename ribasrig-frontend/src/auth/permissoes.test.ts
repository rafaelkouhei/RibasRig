import { describe, expect, it } from 'vitest';
import { PERMISSOES, pode } from './permissoes';
import { acaoDaRota } from './RequireAuth';
import { lerSessao } from './AuthContext';

describe('permissões', () => {
  it('matriz de Usuários', () => {
    expect(pode('operacao', 'consultarPlanos')).toBe(true);
    expect(pode('operacao', 'verMemorial')).toBe(false);
    expect(pode('engenheiro', 'verMemorial')).toBe(true);
    expect(pode('engenheiro', 'gerenciarUsuarios')).toBe(false);
    expect(pode('admin', 'alterarConfiguracoes')).toBe(true);
    expect(pode(null, 'consultarPlanos')).toBe(false);
  });
  it('administrador inclui tudo do engenheiro', () => {
    for (const p of PERMISSOES) if (p.perfis.includes('engenheiro')) expect(p.perfis).toContain('admin');
  });
  it('rotas restritas', () => {
    expect(acaoDaRota('/usuarios')).toBe('gerenciarUsuarios');
    expect(acaoDaRota('/planos/2607036/memorial')).toBe('verMemorial');
    expect(acaoDaRota('/planos/novo')).toBe('editarRascunhos');
    expect(acaoDaRota('/planos/2607036')).toBeNull();
    expect(acaoDaRota('/calculos/regras')).toBeNull();
  });
});

describe('sessão salva', () => {
  it('formato inválido = sem sessão', () => {
    expect(lerSessao(null)).toBeNull();
    expect(lerSessao('texto')).toBeNull();
    expect(lerSessao({ usuario: { nome: 'X', perfil: 'chefe' } })).toBeNull();
  });
  it('formato antigo (com e-mail) continua valendo', () => {
    expect(lerSessao({ token: 't', usuario: { id: 1, nome: 'Giuliano Breda', email: 'g@x', perfil: 'admin' } })).toMatchObject({ nome: 'Giuliano Breda', perfil: 'admin', usuario: '' });
  });
});
