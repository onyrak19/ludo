# --- 1. Compilation du frontend React ---
FROM node:20-alpine AS front
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- 2. Backend Django + frontend compilé ---
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=front /app/dist ./frontend_dist
RUN python manage.py collectstatic --noinput

# Au démarrage : migrations, création de l'admin (si DJANGO_SUPERUSER_* sont définies), puis serveur ASGI
CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py createsuperuser --noinput || true) && daphne -b 0.0.0.0 -p ${PORT:-10000} --proxy-headers config.asgi:application"]
