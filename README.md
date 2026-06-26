# 💶 Personal Expense Tracker

A full-stack personal finance manager built with **Node.js, Express and MySQL**.
Track income and expenses, manage recurring subscriptions, log investments and keep an
eye on a monthly savings goal — all from a clean single-page web interface.

![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

> Interface language is **Portuguese**; code, API and docs are in English.

---

## ✨ Features

- **Dashboard** — current balance at a glance (income − expenses).
- **Transactions** — full CRUD with description, amount, date and category; filter by month/year.
- **Subscriptions** — recurring payments (weekly / monthly / yearly). A processing endpoint
  turns due subscriptions into expense transactions and rolls the next payment date forward.
- **Investments** — logged and automatically mirrored as an expense transaction.
- **Physical cash** — track wallet cash separately from the bank balance.
- **Settings** — key/value store for things like the monthly salary check and savings goal.

## 🧱 Architecture

```
Browser (SPA)  ──fetch──▶  Express REST API  ──mysql2/promise──▶  MySQL
public/*                   server.js                              despesas DB
                           db.js (data-access layer)
```

- `server.js` — Express app + REST routes (thin controllers).
- `db.js` — data-access layer; parameterised queries via a connection pool (`mysql2/promise`).
- `public/` — vanilla HTML/CSS/JS single-page front end.
- `schema.sql` — database schema (tables, indexes, seed row).

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
**Database** · MySQL · **Frontend** · HTML · CSS · vanilla JavaScript

## 🗺️ Roadmap

- [ ] Authentication (multi-user)
- [ ] Charts for spending by category and month-over-month trends
- [ ] CSV export / import
- [ ] Automated tests for the data-access layer

---

<sub>Built as a personal finance project to practise full-stack development with Node.js and MySQL.</sub>
