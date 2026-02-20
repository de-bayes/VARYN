# Varis Marketing Site

Next.js 14 App Router project with TypeScript + Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Scripts

- `npm run dev` - local development server
- `npm run build` - production build
- `npm run start` - run built app (binds `0.0.0.0` and uses `PORT`)
- `npm run lint` - Next.js lint checks

## Deploying to Railway

This repo is ready for Railway with Nixpacks:

- `railway.json` defines build (`npm ci && npm run build`) and deploy (`npm run start`) commands.
- The app reads `PORT` from Railway and binds to `0.0.0.0`.
- `.nvmrc` and `package.json#engines` pin Node.js 20+ for consistent deploys.

You can deploy directly from the GitHub repo in Railway without additional changes.
