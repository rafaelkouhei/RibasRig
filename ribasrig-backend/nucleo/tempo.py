"""'Hoje' e 'agora' das regras de negócio.

Com RIBASRIG_HOJE definido (demonstração), a data é fixa e a hora vem do relógio, como `agora()` no
mock do front. Sem ele, vale a data real de Curitiba.
"""
from datetime import date, datetime

from django.conf import settings
from django.utils import timezone


def hoje() -> date:
    if settings.RIBASRIG_HOJE:
        return date.fromisoformat(settings.RIBASRIG_HOJE)
    return timezone.localdate()


def agora() -> datetime:
    if settings.RIBASRIG_HOJE:
        local = timezone.localtime()
        return timezone.make_aware(datetime.combine(hoje(), local.time().replace(microsecond=0)))
    return timezone.now()
