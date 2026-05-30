# Snowy Owl Gelato Operations Feature Inventory

This document is the working product feature inventory for Snowy Owl Gelato Operations. Use it as the source for future Admin, Lab, Store Staff, Store Manager, and operations manuals.

## Product Shape

- Mobile-first browser app backed by Supabase.
- Vercel hosts the frontend.
- Supabase stores auth, staff profiles, catalog, attendance, inventory, dispatches, pan state, EOD counts, corrections, and QueueBuster job requests.
- QueueBuster browser automation is deferred to a separate always-on worker/VM and must not run in frontend code.

## Personas

- Admin: manages catalog, locations, staff, attendance settings, correction workflows, reports, and QueueBuster job requests.
- Lab Staff/Lab Manager: records production, sees lab inventory, and dispatches available pans to stores.
- Store Staff: checks in to a store, receives incoming dispatches, moves backup pans to display, submits EOD gelato weights, submits deep-freezer/morning counts, submits supply counts, and logs urgent requirements.
- Store Manager: performs store workflows and can correct same-day store submissions.

## Admin Features

- Login with app credentials.
- Manage all catalog master data from the app:
  - flavours and short codes,
  - catalog categories,
  - store supplies,
  - lab supplies,
  - raw materials,
  - packaging/serving items,
  - products sold when operationally counted.
- Queue QueueBuster catalog audit/add/fix jobs from catalog rows. Actual QueueBuster execution is handled later by backend worker.
- Manage staff roster:
  - create staff,
  - approve staff signup requests,
  - deactivate/reactivate staff,
  - assign role,
  - set default location for monthly salary review grouping,
  - set allowed holidays,
  - add bonus days,
  - reset/manage staff app password.
- Toggle location-based attendance enforcement. Default is on.
- View operational reports:
  - recent dispatches,
  - EOD gelato counts,
  - morning freezer checks,
  - supply counts,
  - empty pan counts by store,
  - today attendance roster,
  - date-range attendance review with CSV export and browser PDF export.
- Correct historical EOD gelato counts and inventory counts frictionlessly for MVP.
- Manage store deep-freezer starting counts and flavour target weights for store requirements.

## Attendance Features

- Staff login is separate from Supabase administration.
- Staff can request access from the login screen.
- Admin must approve staff signup before staff can use the app.
- Staff can check in and check out multiple times in one day for multiple shifts.
- Staff choose the store/lab location at check-in.
- Checked-in staff can switch stores during an active shift without checking out; location segments record where the continuous shift was worked.
- Staff submit a check-in selfie for uniform verification.
- Check-in selfies are stored in private Supabase Storage and queued for AI review.
- Gemini validates apron, headwear/hair covering, and gloved thumbs-up evidence.
- AI review results are flags for Admin/manager review, not hard attendance blockers.
- Admin can review attendance selfies by day and store for the three-day live selfie window.
- Older attendance selfie images are archived to Google Drive by a backend worker, with archive metadata kept in Supabase.
- The active checked-in location is shown in the app header and drives store-specific workflows.
- Location verification can be enforced or disabled by Admin.
- Attendance stores check-in/out timestamps, location, and verification metadata where available.
- Attendance review defaults to today, supports date ranges, and shows running hours for staff still checked in today.
- Attendance review groups salary rows by staff default location, not by the store actually worked during a shift.

## Lab Features

- Add lab production by flavour, production date, pan count, full pan weight, and notes.
- Generate staff-friendly pan IDs from flavour short code, numeric date, and sequence.
- Store batch ID separately from pan ID.
- Add produced pans to lab inventory first.
- Show available lab inventory.
- Move selected available lab inventory to a store through dispatch.
- Dispatch changes selected pans to in transit and removes them from available lab stock.
- Lab inventory and dispatch are separate workflows.
- Lab can see store requirements derived from store target weights and projected deep-freezer balances.

## Store Gelato Features

- Store staff must be checked in to a location before using store workflows.
- The Store tab is an action hub: it shows store workflow choices and optional reporting, but no editable workflow fields.
- Store workflow forms open from dedicated action views after staff choose the action.
- Store workflow actions ask staff to confirm the current checked-in store and run warning-only browser location validation before editable fields are shown.
- Browser location mismatch shows a strong warning, but staff can explicitly continue when they are sure the selected store/action is correct.
- Receive incoming lab dispatches for the active store.
- Accepted dispatched pans become backup/deep-freezer stock at that store.
- Move a backup pan to display by pan ID.
- Each store can have only one active display-assigned pan per flavour.
- A display-assigned pan keeps its pan ID attached to that flavour until it is explicitly checked out of display.
- Partial pans returned from display to deep freezer are shown separately from new/full deep-freezer pans.
- Display movement requires Full or Partial. Partial requires weight.
- EOD gelato weights are a distinct store action.
- EOD gelato rows are prefilled from relevant display/deep-freezer stock to reduce missed entries.
- EOD display rows show flavour name first and pan ID below it.
- Staff enter weights in kg; gram-like values such as 6000 are blocked.
- EOD submission updates pan lifecycle automatically:
  - non-empty display pans return to deep-freezer stock as partial pans while keeping the active display assignment,
  - zero-weight display pans are closed as depleted/empty,
  - pan lifecycle events are recorded.
- Projected deep-freezer balances include:
  - latest EOD deep-freezer baseline,
  - accepted receipts after baseline,
  - display movement weights after baseline,
  - returned display weights after EOD.
- Empty pan count is backend-calculated by store from closed zero-weight pans.
- Detailed pan-to-pan consolidation/refill tracking is deferred.

## Store Deep-Freezer And Requirements

- EOD deep-freezer count is the primary backup freezer status.
- Morning inventory verification can compare against the previous EOD count.
- Deep-freezer counts are flavour-level weights, not pan-by-pan counts.
- Store target weights by flavour drive automatic lab requirement calculations.
- Requirements are calculated per store.

## Store Supplies And Other Inventory

- Store supply count is checklist-driven from Admin catalog items scoped to store or both.
- Staff cannot add new catalog items from store workflows.
- Lab and store purchasing/catalog scope can overlap, but inventory quantities are managed separately per location after setup.
- Admin can deactivate catalog items without breaking historical counts.

## Deferred Features

- QueueBuster/POS CSV reconciliation.
- QueueBuster browser automation worker execution.
- Events workflow.
- Salary calculation from attendance days, holidays, allowed holidays, and bonus days.
- Immutable audit trail with required correction reasons.
- Detailed pan-to-pan consolidation/refill tracking.
- Native mobile app.
- Advanced analytics and AI recommendations.
