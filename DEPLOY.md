# Déployer sur Render

Tout tourne dans **un seul service web** (Django sert l'API, les WebSockets et le frontend compilé) + **une base PostgreSQL**.

1. **Générer les migrations en local** (une fois, et à chaque changement de modèle) puis les versionner :
   ```bash
   cd backend
   pip install -r requirements.txt
   python manage.py makemigrations game
   ```
   Le fichier `backend/game/migrations/0001_initial.py` doit être commité.
2. **Pousser le projet sur GitHub** (la racine du dépôt est le dossier `ludo/`, qui contient `render.yaml`) :
   ```bash
   git init && git add . && git commit -m "Ludo en ligne"
   git branch -M main
   git remote add origin https://github.com/VOTRE_COMPTE/ludo.git
   git push -u origin main
   ```
3. Sur https://dashboard.render.com : **New → Blueprint**, choisissez le dépôt, puis saisissez la valeur de `DJANGO_SUPERUSER_PASSWORD` (mot de passe de l'admin) et validez.
4. Attendez la fin du build (quelques minutes). Ouvrez l'adresse `https://ludo-xxxx.onrender.com` et connectez-vous avec `admin` et ce mot de passe : le bouton **Admin** apparaît dans le salon.

## Tester PostgreSQL en local (facultatif)
```bash
set DATABASE_URL=postgres://utilisateur:motdepasse@localhost:5432/ludo     # Linux/Mac : export ...
python manage.py migrate
```
Sans `DATABASE_URL`, le projet utilise SQLite.

## À savoir
- Offre gratuite : le service s'endort après 15 minutes sans trafic (réveil d'environ 1 minute) et la base PostgreSQL gratuite expire au bout de 30 jours. Pour garder les données, passez la base (et le service) sur une offre payante.
- Un seul service : la file de matchmaking est en mémoire, ne lancez pas plusieurs instances.
- Variables utiles : `DJANGO_SECRET_KEY` (générée automatiquement), `CSRF_TRUSTED_ORIGINS` (si vous utilisez votre propre domaine, ex. `https://jeu.mondomaine.com`), `DJANGO_ALLOWED_HOSTS`.
