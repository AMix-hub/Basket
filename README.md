This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Miljövariabler / Environment Variables

Det här projektet använder [Supabase](https://supabase.com) som backend och kräver två miljövariabler för att fungera:

| Variabel | Beskrivning |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Projektets URL från Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik anon-nyckel från Supabase |

Du hittar värdena i [Supabase Dashboard](https://app.supabase.com) under **Project Settings → API**.

### Driftsättning via Vercel (rekommenderat)

Om du kör projektet via **GitHub + Vercel** behöver du **inte** köra några lokala kommandon.
Lägg istället till variablerna direkt i Vercel-dashboarden:

1. Gå till ditt projekt på [vercel.com](https://vercel.com)
2. Välj **Settings → Environment Variables**
3. Lägg till de två variablerna ovan med dina riktiga värden
4. Gör en ny deploy (eller tryck **Redeploy**) – Vercel hämtar automatiskt värdena

### Lokal utveckling (valfritt)

Om du någon gång vill köra projektet på din egen dator:

1. Kopiera `.env.example` till `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Fyll i dina riktiga värden i `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ditt-projekt-id>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<din-anon-nyckel>
   ```

> **OBS:** `.env.local` är undantagen från git (via `.gitignore`) och ska aldrig committas till repot.

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
