FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
# Fonte com acentos e símbolos (≤, ÷, α…) para os PDFs do plano e do memorial.
# Retries: o espelho do Debian às vezes responde "Hash Sum mismatch" enquanto sincroniza; se ainda assim falhar,
# espere alguns minutos e rode o build de novo (ou use `docker compose up -d` sem --build, com a imagem que já existe).
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN useradd --create-home ribasrig && mkdir -p /dados/arquivos && chown -R ribasrig /dados
USER ribasrig

ENV RIBASRIG_ARQUIVOS_DIR=/dados/arquivos
EXPOSE 8000
# Migra o banco e sobe o servidor. O cenário de exemplo é carregado à parte (ver docs/backend.md na raiz).
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60"]
