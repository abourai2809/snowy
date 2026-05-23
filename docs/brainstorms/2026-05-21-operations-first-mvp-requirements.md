---
date: 2026-05-21
topic: operations-first-mvp
---

# Operations-First MVP Requirements

## Summary

Build the Snowy Owl Gelato Operations MVP as a mobile-first browser app backed by a real database. The MVP proves the core operating loop: admin configures catalog and staff, lab creates pan-tracked gelato, stores receive and move inventory, staff submit end-of-day gelato and supply counts, and attendance is recorded daily.

---

## Problem Frame

The current product is a single-file front end in `index.html` with hardcoded demo data and partial backend ideas. That is useful for exploring workflows, but it cannot run daily operations because staff, flavours, products, supplies, store inventory, attendance, and dispatches need to be shared and editable across people and locations.

The operating environment is phone-first. Lab and store staff need short, simple workflows that avoid typing or decisions they do not own. Admin needs control over the reusable operating lists, staff roster, and corrections. Store and lab manuals in `01_Store_Staff_Training.docx`, `02_Lab_Staff_Training.docx`, `03_Store_Manager_Training.docx`, and `04_Admin_Training.docx` define the intended persona workflows and should stay the source of truth for MVP behavior.

QueueBuster/POS reconciliation matters later, but MVP value comes from making physical operations reliable first: what was produced, where each pan went, what is on display, what was counted at closing, what supplies remain, and who attended work.

---

## Actors

- A1. Admin: Owns catalog, staff roster, high-level corrections, attendance settings, and full operational visibility.
- A2. Lab Staff: Records production, raw materials, lab supplies, and lab-side operational updates allowed by the manuals.
- A3. Lab Manager: Performs lab manager workflows, including dispatch and lab-side review actions from the manuals.
- A4. Store Staff: Receives inventory, moves pans, records display inventory, submits end-of-day counts, and checks attendance.
- A5. Store Manager: Has store staff capabilities plus multi-store visibility and same-day correction authority.
- A6. Operations backend: Persists catalog, staff, inventory, attendance, and transaction records for all users.
- A7. QueueBuster/POS: Future reconciliation source; not an MVP workflow actor.

---

## Key Flows

- F1. Admin configures operating data
  - **Trigger:** A flavour, product, supply item, store, or staff member needs to be created or changed.
  - **Actors:** A1, A6
  - **Steps:** Admin opens catalog or staff management, edits the relevant item, and saves it. The app immediately uses that data in staff workflows instead of hardcoded lists.
  - **Outcome:** Operational dropdowns, checklists, and staff access reflect the current admin-managed data.
  - **Covered by:** R1, R2, R3, R4, R5, R16

- F2. Lab produces and dispatches gelato
  - **Trigger:** Lab produces one or more pans for stores or events.
  - **Actors:** A2, A3, A6
  - **Steps:** Lab selects a catalog flavour, records production details, assigns one pan ID per physical pan, and dispatches selected pans to a store.
  - **Outcome:** Lab inventory decreases or changes state as dispatches are created, and destination stores see incoming stock for acceptance.
  - **Covered by:** R6, R7, R8, R9

- F3. Store receives and moves gelato
  - **Trigger:** A store receives a dispatch or moves a pan from backup storage to display.
  - **Actors:** A4, A5, A6
  - **Steps:** Store staff accept incoming dispatched pans, then later enter or select a pan ID to move a pan to display. If the pan is partial, weight is required.
  - **Outcome:** Store inventory distinguishes backup, display, and event stock with clear pan-level status.
  - **Covered by:** R8, R9, R10

- F4. Store submits end-of-day inventory
  - **Trigger:** Store closes for the day.
  - **Actors:** A4, A5, A6
  - **Steps:** Staff weigh only display gelato pans and complete the generated supply checklist for that store. Store manager can correct same-day submissions.
  - **Outcome:** Closing inventory records exist for gelato display stock and store supplies without requiring a full deep-freezer count.
  - **Covered by:** R11, R12, R13, R14

- F5. Staff attendance is recorded
  - **Trigger:** Staff arrive for or leave a shift.
  - **Actors:** A1, A2, A3, A4, A5, A6
  - **Steps:** Staff check in and check out through the app. Admin manages staff records, allowed holidays per staff member, and bonus days.
  - **Outcome:** Admin has a usable attendance roster and attendance inputs for payroll review.
  - **Covered by:** R16, R17, R18, R19

---

## Requirements

**Catalog and master data**
- R1. The MVP must remove hardcoded operational lists from staff workflows; flavours, stores, products, supplies, raw materials, packaging/serving items, and staff-facing inventory categories must come from backend-managed data.
- R2. Admin must be able to add, edit, deactivate, and remove catalog categories and items from the app.
- R3. Catalog items must be classifiable as used by Lab, Store, or Both; inventory quantities remain separate per lab/store location after catalog setup.
- R4. Store staff and lab staff must not be able to create catalog items; they can only select from approved catalog data and update operational records.
- R5. MVP setup should seed the catalog from the useful existing lists in `index.html`, including current flavours, stores, lab raw materials, lab supplies, and store supplies.

