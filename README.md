# PetPals

A routine app for kids with a pet companion. Parents plan the day: tasks,
chores, events like a soccer game, and rewards. Each child follows their day
on their own screen with Biscuit the rabbit. Stars only ever come from a
parent.

This web app is the test bed. The planned product is a small always-on device
per child plus a parent app on the phone.

## Running it

```bash
npm i
```

```bash
npm run dev
```

The dev server runs at http://localhost:8080. Other scripts: `npm run build`,
`npm run lint`, `npm run preview`.

## Stack

- React 18, TypeScript, Vite
- Tailwind CSS with shadcn/ui (Radix) components, Motion for animation
- Supabase for Postgres, auth and realtime (`src/integrations/supabase`, migrations in `supabase/migrations`)
- TanStack Query, React Router, React Hook Form with Zod

## Where things are

| Path | What |
|---|---|
| `src/pages/ChildInterface.tsx` | The child's screen (`/child/:childId`) |
| `src/pages/Dashboard.tsx`, `ChildDashboard.tsx` | Parent home and a child's Day / Month planner |
| `src/components/TaskForm.tsx` | The Add to Schedule sheet (task, chore, event) |
| `src/components/pets/` | The pet renderer and Playtime mini games |
| `src/utils/` | Scheduling rules: free time, overlaps, events, built-in rows |
| `scripts/` | Node tests (`node --test scripts/*.test.mjs`) and asset generators |

`CLAUDE.md` has a fuller tour of the architecture.

## Assets

- **App icon:** a paw drawn by `scripts/app-icons.py`, which writes the favicons and PWA icons into `public/`.
- **Task icons:** Uicons by Flaticon (https://www.flaticon.com/uicons), turned into inline SVG by `scripts/uicons.py`. The credit is shown in Settings.
