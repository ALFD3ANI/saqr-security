FROM python:3.11-slim

# تثبيت الأدوات الأساسية
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# تثبيت الـ dependencies أولاً (لأغراض الـ cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ الكود
COPY . .

# المستخدم غير root (أمان)
RUN useradd -m -u 1000 saqr && chown -R saqr:saqr /app
USER saqr

EXPOSE 8000

CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
