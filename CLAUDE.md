# Gmail Order Manager — CLAUDE.md

## Mi ez az alkalmazás?

Webes alkalmazás, amely Gmail-fiókhoz csatlakozva automatikusan megkeresi az online
vásárlásokkal kapcsolatos leveleket, kinyeri belőlük a rendelési adatokat (rendelésszám,
összeg, dátum, feladó), és egy áttekinthető dashboardon jeleníti meg őket. Az adatok
Supabase adatbázisban tárolódnak, és Excel-fájlba exportálhatók.

---

## Tech stack

- **Next.js 14** — App Router, TypeScript, SSR API route-ok
- **Tailwind CSS v3** — shadcn/ui `new-york` stílus (v2.3.0 — fontos: a legújabb shadcn
  Tailwind v4-et igényel, csak `npx shadcn@2.3.0` kompatibilis ezzel a projekttel)
- **Figtree** betűtípus (Google Fonts, `next/font/google`)
- **Supabase** — adatbázis + authentikáció
- **NextAuth v4** — Google OAuth
- **googleapis** — Gmail API (csak olvasás)
- **xlsx** — Excel export
- **jszip** — ZIP melléklet letöltés (implementálva és működik)
- **sanitize-html** — szerver oldali HTML sanitizálás (email megjelenítéshez, XSS védelem)
- **lucide-react** — ikonok
- **sonner** — toast értesítések

---

## Node.js / futtatás

Node.js nincs globálisan telepítve — **nvm**-mel kell aktiválni:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
```

Dev szerver indítása:
```bash
node node_modules/next/dist/bin/next dev > /tmp/nextdev.log 2>&1 &
```

> `npm run dev` és `npx next` nem működik a szóközös mappanév miatt.

Build ellenőrzés:
```bash
node node_modules/next/dist/bin/next build
```

Szerver log figyelése:
```bash
tail -f /tmp/nextdev.log
```

---

## Projekt struktúra

```
/
├── app/
│   ├── layout.tsx                  # Root layout, Figtree font
│   ├── globals.css                 # Tailwind + CSS változók (zöld paletta) + .email-html-content
│   ├── (auth)/
│   │   └── login/page.tsx          # Bejelentkezési oldal (gradient bg)
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Védett layout — session check + sidebar
│   │   ├── page.tsx                # Dashboard főoldal
│   │   ├── orders/
│   │   │   ├── page.tsx            # Rendelések lista oldal
│   │   │   └── [id]/page.tsx       # Rendelés részletei (HTML email + csatolmányok, NO szállítási cím)
│   │   ├── sync/
│   │   │   └── page.tsx            # Gmail szinkronizáció oldal
│   │   └── settings/
│   │       └── page.tsx            # Beállítások oldal (szűrők + adattörlés)
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth Google OAuth handler
│       ├── gmail/sync/route.ts     # Gmail szinkronizáció — fő logika
│       ├── orders/route.ts         # Rendelések GET (lista + szűrés)
│       ├── orders/[id]/route.ts    # Rendelés GET/PATCH/DELETE
│       ├── orders/[id]/attachments/route.ts  # ZIP letöltés — Gmail API + jszip
│       ├── export/route.ts         # Excel (.xlsx) letöltés
│       ├── settings/filters/       # GET + PUT — kulcsszó/feladó szűrők + sync dátum
│       └── data/reset/route.ts     # DELETE — összes rendelés + sync log törlése
├── components/
│   ├── providers.tsx               # NextAuth SessionProvider wrapper
│   ├── sidebar.tsx                 # Navigáció (hidden md:flex — mobilon rejtett)
│   ├── mobile-nav.tsx              # Bottom navigation bar (csak mobilon, md:hidden)
│   ├── login-button.tsx            # "Get Started" gomb → Google OAuth
│   ├── back-button.tsx             # Vissza gomb — router.back() (client component)
│   ├── dashboard-views.tsx         # Dashboard webshop nézet (monogramos kártya grid + kibontás)
│   ├── orders-table.tsx            # Rendelések: táblázat (desktop) + kártya lista (mobil)
│   ├── order-status-select.tsx     # Státusz módosító dropdown (rendelés részletek oldalon)
│   ├── sync-panel.tsx              # Sync UI (dátumválasztó, előzmények)
│   ├── settings-panel.tsx          # Beállítások UI (kulcsszavak, feladók, adattörlés)
│   ├── email-body.tsx              # Email HTML/plain text megjelenítő (client component)
│   └── ui/                         # shadcn/ui komponensek
├── lib/
│   ├── auth.ts                     # NextAuth konfiguráció + automatikus token refresh
│   ├── gmail.ts                    # Gmail API wrapper (fetchOrderEmails, htmlBody, attachments)
│   ├── gmail-query.ts              # buildGmailQuery(), DEFAULT_KEYWORDS, DEFAULT_SENDERS
│   ├── order-parser.ts             # Email → rendelési adatok (regex, isOrderEmail)
│   ├── supabase.ts                 # Supabase kliens (server-side)
│   ├── export.ts                   # Excel generálás (xlsx)
│   ├── zip-filename.ts             # buildZipFilename() — egységes ZIP fájlnév generálás
│   └── utils.ts                    # cn() segédfüggvény
├── types/
│   ├── database.ts                 # Order, SyncLog, OrderItem, Attachment, UserFilterSettings
│   └── next-auth.d.ts              # Session bővítés (accessToken, user.id, error)
├── supabase/
│   └── migration.sql               # Táblák + ALTER-ek — le kell futtatni Supabase Studio-ban
└── .env.local                      # Környezeti változók (nem kerül git-be)
```

---

## Adatbázis (Supabase)

A `supabase/migration.sql` fájlt **manuálisan kell lefuttatni** a Supabase Studio SQL
Editorban. Táblák és oszlopok:

- **`orders`** — kinyert rendelési adatok
  - Mezők: `gmail_message_id`, `gmail_thread_id`, `attachments jsonb`, `raw_email_html text`, stb.
- **`sync_logs`** — szinkronizáció előzmények
- **`user_filter_settings`** — felhasználónkénti szűrő beállítások
  - Mezők: `keywords text[]`, `senders text[]`, `sync_from_date text`

Supabase projekt URL: `https://emqcmpibxzjxqlmqsfpm.supabase.co`

