# 📱 Expense Tracker — Mobile (React Native + Expo)

A small, typed **React Native** client for the [Personal Expense Tracker](../README.md) REST API.
It shows how the same Express/MySQL back end can power a native app: a dashboard, a
month-filtered transaction list, an add/edit form and the list of active subscriptions.

![Expo](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Jest%20%2B%20RNTL-C21325?logo=jest&logoColor=white)

> UI copy is in **Portuguese (pt-PT)**, matching the web app. Code and docs are in English.

## Screenshots

| Dashboard | Transactions | Add / edit | Subscriptions |
|-----------|--------------|------------|---------------|
| _screenshot coming soon_ <!-- docs/dashboard.png --> | _screenshot coming soon_ <!-- docs/transactions.png --> | _screenshot coming soon_ <!-- docs/form.png --> | _screenshot coming soon_ <!-- docs/subscriptions.png --> |

## ✨ Features

- **Dashboard**: current balance, this month's income vs expenses and progress towards the
  monthly savings goal (`meta_poupanca`, set in the web app).
- **Transactions**: list filtered by month (previous/next month), monthly summary,
  pull-to-refresh; tap a row to edit.
- **Add / edit / delete transaction**: client-side validation (accepts `12,50` or `12.50`,
  rejects impossible dates such as `2026-02-30`), server errors shown inline.
- **Subscriptions**: active subscriptions with next payment date and an estimated monthly cost
  (weekly and yearly plans converted to a monthly figure).
- **Loading / empty / error states** on every screen, with a retry button. Data is fetched
  again whenever a screen gains focus, so lists are up to date after you save.

## 🧱 Architecture

```
src/
├── app/                      Expo Router (file-based routes)
│   ├── _layout.tsx           Root stack; the form opens as a modal
│   ├── (tabs)/               Bottom tabs: index (dashboard), transactions, subscriptions
│   └── transaction.tsx       Add (no params) / edit (?id=123) screen
├── api/
│   ├── types.ts              Wire DTOs (as the API sends them) and domain types (what the UI uses)
│   └── client.ts             Typed fetch client: mapping, timeouts, ApiError
├── components/               Button, Card, ProgressBar, MonthSelector, TransactionForm, …
├── hooks/useApiQuery.ts      Fetch on focus, ignore stale responses, pull-to-refresh state
├── lib/format.ts             pt-PT currency/date formatting, amount parsing, date helpers
└── theme/tokens.ts           Design tokens: colours (contrast-checked), spacing, radius, type scale
```

**API client.** `createApiClient({ baseUrl, fetchImpl })` is a factory, so tests inject a mock
`fetch` without global patching. It maps the API's Portuguese MySQL columns
(`tipo`, `descricao`, `valor`, …) into English domain objects, parses `DECIMAL` strings into
numbers, and turns MySQL `DATE` timestamps back into local `YYYY-MM-DD` dates so the day never
shifts by one across time zones. Network failures, timeouts (10 s) and non-2xx responses all
become an `ApiError` with a status and a message the UI can show.

## ♿ Accessibility

Built with WCAG 2.1 AA in mind:

- Every interactive element has an `accessibilityRole` and an `accessibilityLabel`. List rows
  are read as one sentence, for example "Despesa: Supermercado, 23,40 €, 12 de novembro de 2026 ·
  Casa", with a hint that tapping opens the editor.
- The income/expense selector is a `radiogroup` of `radio`s with `checked`/`disabled` state.
  Progress bars expose `progressbar` with min/max/now values.
- Form errors are shown next to each field, announced with `accessibilityRole="alert"` and live
  regions, and repeated in the field's hint. Submitting an invalid form announces a summary.
- Every text colour in [`tokens.ts`](src/theme/tokens.ts) is at least 4.5:1 against its
  background. Income and expense are never told apart by colour alone: the amount also has a
  `+`/`−` sign and the screen reader label says the type.
- Touch targets are at least 48 × 48. Font sizes are never locked and heights are `minHeight`,
  so layouts grow with the OS text size (Dynamic Type / Android font scale).

## 🚀 Running it

**Prerequisites:** Node.js 20+, the [Expo Go](https://expo.dev/go) app on your phone (or an
iOS Simulator / Android emulator), and the **back end running** (see the
[root README](../README.md#-getting-started); it listens on `http://localhost:3002`).

```bash
cd mobile
npm install
cp .env.example .env          # then set EXPO_PUBLIC_API_URL (see below)
npx expo start
```

Press `i` for the iOS Simulator, `a` for an Android emulator, `w` for web, or scan the QR code
with Expo Go.

### Pointing the app at the API

The base URL comes from `EXPO_PUBLIC_API_URL` (read at bundle time, so restart
`npx expo start` after you change it):

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| iOS Simulator / web | `http://localhost:3002` |
| Android emulator | `http://10.0.2.2:3002` |
| Physical phone (Expo Go) | `http://<your-computer-LAN-IP>:3002`, e.g. `http://192.168.1.20:3002` |

On a phone, `localhost` is the phone itself. Use your computer's LAN IP instead
(macOS: `ipconfig getifaddr en0`) and keep both devices on the same Wi-Fi network.
The API already enables CORS, so the web build works too.

## 🧪 Tests and checks

```bash
npm test             # Jest (jest-expo preset) + React Native Testing Library
npm run typecheck    # tsc --noEmit (strict)
```

- [`src/api/__tests__/client.test.ts`](src/api/__tests__/client.test.ts): URL and query
  building, DTO → domain mapping, request bodies (POST vs PUT), server error messages, non-JSON
  errors and network failures, all against a mocked `fetch`.
- [`src/components/__tests__/TransactionForm.test.tsx`](src/components/__tests__/TransactionForm.test.tsx):
  validation, comma decimals, switching type, edit-mode prefill and locked type, busy state.
  Queries go by role and accessible name (`getByRole('radio', { name: 'Receita' })`), so the
  tests also check the accessibility tree.
- [`src/lib/__tests__/format.test.ts`](src/lib/__tests__/format.test.ts): amount parsing, date
  validation and normalisation, pt-PT formatting, month arithmetic.

## 🗺️ Next steps

- Native date picker for the form
- Create/edit subscriptions and set the savings goal from the app
- Dark mode (tokens are already centralised)
- E2E flows with Maestro or Detox
