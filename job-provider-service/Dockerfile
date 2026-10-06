# AETHER optional JobSpy provider service.
# Deliberately minimal: no ML / MediaPipe dependencies, so this can fail
# without affecting ai-server (spec §8).
FROM python:3.11-slim

WORKDIR /service

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8010

# Disabled by default: sources must be explicitly opted into (spec §11).
ENV JOBSPY_ENABLED=false \
    JOBSPY_SOURCES= \
    JOBSPY_TIMEOUT_SECONDS=30 \
    PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8010/health', timeout=4).status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
