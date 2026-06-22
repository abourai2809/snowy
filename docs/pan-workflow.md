# Pan Workflow

This document is the product reference for the end-to-end journey of a gelato pan. Use it when changing lab production, dispatch, store receiving, display movement, EOD gelato counts, empty-pan counts, or lab return workflows.

## Product Decisions

- The app assigns a pan ID at production time, one ID per physical pan.
- Pan ID is operational. Batch ID is separate and supports traceability.
- Lab production and lab dispatch are separate workflows. Production creates lab inventory; dispatch moves selected available pans to a store.
- Store display movement should be FIFO-guided. Staff choose a flavour, and the app recommends the oldest eligible deep-freezer pan for that flavour.
- One store and flavour should have at most one open or partial pan. This is stricter than the older issue #51 wording if that issue still says two.
- One store and flavour should have at most one active display-assigned pan.
- If staff brings out a replacement pan because the old display pan is too low, the old pan is marked empty/depleted in the app, even if a small physical amount remains.
- The app-calculated empty-pan count comes from lifecycle events. Physical empty-pan counts are a reconciliation workflow.
- Detailed pan-to-pan consolidation/refill tracking remains deferred.

## Core States

- `lab_available`: produced and available in lab inventory.
- `in_transit_to_store`: dispatched by lab and awaiting store acceptance.
- `store_backup`: accepted by store and physically in backup/deep freezer.
- `display_assigned`: active display pan for a store and flavour.
- `partial_open`: non-empty opened pan returned to deep freezer.
- `depleted_empty`: closed zero-weight pan counted as an empty pan at the store.
- `empty_return_in_transit`: empty pans sent from store back to lab, awaiting lab receipt.
- `lab_empty_received`: lab has accepted returned empty pans.

## Flowchart

The maintained color flowchart is now in [staff-guides/pan-workflow/flowchart.md](staff-guides/pan-workflow/flowchart.md). It shows where Lab Staff, Store Staff, Store Manager, and Admin interact with the pan workflow.

## Workflow Details

### Production

Lab records flavour, production date, pan count, full pan weight when known, and notes. The app creates a batch and one pan record per physical pan. The app generates staff-friendly pan IDs immediately so lab staff can label pans before storage or dispatch.

### Lab Dispatch

Lab dispatch selects from lab-available pans only. A pan that is already dispatched, closed, or otherwise unavailable cannot be dispatched again. Dispatch changes selected pans to in transit and removes them from lab available inventory.

### Store Receiving

Store staff accept or reject incoming dispatches. Accepted pans become store backup/deep-freezer stock. Rejected pans do not enter store inventory.

If a rejection was accidental, the store can overturn the rejection from the rejected queue and accept the pan, provided the dispatch has not already been otherwise resolved. The overturn must create an audit/receipt record.

### FIFO Display Movement

Display movement starts with flavour. The app should recommend the oldest eligible store-backup pan for that flavour. Staff may need an override path, but overrides should be logged.

If no active display pan exists for that store and flavour, the selected FIFO pan moves to display and becomes the active display-assigned pan.

If an active display pan already exists, staff use a guided swap workflow. Guided swap is one action that checks out the old display pan and checks in the new display pan together.

### Guided Swap Outcomes

The old pan can be handled three ways:

- Empty: mark depleted/empty and increase the app-calculated empty-pan count.
- Too low: treat as depleted/empty even if a small physical amount remains, then increase the app-calculated empty-pan count.
- Still usable partial: keep it as the one open/partial pan for that store and flavour, unless that would violate the one-open-partial rule.

### EOD Gelato Count

EOD staff should enter display weight by flavour. The backend uses active display assignment and pan history to attach the weight to a pan whenever possible.

If there is exactly one active display pan for a flavour, the EOD weight is assigned to that pan.

If there is no active display pan, save the flavour-level count and flag it as unmatched for manager/Admin review.

If there are multiple active display pans, this is invalid state. The app may use FIFO allocation only to avoid blocking close, but it must flag the case for review.

If the entered weight is over known capacity or otherwise suspicious, flag correction/review instead of silently applying lifecycle changes.

At EOD:

- Zero weight closes the pan as depleted/empty.
- Positive weight returns the pan to deep freezer as the one partial/open pan.

### Empty-Pan Reconciliation

The app-calculated empty-pan count comes from pans marked depleted/empty at the store. Physical reality can differ because a low pan may be treated as empty in the app while still physically holding a small amount.

Stores need a beginning-of-day or end-of-day physical empty-pan count. Staff record the number of physical empty pans present at the store. The app compares that physical count to the app-calculated count.

If the counts differ, the app flags the discrepancy for Store Staff, Store Manager, and Admin. The flag should include store, business date, physical count, app-calculated count, variance, actor, timestamp, and notes.

### Empty-Pan Return To Lab

Stores need a reverse-dispatch workflow for empty pans. Store staff enter how many empty pans are being sent back to the lab. The return remains in transit until lab staff accept it.

Creating an active return decreases the store app-calculated empty-pan count immediately so the same empty pans cannot be sent twice. Lab acceptance records the lab receipt. If lab disputes the quantity, the return should stay open for correction/review.

## Contingencies

- Store staff must confirm active store before store inventory workflows. Browser location mismatch should warn, not hard-block.
- Staff cannot move a pan to display when no eligible pan exists.
- Staff cannot create a second active display assignment for the same store and flavour.
- Staff cannot create more than one open/partial pan for the same store and flavour without manager/Admin resolution.
- Staff should not be blocked from closing EOD because of invalid historical state; record enough data to continue, but flag review.
- Store Manager can correct same-day store inventory. Admin can correct historical records.
- POS/QueueBuster reconciliation is deferred and should not be treated as the source of truth for pan state.

## Related Issues

- #12: Deferred morning inventory verification.
- #34: Deferred pan-to-pan consolidation/refill tracking.
- #51: Warn and notify Admin on partial pan rule violations. Product decision is now one open/partial pan, not two.
- #52: Track empty pan returns from stores to lab.
- #53: Reconcile physical empty-pan counts against app-calculated empties.
