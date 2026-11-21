"""python manage.py carregar_exemplo — carrega o cenário de demonstração (o mesmo mock do front).

Cria os usuários de teste giuliano.breda (Administrador) e rigger.campo (Operação) com a senha de
RIBASRIG_SENHA_TESTE (ou uma aleatória, mostrada uma vez). Só roda em banco sem planos nem clientes:
para recomeçar, apague o volume do banco (docker compose down -v).
"""
import os
from datetime import date

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from cadastros.models import (
    Acessorio, Cliente, EventoAcessorio, Guindaste, Laudo, LocalObra, PadraoInspecao, PontoGrafico, RegistroInspecao, RegraCalculo,
    RegraDoTipo, TabelaCapacidade, TipoIcamento, VersaoRegra,
)
from cenario import exemplo as X
from contas.servicos import gerar_senha_provisoria
from motor.plano import resultados_da_revisao
from nucleo.campos import ler_data_hora
from nucleo.models import Configuracoes
from planos import servicos as S
from planos.entrada import aplicar_dados, ler_dados
from planos.models import EventoHistorico, PlanoRigging, Revisao, UsoCadastro


def _d(v):
    return date.fromisoformat(v) if v else None


class Command(BaseCommand):
    help = 'Carrega o cenário de exemplo (plano 2607036 e cadastros) num banco vazio.'

    @transaction.atomic
    def handle(self, *args, **opcoes):
        if PlanoRigging.objects.exists() or Cliente.objects.exists():
            raise CommandError('O banco já tem dados. O cenário de exemplo só é carregado num banco vazio.')
        senha = self._usuarios()
        self._configuracoes()
        self._regras_e_tipos()
        self._clientes()
        self._guindastes()
        self._acessorios()
        self._planos()
        self._usos()
        with connection.cursor() as c:
            for sql in connection.ops.sequence_reset_sql(no_style(), [Cliente, Guindaste, Acessorio, PlanoRigging]):
                c.execute(sql)
        self.stdout.write(self.style.SUCCESS('Cenário de exemplo carregado: planos 2607036, 2610001 e 2610002.'))
        if senha:
            self.stdout.write(f'Senha dos usuários de teste (giuliano.breda, rigger.campo): {senha}  ← anote; não aparece de novo.')

    def _usuarios(self) -> str | None:
        Usuario = get_user_model()
        senha_env = os.environ.get('RIBASRIG_SENHA_TESTE', '').strip()
        senha = senha_env or gerar_senha_provisoria()
        criou = False
        for u in X.USUARIOS:
            if Usuario.objects.filter(username=u['usuario']).exists():
                continue
            novo = Usuario(username=u['usuario'], nome=u['nome'], perfil=u['perfil'], principal=u['principal'], observacao=u['observacao'])
            novo.set_password(senha)
            novo.save()
            criou = True
        return senha if criou and not senha_env else None

    def _configuracoes(self) -> None:
        c, cfg = Configuracoes.atual(), X.CONFIGURACOES
        c.pasta_raiz, c.nome_arquivo = cfg['pasta_raiz'], cfg['nome_arquivo']
        for k, v in cfg['empresa'].items():
            setattr(c, f'empresa_{k}', v)
        for k, v in cfg['responsavel'].items():
            setattr(c, f'responsavel_{k}', v)
        c.aviso_atencao_pct, c.vento_padrao_ms = cfg['aviso_atencao_pct'], cfg['vento_padrao_ms']
        c.save()
        for p in X.PADROES_INSPECAO:
            PadraoInspecao.objects.create(tipo=p['tipo'], referencia=p['referencia'], itens=p['itens'], atualizado_em=None)

    def _regras_e_tipos(self) -> None:
        for i, r in enumerate(X.REGRAS):
            campos = {k: v for k, v in r.items() if k not in ('versoes', 'planos')}
            regra = RegraCalculo.objects.create(**campos, criada_em_ordem=i + 1)
            for v in r['versoes']:
                quando, so_data = ler_data_hora(v['salva_em'])
                VersaoRegra.objects.create(regra=regra, versao=v['versao'], formula=v['formula'], variaveis=v['variaveis'],
                                           salva_em=quando, salva_em_so_data=so_data, autor=v['autor'])
        for i, t in enumerate(X.TIPOS_ICAMENTO):
            campos = {k: v for k, v in t.items() if k not in ('regras', 'planos')}
            tipo = TipoIcamento.objects.create(**campos, criado_em_ordem=i + 1)
            RegraDoTipo.objects.bulk_create([RegraDoTipo(tipo=tipo, regra_id=rid, ordem=j) for j, rid in enumerate(t['regras'])])

    def _clientes(self) -> None:
        for c in X.CLIENTES:
            campos = {k: v for k, v in c.items() if k != 'locais_obra'}
            cliente = Cliente.objects.create(**campos)
            for i, l in enumerate(c['locais_obra']):
                LocalObra.objects.create(cliente=cliente, ordem=i, **l)

    def _guindastes(self) -> None:
        for g in X.GUINDASTES:
            campos = {k: v for k, v in g.items() if k not in ('laudos', 'tabelas')}
            guindaste = Guindaste.objects.create(**campos)
            for i, l in enumerate(g['laudos']):
                Laudo.objects.create(guindaste=guindaste, ordem=i, inicio=_d(l['inicio']), fim=_d(l['fim']), art=l['art'], arquivo=l['arquivo'], atual=l['atual'])
            for i, t in enumerate(g['tabelas']):
                tab = TabelaCapacidade.objects.create(guindaste=guindaste, chave=t['id'], ordem=i, nome=t['nome'])
                PontoGrafico.objects.bulk_create([PontoGrafico(tabela=tab, **p) for p in t['pontos']])

    def _acessorios(self) -> None:
        datas = ('ultima_inspecao', 'proxima_inspecao', 'data_entrada', 'vencimento')
        for a in X.ACESSORIOS:
            campos = {k: (_d(v) if k in datas else v) for k, v in a.items() if k not in ('inspecoes', 'historico', 'planos')}
            acessorio = Acessorio.objects.create(**campos)
            for insp in reversed(a['inspecoes']):
                RegistroInspecao.objects.create(acessorio=acessorio, data=_d(insp['data']), responsavel=insp['responsavel'],
                                                resultado=insp['resultado'], itens=insp['itens'], observacao=insp['observacao'],
                                                proxima=_d(insp['proxima']))
            EventoAcessorio.objects.bulk_create([EventoAcessorio(acessorio=acessorio, data=_d(e['data']), descricao=e['descricao'])
                                                 for e in reversed(a['historico'])])

    def _planos(self) -> None:
        for dados in X.PLANOS:
            criado_em, so_data = ler_data_hora(dados['criado_em'])
            p = PlanoRigging(id=dados['id'], numero=dados['numero'], criado_em=criado_em, criado_em_so_data=so_data,
                             criado_por=dados['criado_por'], atualizado_em=ler_data_hora(dados['atualizado_em'])[0])
            p.save()
            aplicar_dados(p, ler_dados(dados))
            anexos = dados['anexos']
            p.anexo_desenhos, p.anexo_art_plano, p.anexo_arquivo_art = anexos['desenhos'], anexos['art_plano'], anexos['arquivo_art']
            p.situacao_documento = dados['situacao_documento']
            p.save()
            for rev in dados['revisoes']:
                emitida_em, so_data = ler_data_hora(rev['emitida_em'])
                resultados = rev['resultados']
                entradas = None
                if resultados is None:  # Rev. 2: calculada pelo motor, nunca digitada
                    r = S.calcular(p)
                    resultados, entradas = resultados_da_revisao(r), S.entradas_da_revisao(p, r)
                Revisao.objects.create(plano=p, numero=rev['numero'], emitida_em=emitida_em, emitida_em_so_data=so_data,
                                       emitida_por=rev['emitida_por'], origem=rev['origem'],
                                       cadastrada_em=ler_data_hora(rev['cadastrada_em'])[0], resultados=resultados, entradas=entradas,
                                       arquivo_pdf=rev['arquivo_pdf'], observacao=rev['observacao'])
        por_numero = {p.numero: p for p in PlanoRigging.objects.all()}
        for e in X.EVENTOS:
            EventoHistorico.objects.create(plano=por_numero[e['plano_numero']], tipo=e['tipo'], titulo=e['titulo'], detalhe=e['detalhe'],
                                           usuario=e['usuario'], quando=ler_data_hora(e['quando'])[0])

    def _usos(self) -> None:
        por_numero = {p.numero: p for p in PlanoRigging.objects.all()}
        usos = [UsoCadastro(plano=por_numero[n], tipo='acessorio', ref=str(a['id'])) for a in X.ACESSORIOS for n in a['planos']]
        usos += [UsoCadastro(plano=por_numero[n], tipo='tipo', ref=t['id']) for t in X.TIPOS_ICAMENTO for n in t['planos']]
        usos += [UsoCadastro(plano=por_numero[n], tipo='regra', ref=r['id']) for r in X.REGRAS for n in r['planos']]
        UsoCadastro.objects.bulk_create(usos)
