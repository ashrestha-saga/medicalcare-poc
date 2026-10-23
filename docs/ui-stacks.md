# UI stacks by surface

DeviceCare uses **three intentional stacks**. Do not invent a fourth. When touching UI, match the stack of the route family.

| Surface | Routes | Stack | Primary controls |
|---------|--------|-------|------------------|
| **Field / clinic chrome** | Scan, registration, device detail, cart, capturer | BEM `p-*` / `t-*` in `globals.css`, form-factor | `.p-cta`, `.p-field`, native select when in mockup flows |
| **Clinic admin lists** | Dashboard, inventory, incidents, duty-overlap, … inside AppShell | Tailwind + shadcn + `ListPageShell` | `@/components/ui/button`, Dialog, Select, Field |
| **Partner console** | `/partner/*` | Tailwind + shadcn + `ConsoleShell` | Same as clinic admin |
| **Inspect portal** | `/inspect/*` | `pp-*` CSS (thin); prefer shadcn when adding new chrome | Labelled controls; Dialog for overlays |

## Do

- Use shared `AccessDenied`, `EmptyState`, `PageLoading` for admin/console states.
- Use Radix `Dialog` / `AlertDialog` for overlays outside Scan.
- Drive status colors from CSS variables (`--green`, `--warn`, `--red`, `--accent-soft`, …).
- Keep labels ≥ 11px (`--fs-label` floor).

## Don’t

- Mix `.p-cta` into ConsoleShell or new admin forms.
- Add new custom modals without focus trap (use Dialog).
- Hard-code neon rgba for badges/alerts — use theme tokens.
- Introduce Storybook-only components that aren’t used in-app.

## Shared building blocks

- `src/components/ui/*` — shadcn + product wrappers
- `src/components/features/shared/ListPageShell.tsx` — admin page frame (`list` \| `board` \| `compose`)
- `src/components/features/shared/AccessDenied.tsx`, `EmptyState.tsx`, `PageLoading.tsx`
- `src/components/features/shared/ResponsiveTableSwitch.tsx` — table ≥`md`, cards below

## List pattern (Phase 3)

| Kind | Use |
|------|-----|
| **Inventories** (devices, users, catalog, partner staff/orders) | Shared `DataTable` — search/sort/filter |
| **Compose / small tables** (duty-overlap, constancy form+list) | Hand-rolled `<table>` OK; still wrap with `ResponsiveTableSwitch` if ≥5 columns |
| **Wide operational lists** (incidents, FSCA, reprocessing, device book, customers) | Desktop table + **card stack under `md`** (`ResponsiveTableSwitch`) |
