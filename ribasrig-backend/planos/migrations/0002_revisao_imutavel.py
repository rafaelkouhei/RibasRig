"""Revisão emitida é imutável também no banco: UPDATE e DELETE em planos_revisao são recusados
pelo PostgreSQL, mesmo fora do Django (o documento foi assinado sob ART)."""
from django.db import migrations

CRIAR = """
CREATE OR REPLACE FUNCTION planos_revisao_imutavel() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Revisão emitida é imutável (plano %, Rev. %).', OLD.plano_id, OLD.numero;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planos_revisao_imutavel
    BEFORE UPDATE OR DELETE ON planos_revisao
    FOR EACH ROW EXECUTE FUNCTION planos_revisao_imutavel();
"""

DESFAZER = """
DROP TRIGGER IF EXISTS planos_revisao_imutavel ON planos_revisao;
DROP FUNCTION IF EXISTS planos_revisao_imutavel();
"""


class Migration(migrations.Migration):
    dependencies = [('planos', '0001_initial')]
    operations = [migrations.RunSQL(CRIAR, DESFAZER)]
