"""Ajudas de serialização: números como Decimal na entrada e como número no JSON de saída."""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework import serializers

CASAS = 8
QUANTUM = Decimal(1).scaleb(-CASAS)


class Numero(serializers.Field):
    """Número do front (JSON number ou texto) → Decimal. Nunca passa por float binário no servidor:
    o JSON 4.87 vira Decimal('4.87'). Só corta ruído além de 8 casas (ex.: 0.30000000000000004)."""

    def __init__(self, **kwargs):
        kwargs.setdefault('allow_null', True)
        kwargs.setdefault('required', False)
        if not kwargs['required']:
            kwargs.setdefault('default', None)
        self.minimo = kwargs.pop('minimo', None)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        if isinstance(data, bool):
            self.fail('invalido')
        try:
            d = Decimal(str(data).strip())
        except (InvalidOperation, ValueError):
            self.fail('invalido')
        if not d.is_finite():
            self.fail('invalido')
        # O tamanho é conferido antes do quantize: com dígitos demais ele estouraria a precisão do Decimal (erro 500)
        if abs(d) >= Decimal('1e12'):
            self.fail('grande')
        if d.as_tuple().exponent < -CASAS:  # type: ignore[operator]
            d = d.quantize(QUANTUM)
        if self.minimo is not None and d < self.minimo:
            self.fail('minimo', minimo=self.minimo)
        return d

    def to_representation(self, value):
        return n(value)

    default_error_messages = {
        'invalido': 'Número inválido.',
        'grande': 'Número grande demais.',
        'minimo': 'Use um valor maior ou igual a {minimo}.',
    }


def n(v):
    """Decimal → número do JSON (int quando inteiro, senão float). None continua None."""
    if v is None:
        return None
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() and abs(v) < 2**53 else float(v)
    return v


def iso_data(d: date | None) -> str | None:
    return d.isoformat() if d else None


def iso_data_hora(dt: datetime | None, so_data: bool = False) -> str | None:
    """'aaaa-mm-ddThh:mm' na hora de Curitiba; 'aaaa-mm-dd' quando a hora não é conhecida."""
    if dt is None:
        return None
    local = timezone.localtime(dt) if timezone.is_aware(dt) else dt
    return local.strftime('%Y-%m-%d') if so_data else local.strftime('%Y-%m-%dT%H:%M')


def ler_data_hora(texto: str | None) -> tuple[datetime | None, bool]:
    """'2026-10-07T09:40' ou '2026-07-24' → (datetime com fuso de Curitiba, só_data)."""
    if not texto:
        return None, False
    s = str(texto)
    if len(s) == 10:
        return timezone.make_aware(datetime.fromisoformat(s)), True
    dt = datetime.fromisoformat(s)
    return (timezone.make_aware(dt) if timezone.is_naive(dt) else dt), False


class Texto(serializers.CharField):
    def __init__(self, **kwargs):
        kwargs.setdefault('allow_blank', True)
        kwargs.setdefault('required', False)
        kwargs.setdefault('default', '')
        kwargs.setdefault('trim_whitespace', False)
        super().__init__(**kwargs)


class Data(serializers.DateField):
    def __init__(self, **kwargs):
        kwargs.setdefault('allow_null', True)
        kwargs.setdefault('required', False)
        kwargs.setdefault('default', None)
        super().__init__(**kwargs)