---

## Fontos döntések és implementált funkciók

### Státusz: csak 2 érték
`new` (Új) és `done` (Feldolgozott). A `processing`, `shipped`, `manual` értékek el lettek távolítva a UI-ból. Az adatbázisban `OrderStatus = "new" | "processing" | "shipped" | "done" | "manual"` típus marad (visszafelé kompatibilitás), de a UI csak `new`/`done`-t használ.

### Inline státusz módosítás
Mind a rendelések listában (`orders-table.tsx`), mind a dashboard kibontott listájában (`dashboard-views.tsx`) közvetlenül módosítható a státusz — nem kell belépni a levél részletes nézetébe. Kattintáskor `e.stopPropagation()` védi a sor navigációját.

### ZIP csatolmány letöltés
- **Endpoint:** `GET /api/orders/[id]/attachments` — lekéri az `attachmentId`-kat DB-ből, Gmail API-val letölti, jszip-pel csomagolja
- **Fájlnév:** `lib/zip-filename.ts` → `buildZipFilename(sender, subject, date)` = `domain_tárgy_yy-mm-dd.zip`
- **UI:** narancssárga letöltés gomb megjelenik a rendelés részletek oldalán, a rendelések listában és a dashboard kibontott listájában is
- **Token lejárat:** ha a Gmail access token lejárt, 502 hibát ad — újra be kell jelentkezni (token refresh implementálva, de csak új login után aktiválódik)

### Token refresh (automatikus)
`lib/auth.ts` JWT callback automatikusan frissíti az access tokent a `refresh_token` segítségével, ha 30 másodpercen belül lejár. Ha a refresh sikertelen, `session.error = "RefreshAccessTokenError"` jelzi az újbóli bejelentkezés szükségességét.

