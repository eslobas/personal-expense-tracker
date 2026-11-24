# 💶 Personal Expense Tracker

A full-stack personal finance manager built with **Node.js, Express and MySQL**.
Track income and expenses, manage recurring subscriptions, log investments and keep an
eye on a monthly savings goal — from a clean single-page web interface or the
**React Native mobile app** in [`mobile/`](mobile/README.md).

![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-Expo-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-blue)

> Interface language is **Portuguese**; code, API and docs are in English.

## 📦 What's in this repo

The project has three clients. Each one lives in its own folder and can run on its own.

| Folder | What it is | Stack | Data |
|---|---|---|---|
| [`web/`](web/README.md) | **Online multi-user PWA** (the version deployed on Netlify): magic-link login, per-user data isolation with Row-Level Security, charts, recurring entries, search, CSV export, account deletion, installable | JavaScript · Supabase (Auth, PostgreSQL, RLS) · PWA | Supabase |
| [`mobile/`](mobile/README.md) | **React Native app**: dashboard, month-filtered transactions, add/edit form, subscriptions; accessible and tested | React Native · Expo Router · TypeScript · Jest + RNTL | Express API below |
| `server.js` · `db.js` · `public/` | **Original self-hosted version**: REST API and single-page web UI | Node.js · Express · MySQL | MySQL |

The web PWA is the newest and most complete version. The mobile app talks to the Express API, so run the server first (see *Getting started*).

---

## ✨ Features

- **Dashboard** — current balance at a glance (income − expenses).
- **Transactions** — full CRUD with description, amount, date and category; filter by month/year.
- **Subscriptions** — recurring payments (weekly / monthly / yearly). A processing endpoint
  turns due subscriptions into expense transactions and rolls the next payment date forward.
- **Investments** — logged and automatically mirrored as an expense transaction.
- **Physical cash** — track wallet cash separately from the bank balance.
- **Settings** — key/value store for things like the monthly salary check and savings goal.
- **Mobile app** — React Native + Expo client (TypeScript, Expo Router) with a dashboard,
  month-filtered transactions, add/edit form and subscriptions. Accessible and tested with
  Jest + React Native Testing Library. See [`mobile/README.md`](mobile/README.md).

## 🧱 Architecture

```
Browser (SPA)  ──fetch──┐
public/*                │
                        ├──▶  Express REST API  ──mysql2/promise──▶  MySQL
Mobile app     ──fetch──┘     server.js                              despesas DB
mobile/ (Expo)                db.js (data-access layer)
```

- `server.js` — Express app + REST routes (thin controllers).
- `db.js` — data-access layer; parameterised queries via a connection pool (`mysql2/promise`).
- `public/` — vanilla HTML/CSS/JS single-page front end.
- `schema.sql` — database schema (tables, indexes, seed row).
- `mobile/` — React Native (Expo) client consuming the same REST API.

## 🔌 API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/balance` | Current balance |
| `GET` | `/api/transactions?tipo&mes&ano` | List / filter transactions |
| `POST` | `/api/transactions` | Create a transaction |
| `PUT` | `/api/transactions/:id` | Update a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `GET` | `/api/monthly-totals?mes&ano` | Income/expense totals for a month |
| `GET/POST` | `/api/physical-cash` | Read / set wallet cash |
| `GET/POST/PUT/DELETE` | `/api/subscriptions` | Manage subscriptions |
| `POST` | `/api/subscriptions/process` | Charge due subscriptions |
| `GET/POST/PUT/DELETE` | `/api/investments` | Manage investments |
| `GET/POST` | `/api/settings/:key` | Read / write settings |

## 🚀 Getting started

**Prerequisites:** Node.js 18+ and a running MySQL 8 server.

```bash
# 1) Install dependencies
npm install

# 2) Create the database and tables
mysql -u root -p < schema.sql

# 3) Configure environment
cp .env.example .env        # then edit DB_USER / DB_PASSWORD

# 4) Run
npm run dev                 # http://localhost:3002
```

### 📱 Mobile app

With the API running:

```bash
cd mobile
npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3002 on a real phone
npx expo start
```

Full details (emulators, physical devices, tests) in [`mobile/README.md`](mobile/README.md).

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | HTTP port |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | `` | MySQL password |
| `DB_NAME` | `despesas` | Database name |

## 🛠️ Tech stack

**Backend** · Node.js · Express · mysql2 (connection pool, parameterised queries) ·
**Database** · MySQL · **Frontend** · HTML · CSS · vanilla JavaScript ·
**Mobile** · React Native · Expo · Expo Router · TypeScript · Jest · React Native Testing Library

## 🗺️ Roadmap

- [ ] Authentication (multi-user)
- [ ] Charts for spending by category and month-over-month trends
- [ ] CSV export / import
- [ ] Automated tests for the data-access layer

---

<sub>Built as a personal finance project to practise full-stack development with Node.js and MySQL.</sub>
