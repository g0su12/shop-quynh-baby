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
4. Apply migrations:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

5. Deploy with Cloudflare Pages using `npm run build` and `dist` as the output directory.
