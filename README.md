# AgriAdmin

## Setup
```bash
npm i
cp .env.example .env
npm run dev
```

- Sign in: http://localhost:3000/signin
- Pages: /top, /field_list, /report_list, /user_list
- Proxy: POST /graphql (forwards to GRAPHQL_ENDPOINT)

## Notes
- Login/Logout is handled by Express routes (`/signin`, `/signout`) using the `users` table in MySQL.
- Passwords must be stored as bcrypt hashes.
- For Node.js environments without `fetch` (Node <= 17), `node-fetch` is used as a polyfill.
- Proxy: `POST /graphql` forwards to `GRAPHQL_ENDPOINT` (adjust your front-end queries in `public/js/pages/*.js`).
