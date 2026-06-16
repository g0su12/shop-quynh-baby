# Quynh Baby Shop Website

Catalog website for a small offline children's fashion shop.

## Stack

- React + Vite for the public/admin UI.
- Cloudflare Workers Static Assets for hosting.
- Cloudflare Worker generated from the file-based `functions/` API routes.
- Cloudflare D1 for catalog data.
- Cloudflare R2 for product and try-on images.
- Cloudflare Turnstile for anti-spam forms later.

## Local Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and adjust values when needed.

`npm run dev` runs the Vite UI only. To test the complete Worker, static assets,
bindings, and admin login cookies, use:

```bash
npm run admin:setup:local
npm run cf:dev
```

The setup command asks for a local admin password and creates the ignored
`.dev.vars` file. Restart `npm run cf:dev` after changing `.dev.vars`.

## Admin Login

This project uses a single-admin login. There is no signup flow because the shop
only needs one manager account.

Generate a password hash:

```bash
npm run admin:hash -- "your strong admin password"
```

The script uses 100,000 PBKDF2 iterations because Cloudflare Workers rejects
higher PBKDF2 iteration counts at runtime.

Set these Cloudflare Worker secrets:

- `ADMIN_PASSWORD_HASH`: the generated `pbkdf2_sha256$...` value.
- `ADMIN_SESSION_SECRET`: a long random secret used to sign admin sessions.

For temporary production debugging, set `ADMIN_AUTH_DEBUG=1` on the Worker.
The login route writes structured `[admin-auth]` logs with only hash metadata
such as segment count, iteration validity, whitespace/quote flags, and cookie
security mode. Debug mode also includes a short non-reversible hash fingerprint
and password input metadata such as length/whitespace flags. It does not log the
admin password or the full password hash.
Failed login and missing-secret cases are logged even when debug mode is off.

Cloudflare dashboard secrets are not available on localhost. Wrangler loads
local secrets from `.dev.vars`.

The admin UI is available at `/admin`. Unauthenticated users are redirected to
`/admin/login` by the Worker middleware.

## Cloudflare Setup

1. Create a D1 database named `quynh-baby-shop`.
2. Replace `database_id` in `wrangler.toml`.
3. Create R2 buckets named `product-images` and `try-on-images`.

```bash
npx wrangler r2 bucket create product-images
npx wrangler r2 bucket create try-on-images
```

The buckets can remain private. Product images are served through the cached
`/api/product-images/:id` Pages Function.

4. Apply migrations:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

5. Deploy the Worker and static assets:

```bash
npm run deploy
```

For Cloudflare Workers Builds, use:

- Build command: `npm run build`
- Deploy command: `npm run deploy`

The build command creates both `dist` and the generated Worker entry point at
`.wrangler/functions-build/index.js`.

## Product Data

The catalog now uses D1 through these Worker routes:

- `GET /api/products`: public visible products.
- `GET /api/products/:slug`: public product detail by slug.
- `GET /api/admin/products`: complete admin catalog.
- `POST /api/admin/products`: create a product.
- `PUT /api/admin/products/:id`: replace product details and variants.
- `PATCH /api/admin/products/:id`: change public visibility.
- `DELETE /api/admin/products/:id`: delete a product, its variants, and uploaded images.
- `POST /api/admin/products/:id/images`: upload up to 6 product images.
- `PATCH /api/admin/product-images/:id`: select the primary image.
- `DELETE /api/admin/product-images/:id`: delete an image from D1 and R2.
- `GET /api/product-images/:id`: serve a cached public product image from R2.

Admin endpoints require the signed admin session cookie.

Useful local checks:

```bash
npm run db:migrate:local
npm run cf:functions:build
npm run cf:dev
```

Product uploads accept JPEG, PNG, and WebP sources up to 30 MB. The admin UI
automatically resizes sources over 5 MB to a maximum 1800 px edge, converts
them to WebP, and targets 4.5 MB before upload. The API keeps a strict 5 MB
limit as a final safeguard. Products without an uploaded image continue to use
the local catalog placeholder.
