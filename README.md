# 📊 KPI Qapten

Dashboard de suivi des indicateurs clés pour Qapten.

## Métriques suivies

- **MRR** (Monthly Recurring Revenue)
- **Utilisateurs** BYOK (8€/mo) et abonnés Qapten IA (24€/mo)
- **Marge nette**
- **Profit**
- **Coûts variables** (par abonné Qapten)
- **Coûts infrastructure** (serveurs + fixes)

## Installation

### Local

```bash
npm install
npm start
```

Accès → `http://localhost:5089`

### Docker

```bash
docker build -t kpi-qapten .
docker run -d -p 5089:5089 kpi-qapten
```

## Branches

- `main` → stable
- `staging` → développement en cours