### Dashboard monogramos kártya grid
`components/dashboard-views.tsx` — Fehér kártyák monogrammal (2 betű), webshop névvel, utolsó levél dátumával, darabszámmal. Grid: `grid-cols-1 sm:grid-cols-3` (mobilon 1, desktopon 3 oszlop). Kattintásra a többi kártya eltűnik, csak a kiválasztott látszik fejlécként (monogram + vissza nyíl + csoport törlés gomb), alatta a teljes levéllista görgetési korlát nélkül. Vissza gombbal visszatér a teljes gridhez.

### Vissza gomb
`components/back-button.tsx` — `router.back()`, mindig az előző oldalra visz visszza (Dashboard, lista, stb.), nem hardkódolt útvonal.

### Rendelések lista oszlopok
Dátum | Feladó (csak email cím) | Összeg | Státusz (inline módosítható) | Forrás | Fájlok (ZIP letöltés gomb). A Rendelésszám oszlop el lett távolítva.

### Törlés — minden nézetben
- **Egyedi törlés:** `DELETE /api/orders/[id]` — sor melletti 🗑️ ikon (dashboard lista + orders táblázat + orders kártya mobilon)
- **Csoport törlés:** dashboard kibontott fejlécben „Összes törlése" gomb — az adott webshop összes levelét törli
- **Bulk törlés:** orders táblázatban checkbox + „X törlése" piros gomb — `DELETE /api/orders` body: `{ ids: string[] }`
- Törlés után state frissül oldaltöltés nélkül (dashboard); orders oldalon `fetchOrders()` újratölt

### Mobil optimalizálás
- **Sidebar:** `hidden md:flex` — mobilon rejtett
- **Bottom nav:** `components/mobile-nav.tsx` — fix alul, 4 ikon+felirat, aktív elem zöld
- **Layout:** `p-4 md:p-7`, `pb-20 md:pb-0` (helyet hagy a bottom nav-nak)
- **Orders lista:** mobilon kártya nézet (`md:hidden`), desktopon táblázat (`hidden md:block`)
- **Dashboard fejléc:** `flex-col sm:flex-row` — mobilon szinkronizálás gomb a cím alá kerül
- **launch.json:** `.claude/launch.json` megvan — preview tool tud csatlakozni (node teljes útvonal: `/Users/kazo/.nvm/versions/node/v20.20.2/bin/node`)

### ZIP fájlnév szabály
`buildZipFilename(sender, subject, date)` → `domain_tárgy_yy-mm-dd.zip`
- domain: `source_sender` email-ből kinyerve (pl. `myprotein`)
- tárgy: speciális karakterek nélkül, max 60 kar, szóközök `_`-ra cserélve
- dátum: `yy-mm-dd` formátum

### Szinkronizáció után automatikus átirányítás
`sync-panel.tsx` — sikeres szinkronizáció után `window.location.href = "/"` → Dashboard (teljes oldalfrissítéssel, friss adatokkal).

### Adattörlés után automatikus frissítés
`settings-panel.tsx` — törlés után `window.location.href = "/"` → Dashboard (teljes oldalfrissítéssel). Gomb felirata: „Összes levél törlése a listából".

### Rendelés részletek oldal
Szállítási cím kártya eltávolítva. Megmarad: Vásárló adatok, Fizetés, Termékek, Csatolmányok (ZIP letöltéssel), Email tartalom.

### Sync panel info szöveg
A szinkronizáció indítása kártya FÖLÖTT fehér kártyában megjelenik: „A szűrési beállításokat a Beállítások menüpontban módosíthatod." (kattintható link).

### DEFAULT_KEYWORDS (lib/gmail-query.ts)
Jelenlegi lista: `rendel, visszaigazol, confirm, order, megrendelés, megrendelése, megrendelésed, invoice, receipt, számla, számlád, számládat, purchase, vásárlás, vásárlásod, deliver, delivery, fizetés, payment, köszönjük, csomag`

