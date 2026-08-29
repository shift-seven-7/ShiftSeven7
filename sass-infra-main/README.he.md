# sass-infra

**עברית** · [English](README.md)

תשתית SaaS רב-טננטית גנרית — Next.js + Vercel + Supabase, עברית RTL.

זו נקודת ההתחלה לפרויקט SaaS חדש. יש כאן **תשתית בלבד**: רב-טננטיות, הקמת
טננטים, קונסולת אדמין, הרשאות, מודולים ומערכת עיצוב. אין בה שום מושג דומייני —
את אלה מוסיפים כמודולים.

> ממשק המשתמש של האפליקציה בעברית. שאר התיעוד ב-`docs/` כתוב באנגלית; המסמך הזה
> הוא תרגום מלא של [README.md](README.md).

## מה יש כאן

| שכבה | תיאור |
|---|---|
| **רב-טננטיות** | סאב-דומיין → חיפוש במאגר הטננטים → פרויקט Supabase נפרד לכל טננט (DB + Auth + Storage). בידוד פיזי. |
| **הקמת טננט** | אוטומטית (Supabase Management API + Vercel DNS + משתמש אדמין ראשון), או רישום ידני של פרויקט קיים. |
| **קונסולת אדמין** | `/app/admin/tenants` — רשימה, יצירה, אשף הקמה בן שמונה שלבים, הגדרות לקוח (לוגו, מודולים, תנאי שימוש). |
| **הרשאות** | תפקידים קבועים בקוד. מגיע עם `ADMIN` ו-`SYSTEM_MANAGER`. |
| **מודולים** | feature flags דו-מצביים לכל טננט. המרשם נשלח ריק. |
| **מערכת עיצוב** | טוקני HSL כהה-ראשון, RTL לוגי, shadcn/ui ופרימיטיבים מותאמים. |

## דרישות מקדימות

מה שחייב להיות מותקן על המחשב לפני שמריצים משהו.

| כלי | גרסה | למה |
|---|---|---|
| **Node.js** | 20.9 ומעלה (מומלץ 24 LTS) | Next.js 16 לא יעלה מתחת ל-20.9 |
| **npm** | 10 ומעלה | מגיע עם Node |
| **Docker Desktop** | כל גרסה נתמכת | ה-Supabase המקומי הוא ערימת קונטיינרים. חייב **לרוץ** לפני `npm run db:start` |
| **Supabase CLI** | 2.x | מפעיל ומנהל את ה-DB המקומי. **אינו תלות של הפרויקט** — מתקינים בנפרד |
| **Git** | כל גרסה | |

### התקנה — macOS

```bash
# Node (דרך nvm; מכבד את ה-.nvmrc שבריפו)
brew install nvm && nvm install && nvm use

# Docker Desktop
brew install --cask docker      # ואז לפתוח את האפליקציה פעם אחת

# Supabase CLI
brew install supabase/tap/supabase
```

### התקנה — Windows / Linux