**Gelato inventory and pan movement**
- R6. Lab production must create one record per physical gelato pan, tied to a flavour, production date, pan type, optional weight, and pan role.
- R7. Every physical gelato pan must have a simple staff-friendly pan ID using a short flavour code, numeric date, and sequence number.
- R8. `panRole` remains part of the product language and supports `store`, `backup`, `display`, and `event`; store-role lab dispatches arrive as backup stock and event-role dispatches arrive as event stock.
- R9. Store acceptance of incoming dispatches must add accepted pans to store inventory and a received log; rejection must not add the pans to inventory.
- R10. Moving a pan to display must be driven by pan ID and require staff to mark whether the pan is Full or Partial; if Partial, weight is mandatory.
- R11. End-of-day gelato inventory must require weighing only pans currently in display, not counting every deep-freezer backup pan.
- R12. Store managers must be able to correct same-day store inventory submissions, and Admin must be able to correct historical inventory records without mandatory reason notes in MVP.

**Supplies and other inventory**
- R13. Lab raw materials, lab supplies, store supplies, packaging, serving supplies, and other operationally counted items must be managed as inventory by location.
- R14. Store end-of-day supply counting must be presented as a checklist generated from that store's approved catalog items.
- R15. Sellable products belong in the operations app only when they need operational counting, production, replenishment, receiving, or management; POS-only cataloging is deferred.

**Attendance and staff roster**
- R16. Staff must be able to check in and check out daily through the app, using the simple app login experience rather than any Supabase-facing workflow.
- R17. Admin must be able to add, deactivate, reactivate, and update staff records, including role and default store where relevant.
- R18. Admin must be able to control allowed holidays per staff member and add bonus days for staff.
- R19. Admin must have an attendance roster view suitable for reviewing daily attendance and payroll-related attendance state.

**Backend and persistence posture**
- R20. Supabase is the selected backend for MVP persistence and app-backed authentication/authorization, while staff experience remains mobile number plus password inside the app.
- R21. MVP records should preserve the current user/location context for submissions and corrections where useful, but an immutable audit log and reason-required correction flow are deferred.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R5.** Given Admin adds a new flavour in Catalog, when Lab Staff opens production entry, the new flavour is available without editing code.
- AE2. **Covers R3, R13, R14.** Given Admin marks an item as Store inventory, when Store Staff opens end-of-day supplies, that item appears in the store checklist while lab quantities remain separate.
- AE3. **Covers R4.** Given Store Staff is counting supplies and notices a missing item, when they use the app, they cannot create a new catalog item and must ask Admin to add it.
- AE4. **Covers R6, R7, R8, R9.** Given Lab creates three pans of a flavour and dispatches two to Rajpur, when Rajpur accepts the dispatch, those two pan IDs become Rajpur backup or event inventory according to `panRole`.
- AE5. **Covers R10.** Given Store Staff enters a pan ID to move it to display, when they choose Partial, the app requires weight before saving the movement.
- AE6. **Covers R11, R14.** Given it is end of day, when Store Staff submits closing inventory, they weigh display pans and complete the supply checklist without being asked to count every backup freezer pan.
- AE7. **Covers R12.** Given a store staff member submitted an incorrect same-day count, when Store Manager corrects it, the corrected value becomes the official MVP value without a mandatory reason note.
- AE8. **Covers R16, R17, R18, R19.** Given Admin configured staff and allowed holidays, when staff check in/out through the app, Admin can review attendance and apply bonus days where needed.

---

## Success Criteria

- Store and lab teams can run one real day of operations from the app without hardcoded inventory data.
- Admin can maintain all master data needed for MVP workflows without developer intervention.
- Lab-to-store gelato movement is traceable by pan ID from production through store acceptance and display movement.
- End-of-day store counts capture display gelato weights and supply counts with minimal staff friction.
- Attendance and roster management are usable enough for daily staff tracking and payroll review.
- A planner can move from this document to `ce-plan` without inventing persona permissions, MVP scope, or deferred POS behavior.

---

## Scope Boundaries

- QueueBuster connection, POS CSV ingestion, and POS reconciliation are deferred.
- Events page and event operations are deferred, even though existing manuals and `index.html` include event concepts.
- Morning inventory verification is deferred, but the MVP should not block adding it later.
- Full immutable audit trail, correction reason requirements, and detailed change history are deferred.
- Native iOS/Android apps are out of scope; MVP is browser-based and may later become a PWA.
- Staff-created catalog items are out of scope.

---

## Key Decisions

- Operations-First MVP: Physical inventory and attendance come before POS reconciliation.
- Supabase selected: The MVP will use Supabase as the backend/database direction, subject to account inspection during planning.
- Browser-based first: Phone-friendly web workflows are preferred over native app development.
- Admin-only catalog: Master data is controlled centrally; staff workflows stay simple.
- `panRole` remains: The existing role language is accepted and should align with the manuals.
- Simple pan IDs: Staff-friendly IDs are required, even if flavour-code collision handling remains open.
- POS CSVs later: Future QueueBuster data should likely be stored as import/reconciliation staging data, not as the operational source of truth.

---

## Dependencies / Assumptions

- Supabase setup exists partly and must be inspected before implementation planning.
- The four training manuals remain the source of truth for Release 1.0 persona workflows unless explicitly revised.
- Store staff mostly use phones, so workflows must minimize typing and avoid exposing backend concepts.
- Full pan weight defaults and production weight behavior can be finalized during planning from current operations practice.
- QueueBuster credentials must never be committed to Git or exposed in front-end code.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R7][User decision] How should flavour-code collisions be handled in pan IDs? Likely answer: Admin assigns a short flavour code once per flavour.
- [Affects R20][Technical] What parts of the existing Supabase project already exist, and what needs to be completed or replaced?
- [Affects R15][User decision] Which non-gelato sellable products are operationally counted on day one versus added later as catalog categories mature?
- [Affects POS deferral][Technical] When POS work starts, should parsed QueueBuster CSV rows live in Supabase staging records, or should only source files be retained with reconciliation computed on demand?
