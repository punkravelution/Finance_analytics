This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## AI-ассистент

Плавающий чат «Финансовый ИИ» использует [Groq](https://groq.com/) (бесплатный тир).

1. Зарегистрируйтесь на [console.groq.com](https://console.groq.com/).
2. Создайте API key в разделе ключей.
3. В корне проекта создайте файл `.env.local` (см. пример в `.env.example`) и добавьте:
   - `DATABASE_URL` — строка подключения PostgreSQL (Neon);
   - `GROQ_API_KEY=gsk_...` — ключ Groq.

Перезапустите dev-сервер после изменения `.env.local`.

Первый раз после смены БД выполните: `npx prisma migrate dev` (применит миграции к Neon) и при необходимости `npm run db:seed`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Деплой на Vercel

1. Создайте проект базы данных на [neon.tech](https://neon.tech), скопируйте строку подключения `DATABASE_URL` (для продакшена удобно использовать вариант с **pooled** и `sslmode=require`).
2. Подключите репозиторий к [vercel.com](https://vercel.com) и создайте новый проект (фреймворк Next.js подхватится автоматически).
3. В настройках проекта Vercel → **Settings** → **Environment Variables** добавьте:
   - `DATABASE_URL` — строка от Neon;
   - `GROQ_API_KEY` — ключ из [console.groq.com](https://console.groq.com/).
4. Деплой: при сборке выполняются `prisma generate`, `prisma migrate deploy` и `next build` (см. `vercel.json` и скрипт `build` в `package.json`).
5. После деплоя откройте **Deployments** → последний деплой → **Building** / **Runtime Logs** и убедитесь, что миграции прошли без ошибок.

Локально перед пушем: `npx prisma generate`, затем задайте `DATABASE_URL` в `.env.local` и выполните `npx prisma migrate deploy` (или `migrate dev`) к Neon. Команда **`npm run build`** запускает `prisma migrate deploy` и поэтому тоже требует `DATABASE_URL`. Проверка только компиляции Next без миграций: `npx next build` (клиент Prisma подключается к БД лениво, при первом обращении).

## Deploy on Vercel (English)

The app targets the [Vercel Platform](https://vercel.com) with PostgreSQL (Neon). See the Russian section above for environment variables and build steps.

Further reading: [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
