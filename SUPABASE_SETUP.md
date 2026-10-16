# Supabase accounts and Vercel hosting

The app supports Supabase email/password accounts, password recovery, editable profile names, and a private expense workspace per account. Vercel hosts the React frontend. Supabase hosts Auth and PostgreSQL. The existing MongoDB mode remains available until you switch; no data is automatically deleted or transferred.

## 1. Create the Supabase project and get the connection details

1. Open https://supabase.com/dashboard and sign in.
2. Choose **New project**, select your organization, enter a project name (for example `bluebook`), set a strong database password, and choose a region near you. Wait for provisioning to finish.
3. Open the project's **Connect** dialog. Copy the **Project URL** (`https://YOUR_PROJECT_REF.supabase.co`) and **publishable key** (`sb_publishable_...`). You can also find these under **Settings → API Keys** / **Data API**. A legacy **anon** key is supported too.
4. These two values may be used in the frontend. Never put your database password, `service_role` key, or `sb_secret_...` key in a `VITE_` variable, source code, or chat.

## 2. Create the private database table

Open **SQL Editor → New query** in the Supabase project. Paste and run the entire file:

`supabase/migrations/202610150001_workspaces.sql`

Run this initial migration once on a new project. It creates `workspaces`, enables Row Level Security, permits users to read only their own row, and creates `save_workspace` for authenticated writes with atomic revision checks. Anonymous users cannot read or write records. Direct client inserts/updates/deletes are not allowed; the function uses the authenticated user ID internally.

## 3. Configure authentication

Under **Authentication → Sign In / Providers**, enable email/password sign-ins and sign-ups. Keep email confirmation enabled. Set the minimum password length to **12** to match the sign-up form.

Under **Authentication → URL Configuration**:

- For initial local testing, use Site URL `http://localhost:5173`.
- Add `http://localhost:5173` to allowed redirect URLs.
- After deploying, set Site URL to your final `https://...vercel.app` URL (or custom domain) and add that exact URL to allowed redirect URLs. The app sends email confirmation and recovery links back to its origin.

For public sign-ups, configure your own SMTP provider under Auth email settings. Supabase's default email sender is restricted and is intended for testing; see the official SMTP guide below. Without working email delivery, confirmation and password recovery cannot be used by general users.

## 4. Switch local development when ready

First export all expenses from the existing MongoDB app using **Export data**. Keep the JSON file.

Edit `.env.local` using `.env.supabase.example` as the template:

```dotenv
VITE_STORAGE_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Then run `npm run dev`. Supabase mode does not require `npm run server` or MongoDB credentials. Sign up, confirm your email, sign in, and import the exported JSON in the new-workspace screen. Import is offered only for an account with no saved workspace. You can alternatively import this browser's local records or start fresh. Old MongoDB/browser records remain untouched.

Each account has its own data; other users start with an empty workspace. Profile names are stored in Supabase Auth user metadata. Profile email is displayed read-only. Sign-out removes access to the workspace until the user signs in again. Concurrent stale saves are rejected, and records are not silently replaced.

## 5. Deploy the frontend to Vercel

1. Put this project in a Git repository and push it to your Git provider. Environment files are ignored; do not commit credentials. If the repository contains other projects, select this expense-tracker folder as Vercel's **Root Directory**.
2. In https://vercel.com/new, import the repository and choose **Vite**.
3. Set **Build Command** to `npm run build` and **Output Directory** to `dist` (`vercel.json` already declares both). Use Node.js 22.12+.
4. Add the three `VITE_` variables from step 4 to Vercel's **Environment Variables**, for Production and any Preview environments you want to use. They must exist at build time. Do not add MongoDB credentials or Supabase secret/service keys.
5. Deploy. Add the resulting production URL in Supabase Auth URL Configuration as described above.
6. Redeploy whenever changing a `VITE_` variable, since Vite embeds it during the build. Only the frontend runs on Vercel; the old Express server is not needed in Supabase mode.

## 6. Verify before moving your everyday use

- Sign up with a real email, confirm it, and sign in.
- Open **Profile** in the sidebar, mobile navigation, or dashboard avatar; save your name and reload to verify it persists.
- Import your backup or add an expense. Reload and confirm the record remains.
- Sign in on another device and check the same records.
- Create a second account and confirm it sees its own empty workspace, never the first account's data.
- Request a password reset and confirm the email link opens the new-password form.

Account UI tests use mocked Supabase responses. The migration is also tested in a local PostgreSQL engine (PGlite) for anonymous access, per-user isolation, direct-write restrictions, and revision conflicts. Live authentication, email delivery, database isolation, and the deployed site still require verification against your actual project.

Official references:

- Project keys: https://supabase.com/docs/guides/api/api-keys
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Email/password Auth: https://supabase.com/docs/guides/auth/passwords
- SMTP setup: https://supabase.com/docs/guides/auth/auth-smtp
- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