### Kétszintű Gmail szűrés
1. **Gmail API szint** (`lib/gmail-query.ts`): `subject:(...)  OR from:(...)` lekérdezés
2. **App szint** (`lib/order-parser.ts`): `isOrderEmail()` — relevancia ellenőrzés

### Thread-alapú deduplikáció
Ha egy `gmail_thread_id` már szerepel az `orders` táblában → egész thread kihagyva. Threaden belül csak a legkorábbi levél kerül mentésre.

### Email HTML megjelenítés: szerver oldali sanitizálás
`sanitize-html` tisztítja, `cid:` képek → üres `<span>`, külső linkek `target="_blank"`.

### CSS / Design konstansok
- **Font:** Figtree
- **Fő szín:** `#7BB27E` (zöld)
- **Sötét szöveg:** `#2A2A2A`
- **Háttér:** `#F6F6F6`
- **Pasztell kártyák:** zöld `#E8F5E9`, lila `#EDE7F6`, kék `#E3F2FD`, narancs `#FFF3E0`, rózsaszín `#FCE4EC`
- **ZIP letöltés gomb:** `#FFF3E0` háttér, `#E65100` szöveg, `#FFB74D` keret
- **Border radius:** `1rem` (lg), `1.25rem` (xl)
- **Árnyék:** `shadow-soft` = `0 2px 16px 0 rgba(0,0,0,0.06)`
- **shadcn/ui verzió:** mindig `npx shadcn@2.3.0 add [komponens]`

---

## Mi működik jelenleg

- [x] Google OAuth bejelentkezés (gmail.readonly scope)
- [x] Automatikus access token refresh (NextAuth JWT callback)
- [x] Gmail API kapcsolat — levelek listázása és letöltése
- [x] Dinamikus Gmail lekérdezés felhasználói kulcsszó- és feladólistából
- [x] App-oldali kétszintű relevancia szűrés (`isOrderEmail()`)
- [x] Thread-alapú deduplikáció
- [x] Szinkronizáció UI dátumválasztóval, sikeres sync után Dashboard-ra irányít
- [x] Email tartalom kinyerés (subject, from, date, plaintext, HTML)
- [x] Csatolmány metaadatok kinyerése és tárolása
- [x] **ZIP csatolmány letöltés** — Gmail API + jszip (rendelés részletek, lista, dashboard)
- [x] Regex-alapú parser (rendelésszám, összeg, pénznem, termékek)
- [x] Supabase mentés
- [x] Dashboard — monogramos kártya grid (3 oszlop desktop, 1 oszlop mobil), kibontott lista
- [x] Dashboard kártya kattintásra: többi kártya eltűnik, teljes lista + vissza gomb jelenik meg
- [x] Inline státusz módosítás (lista + dashboard, 2 érték: Új / Feldolgozott)
- [x] Törlés: egyedi (sor melletti ikon) + csoportos (panel fejlécben) + bulk (checkbox + gomb) — minden nézetben
- [x] Bulk delete API: `DELETE /api/orders` body: `{ ids: string[] }`
- [x] Vissza gomb → előző oldal (router.back())
- [x] Rendelések lista (Feladó email, ZIP letöltés, inline státusz, lapozás, export)
- [x] Rendelések lista mobilon: kártya nézet; desktopon: táblázat
- [x] Rendelés részletek (HTML email, csatolmányok ZIP, státusz — szállítási cím nélkül)
- [x] Excel export endpoint
- [x] Beállítások — kulcsszavak, feladók, adattörlés (`window.location.href` frissítéssel)
- [x] Dashboard bemutató kártya — 📦 ikonnal, alkalmazás leírással (mindig látható a fejléc alatt)
- [x] **Mobil optimalizálás** — bottom navigation bar, sidebar elrejtve mobilon, responsive padding

---

## Következő javítandó dolgok

### 1. Excel export tesztelése (KÖZEPES)
`/api/export` endpoint megvan, élőben még nem tesztelve Supabase adatokkal.

### 2. Parser teljesítmény (ALACSONY)
100+ levélnél rate limit lehetséges — javasolt 10-es batch méret + retry logika.
