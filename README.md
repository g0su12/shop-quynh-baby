# Quynh Baby Shop Website

Catalog website for a small offline children's fashion shop.

## Stack

- React + Vite for the public/admin UI.
- Cloudflare Pages for hosting.
- Cloudflare Pages Functions/Workers for API.
- Cloudflare D1 for catalog data.
- Cloudflare R2 for product and try-on images.
- Cloudflare Turnstile for anti-spam forms later.

## Local Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and adjust values when needed.

`npm run dev` runs the Vite UI only. To test Cloudflare Pages Functions such as
admin login cookies, use:

```bash
npm run cf:dev
```

## Admin Login

This project uses a single-admin login. There is no signup flow because the shop
only needs one manager account.

Generate a password hash:

```bash
npm run admin:hash -- "your strong admin password"
```

Set these Cloudflare Pages environment variables:

- `ADMIN_PASSWORD_HASH`: the generated `pbkdf2_sha256$...` value.
- `ADMIN_SESSION_SECRET`: a long random secret used to sign admin sessions.

The admin UI is available at `/admin`. Unauthenticated users are redirected to
`/admin/login` in Cloudflare Pages.

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

5. Deploy with Cloudflare Pages using `npm run build` and `dist` as the output directory.

## Product Data

The catalog now uses D1 through these Pages Functions:

- `GET /api/products`: public visible products.
- `GET /api/admin/products`: complete admin catalog.
- `POST /api/admin/products`: create a product.
- `PUT /api/admin/products/:id`: replace product details and variants.
- `PATCH /api/admin/products/:id`: change public visibility.
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

Product uploads accept JPEG, PNG, and WebP files up to 5 MB each. Products
without an uploaded image continue to use the local catalog placeholder.