- **Node:** [nodejs.org](https://nodejs.org) או `nvm-windows`
- **Docker:** ‏Docker Desktop (ב-Windows) או Docker Engine (ב-Linux)
- **Supabase CLI:** ראה [supabase.com/docs/guides/local-development](https://supabase.com/docs/guides/local-development)
  — יש חבילות ל-Scoop, ל-apt ול-npm

### בדיקה

```bash
node -v        # v20.9.0 ומעלה
docker info    # חייב להדפיס פלט, לא שגיאת חיבור
supabase -v    # 2.x
```

‏`docker info` שנכשל פירושו ש-Docker Desktop לא רץ. זו הסיבה הנפוצה ביותר
לכך ש-`npm run db:start` נתקע.

### מה **לא** צריך

- **אין צורך בחשבון Supabase כדי לפתח.** הערימה המקומית משמשת גם כמאגר הטננטים
  וגם כטננט היחיד. חשבון ענן נדרש רק כדי להקים טננטים אמיתיים.
- **אין צורך ב-`SUPABASE_MANAGEMENT_TOKEN` או ב-`VERCEL_TOKEN`** — הם מפעילים את
  ההקמה האוטומטית של טננטים. בלעדיהם המסלול הזה כבוי וכל השאר עובד.
- **אין צורך ב-Postgres מקומי.** ה-CLI מריץ אותו בתוך Docker.

---

## התחלה מהירה

```bash
npm install
cp .env.example .env.local

# מפתח הצפנה לאישורי הטננטים — חובה, אחרת כל כתיבה למאגר נכשלת.
npm run secrets:generate-key      # להעתיק ל-TENANT_SECRETS_KEY ב-.env.local

# Supabase מקומי. בהרצה הראשונה יירדו image-ים של Docker (כמה דקות).
npm run db:start
npm run db:status                 # להעתיק API_URL / ANON_KEY / SERVICE_ROLE_KEY
```

שלושת הערכים האלה נכנסים ל-`.env.local`:

```
LOCAL_TENANT_SUBDOMAIN=local
LOCAL_TENANT_SUPABASE_URL=<API_URL>
LOCAL_TENANT_SUPABASE_ANON_KEY=<ANON_KEY>
LOCAL_TENANT_SUPABASE_SERVICE_KEY=<SERVICE_ROLE_KEY>
```

ואז:

```bash
npm run db:init                   # מיגרציות טננט + master, ושלושה טננטים לדוגמה
npm run dev
```

פתח **`http://local.localhost:3000`**.

> ‏`db:init` כולל את `db:migrate:master`, שיוצר את טבלת `tenants`. בלעדיו שום
> כתובת לא נפתרת והכל מגיע ל-`/tenant-not-found` — האפליקציה מפענחת טננטים דרך
> המאגר גם מקומית, בדיוק כמו בפרודקשן.

### מעבר בין טננטים מקומית

| כתובת | טננט |
|---|---|
| `local.localhost:3000` | ברירת המחדל |
| `acme.localhost:3000` | טננט שני |
| `beta.localhost:3000` | טננט שלישי |
| `nosuch.localhost:3000` | `/tenant-not-found` |

שלושתם חולקים DB מקומי אחד — הניתוב וההצפנה אמיתיים, בידוד הנתונים לא.

**המדריך המלא:** [docs/getting-started.md](docs/getting-started.md) — הרשמה
ראשונה, קידום עצמי ל-ADMIN, סיור בקונסולה, ויצירת טננט.

**עלייה לאוויר:** [docs/deployment.md](docs/deployment.md) — חשבונות, דומיין,
Frankfurt, והטננט הראשון.

## פקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run dev` | שרת פיתוח מול ה-Supabase המקומי |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:init` | מ-clone לסביבה עובדת: start → migrate → migrate:master → seed |
| `npm run db:start` / `db:stop` | הפעלה וכיבוי של ערימת ה-Docker המקומית |
| `npm run db:status` | כתובות ומפתחות של הערימה המקומית |
| `npm run db:migrate` | מיגרציות הטננט על ה-DB המקומי |
| `npm run db:migrate:master` | מיגרציות ה-master (טבלת `tenants`) על ה-DB המקומי |
| `npm run db:seed` | טננטים לדוגמה (`-- --reset` כדי ליצור אותם מחדש) |
| `npm run db:reset` | מחיקת ה-DB המקומי, הרצת כל המיגרציות מחדש, וזריעה מחדש |
| `npm run tenant:bootstrap` | הקמת טננט מה-CLI — כך נוצר הטננט הראשון |
| `npm run sync-master-migrations` | החלת `master_migrations/` על ה-master הענני |
| `npm run sync-tenant-migrations` | החלת `supabase/migrations/` על כל הטננטים הפעילים (`-- --tenant=x` לאחד) |
| `npm run secrets:generate-key` | יצירת `TENANT_SECRETS_KEY` חדש |
| `npm run secrets:encrypt` | הצפנת אישורים ששמורים עדיין כטקסט רגיל |
| `npm run secrets:rotate` | סיבוב `TENANT_SECRETS_KEY` |

## פורטים מקומיים

| פורט | מה |
|---|---|
| 3000 | Next.js |
| 54321 | ‏Supabase API — זה מה שנכנס ל-`LOCAL_TENANT_SUPABASE_URL` |
| 54322 | Postgres |
| 54323 | Supabase Studio |
| 54324 | ‏Mailpit — כאן נוחתים מיילי האימות והאיפוס בפיתוח |

## תקלות נפוצות

| תסמין | סיבה |
|---|---|
| `npm run db:start` נתקע או נכשל | ‏Docker Desktop לא רץ. בדוק עם `docker info` |
| `supabase: command not found` | ה-CLI לא מותקן — ראה "דרישות מקדימות" |
| **הכל מגיע ל-`/tenant-not-found`** | ‏`npm run db:init` מעולם לא הורץ, או ש-`LOCAL_TENANT_SUPABASE_*` ריקים. ה-proxy מדפיס אזהרה מפורשת בטרמינל |
| `Cannot read public.tenants` | חסר `npm run db:migrate:master` |
| `TENANT_SECRETS_KEY is not set` | הרץ `npm run secrets:generate-key` והוסף ל-`.env.local` |
| לא הגיע מייל אימות | מקומית אישור האימייל כבוי, ולכן ההרשמה מיידית. אם הפעלת אותו — המיילים נוחתים ב-`http://127.0.0.1:54324` |
| תקוע ב"ממתין לאישור" | תקין. קדם את עצמך ל-`ADMIN` — ראה [getting-started](docs/getting-started.md) |

## מאיפה להתחיל לקרוא

- `.claude/CLAUDE.md` — הארכיטקטורה ושיטת העבודה
- `docs/architecture.md` — הסטאק, מודל הנתונים, מודל ההרשאות
- `docs/multi-tenant.md` — פענוח הטננט, חמשת לקוחות ה-Supabase, ההצפנה
- `docs/modules-and-roles.md` — איך מוסיפים מודול ואיך מוסיפים תפקיד

## כללים שלא נשברים

1. כל דף הוא `'use client'`. אין SSR, אין SEO.
2. הפרונטאנד לא נוגע ב-Supabase ישירות — הכל דרך `/api/*` ו-TanStack Query.
3. כל טקסט UI בעברית; כל layout משתמש במאפייני RTL לוגיים (`ms-`, `me-`,
   `ps-`, `pe-`, `text-start`).
4. מיגרציות הן **קבצים בלבד**. אף אחד לא מריץ SQL על DB חי בלי שביקשו ממנו.
5. מפתח ה-service role של טננט לא עוזב את השרת. לעולם.
