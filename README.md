# Ludo en ligne — React + Django

Ludo multijoueur temps réel (2, 3 ou 4 joueurs), plusieurs parties simultanées, comptes, **soldes en Ariary**, **mises**, **rooms privées payantes** et **panneau d'administration**.

- **Backend** : Django, Django REST Framework, Django Channels + Daphne (WebSocket)
- **Frontend** : React + Vite

## Installation

### Backend
```bash
cd backend
python -m venv venv && venv\Scripts\activate        # Linux/Mac : source venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations game
python manage.py migrate
python manage.py createsuperuser                     # compte administrateur
python manage.py runserver 8000
```
> Si vous mettez à jour depuis une version précédente : supprimez `backend/db.sqlite3` et `backend/game/migrations/0*.py`, puis relancez `makemigrations game` et `migrate`.

### Frontend
```bash
cd frontend
npm install
npm run dev                                          # http://localhost:5173
```

## Fonctionnement

**Parties simultanées** : chaque partie est indépendante (son propre canal WebSocket). Autant de parties que le serveur peut en gérer tournent en parallèle.

**Match rapide** : le joueur choisit 2/3/4 joueurs et une mise (ou gratuit). Les joueurs ayant choisi *exactement les mêmes* réglages sont regroupés au hasard.

**Rooms privées** : un joueur crée une room (frais fixés par l'admin, non remboursables), puis invite ses amis par **code**, **lien** (`/?room=CODE`) ou **pseudo** (notification en direct dans leur salon). La partie démarre quand la room est pleine.

**Argent** :
- Les mises sont débitées au démarrage de la partie (si un joueur n'a plus les fonds, il est écarté et les autres restent en attente).
- Cagnotte = mise × nombre de joueurs. Le jeu prélève `commission %` (arrondi à l'inférieur), le vainqueur reçoit le reste. Ex. 2 joueurs, mise 1 000 Ar, commission 10 % : cagnotte 2 000 Ar, gagnant **1 800 Ar**.
- Chaque mouvement est enregistré dans un journal (`Transaction`) ; les opérations sont atomiques (verrous en base) et le solde ne peut pas devenir négatif.
- Une partie en cours bloquée peut être annulée par l'admin : toutes les mises sont remboursées.

**Panneau admin** (bouton « Admin » dans le salon, réservé aux comptes `is_staff` / superuser) :
- Vue d'ensemble : commissions gagnées, frais de rooms, soldes, parties en cours ; **tarif des rooms, % de commission, mises min/max, bonus d'inscription**.
- Joueurs : recherche, créditer / débiter un solde (avec note, ex. « dépôt MVola »), bloquer / débloquer.
- Parties : historique, annulation + remboursement. Transactions : journal complet.
- L'interface Django classique reste disponible sur `/admin/` (http://localhost:8000/admin/).

## Dépôts et retraits
Il n'y a **pas de paiement automatique** : l'admin crédite le solde après réception d'un paiement (MVola, Orange Money, Airtel Money…) et le débite lors d'un retrait. Une intégration d'API de paiement peut s'ajouter plus tard.

## Avant une mise en ligne
- Les jeux d'argent sont encadrés par la loi : vérifiez les licences et obligations applicables (âge minimum, vérification d'identité, etc.).
- La file de matchmaking est en mémoire : lancez **un seul processus** Daphne, ou adaptez la file vers Redis. Définissez `REDIS_URL` pour utiliser `channels_redis`.
- Passez à PostgreSQL pour la production (SQLite ne gère pas les verrous de ligne).
- Changez `DJANGO_SECRET_KEY`, mettez `DJANGO_DEBUG=0`, renseignez `DJANGO_ALLOWED_HOSTS`, servez en HTTPS.
