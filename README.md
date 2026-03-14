This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Miljövariabler / Environment Variables

Det här projektet använder [Firebase](https://firebase.google.com) som backend (Authentication + Firestore) och kräver sju miljövariabler för att fungera:

| Variabel | Beskrivning |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API-nyckel |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase autentiseringsdomän |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase projekt-ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage-bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Analytics mätnings-ID (valfritt) |

Du hittar alla värden i [Firebase Console](https://console.firebase.google.com) under **Project Settings → General → Your apps**.

### Konfigurera Firebase

1. Gå till [Firebase Console](https://console.firebase.google.com) och skapa ett nytt projekt
2. Lägg till en **Web-app** i projektet och kopiera konfigurationsvärden
3. Aktivera **Authentication** → Email/Password
4. Skapa en **Firestore Database** (börja i produktionsläge)
5. Distribuera säkerhetsreglerna i `firestore.rules` via Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,storage
   ```
6. Lägg till `sport-iq.se` (och din eventuella Vercel-URL) som auktoriserade domäner i Firebase:
   - Gå till **Authentication → Settings → Authorized domains**.
   - Klicka **Add domain** och ange `sport-iq.se`.
   - Klicka **Add domain** en gång till och ange din Vercel-URL, t.ex. `ditt-projekt.vercel.app`.

> **OBS:** Utan steg 6 kommer inloggningen att misslyckas på den deployade appen.

### Anpassa authDomain till sport-iq.se

Firebase använder `authDomain` för OAuth-omdirigeringar (popup/redirect-flöden). För att använda din egna domän `sport-iq.se`:

1. Se till att `sport-iq.se` är tillagd som **Authorized domain** (se steg 6 ovan).
2. Sätt `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sport-iq.se` i din `.env.local` (och i Vercel → Settings → Environment Variables).
3. Konfigurera Firebase Hosting för `sport-iq.se` om du vill att OAuth-redirect-sidan ska servas från din egna domän.
   Gå till [Firebase Console → Hosting → Add custom domain](https://console.firebase.google.com).

> **Tips:** Utan Firebase Hosting på `sport-iq.se` fungerar popup-baserade inloggningsflöden ändå,
> men redirect-baserade flöden kräver att domänen är kopplad till Firebase Hosting.

### Driftsättning via Vercel (rekommenderat)

Om du kör projektet via **GitHub + Vercel** behöver du **inte** köra några lokala kommandon.
Lägg istället till variablerna direkt i Vercel-dashboarden:

1. Gå till ditt projekt på [vercel.com](https://vercel.com)
2. Välj **Settings → Environment Variables**
3. Lägg till alla sju variablerna ovan med dina riktiga värden
4. Gör en ny deploy (eller tryck **Redeploy**) – Vercel hämtar automatiskt värdena

### Lokal utveckling (valfritt)

Om du någon gång vill köra projektet på din egen dator:

1. Kopiera `.env.example` till `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Fyll i dina riktiga värden i `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sport-iq.se
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=ditt-projekt-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ditt-projekt.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123...
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
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
