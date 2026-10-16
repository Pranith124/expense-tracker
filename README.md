# Bluebook expense tracker

A working personal expense tracker with an original blue and cyan design, built with React, TypeScript, Tailwind CSS, and Vite.

## Run locally

Requires Node.js 20.19+ (or Node.js 22.12+) and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

```sh
npm test
npm run build
npm run preview
```

## Features

- Start empty, add and edit expenses with category, local date, optional time, exact rupee amounts, and remarks.
- Delete expenses from the edit page with a required reason and confirmation. Totals update after saving; the reason and deletion date are preserved in JSON exports.
- Month-specific totals, weekday spending heatmap with day and transaction dialogs, and top five category bars.
- Per-month category budgets, previous-month allocation copying, negative remaining budgets, missing-budget labels, and configurable status percentages.
- Separate configurable daily spending thresholds for heatmap colors.
- Category creation and renaming; transaction search by remarks, category filtering, newest-first sorting, and 10/25/50 row pagination.
- Desktop table and mobile transaction cards, keyboard-accessible dialogs, confirmation messages, and JSON data export.
- Phone layout with labeled bottom navigation, a prominent remaining-budget card, a sticky month selector, larger touch controls, and bottom-sheet dialogs. The layout switches automatically at widths up to 760px; desktop navigation and tables remain available on larger screens.

## Data and limitations

For **Supabase email sign-up/sign-in, editable profiles, private per-user data, and Vercel deployment**, follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Use `VITE_STORAGE_MODE=supabase` after configuring the project. The existing local and MongoDB modes remain supported; export your existing records before switching.

By default this is a single-user app using browser localStorage. Data survives refreshes in the same browser and origin, but **does not sync across devices**. Clearing site data or using private browsing may remove it. JSON export provides a portable copy of all stored data.

An optional **MongoDB Atlas cloud mode** now provides an authenticated Node/Express backend, cross-device access, conflict-safe writes, and migration from this browser or an exported JSON backup. Follow [CLOUD_SETUP.md](CLOUD_SETUP.md). Until its private connection settings are configured and cloud mode is enabled, your app continues saving locally. There is no bank integration or multi-user account system.

`src/storage.ts` isolates persistence from the UI. `src/domain.ts` owns the shared calculations. Amounts are stored as integer paise, dates as local `YYYY-MM-DD` strings, and blank times remain blank. Budgets are keyed by month and stable category ID, so renaming categories keeps their transaction and budget history intact.

Saving budgets or thresholds validates all values first. Copying previous allocations only stages them in the editor; Save applies them to the selected month. Search and category filtering affect the transaction list only, while summaries continue to show the full month. A transaction edit opens its resulting month after saving, and the previous month is recalculated from the same transaction source.
