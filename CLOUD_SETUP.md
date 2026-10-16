# Store Bluebook data in MongoDB Atlas

The app now supports a private, single-user cloud workspace. MongoDB credentials stay in the Node backend, and the website uses a separate workspace password. The current local-only mode continues to work until cloud mode is enabled. Existing browser records are not deleted during migration.

## First, keep a backup

Open the existing app on the browser/device where your expenses are saved. Choose **Export data** on the dashboard or **Export all data as JSON** in Settings. Keep that file before changing the app's URL or storage mode: browser storage is tied to its original URL.

## Atlas configuration

1. Create or use a MongoDB Atlas cluster.
2. Create a **database user** with `readWrite` access to the `bluebook` database. This is separate from your Atlas account.
3. Add the backend's outbound IP addresses to the project's **Network Access / IP Access List**. For local testing, add your computer's public IP. Do not use unrestricted network access just to avoid setting up the list.
4. Choose **Connect → Drivers → Node.js** and copy the application connection string. Replace the username/password placeholders; URL-encode password characters that have special meaning in a URL.
5. Put the real string in `MONGODB_URI` in `.env.server` or your host's secret environment variables. Never put it in React code, any `VITE_` variable, Git, or a chat message.

Official guide: https://www.mongodb.com/docs/atlas/connect-to-database-deployment/

## Test from your computer

Copy `.env.server.example` to `.env.server` and fill in:

- `MONGODB_URI`: the private Atlas connection string.
- `MONGODB_DB`: `bluebook`.
- `APP_PASSWORD`: a separate workspace login password, at least 12 characters.
- `SESSION_SECRET`: a random secret at least 32 characters long. Keep it stable across restarts.
- `PUBLIC_ORIGIN`: `http://localhost:5173` (or the exact frontend URL you use).

Copy `.env.local.example` to `.env.local` to set `VITE_STORAGE_MODE=cloud`. These private files are ignored by Git. Do not overwrite an existing environment file without checking your own settings.

```sh
npm install
npm run server
```

In a second terminal, restart the frontend:

```sh
npm run dev
```

Visit http://localhost:5173 and sign in with `APP_PASSWORD`. An empty cloud workspace lets you **Upload this browser's data** or import the exported JSON file. The original browser data stays untouched. If cloud records already exist, they load directly; migration cannot replace them accidentally.

Once a save shows **Saved to cloud**, the backend has acknowledged the database write. Reload and check your records. Then open the same application URL on another device and sign in. Changing devices does not require the database connection string on the new device.

## Run on a cloud host

Use a host that supports a Node.js web service, not just static website hosting. This repository's Node server serves both the built React app and its private API on the same origin.

Set the host's environment variables:

```text
NODE_ENV=production
VITE_STORAGE_MODE=cloud
MONGODB_URI=<private Atlas connection string>
MONGODB_DB=bluebook
APP_PASSWORD=<private workspace password>
SESSION_SECRET=<private random secret, 32+ characters>
PUBLIC_ORIGIN=https://your-actual-website-url
```

Use Node.js 22.12+ on the host. Build with `npm ci && npm run build` and start with `npm start`. The server uses the host's `PORT` variable. `VITE_STORAGE_MODE=cloud` must be present at **build time** as well as runtime. Allow the host's documented outbound IP addresses in Atlas. HTTPS is required in production because the session cookie is Secure.

The frontend and API must share the same origin. The local Vite proxy handles this in development. Production uses the Node server to serve `dist/`; `npm run preview` alone does not run the API.

## Persistence, backups, and limits

- Cloud mode uses MongoDB as the source of truth. It does not silently switch to browser storage when offline; failed or unconfirmed saves keep the form open and show an error.
- Each save includes a version number. If another device/tab saved first, the stale save is rejected. Refresh to load the latest records. Automatic live updates are not implemented.
- Data is one versioned workspace document, suitable for a personal tracker. Uploads are limited to 10 MB. This design can later move transactions into separate collections.
- Login sessions expire after seven days. There is one shared workspace password and no multi-user account system or password recovery email.
- Cloud storage survives browser clearing, but no service is a guarantee against deletion or account loss. Keep JSON exports and configure Atlas backups appropriate to your plan. Backup availability depends on the cluster tier; no paid backup plan has been purchased or configured by this code.
- Tests cover API authorization, validation, revision conflicts, and client migration using test doubles. A live Atlas connection must be checked after you provide the URI privately in the environment file.
