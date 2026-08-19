import type { Role } from "@/types/role";

// Every action currently enforced across backend + admin (CLAUDE.md rule 5,
// spec.md "Roles & Permissions"). Adding a capability later means adding an
// entry here, to DEFAULT_ROLE_PERMISSIONS below, and to exactly one of
// PROTECTED_ACTIONS / CONFIGURABLE_ACTIONS — callers only ever call
// `can(user, action)` (see lib/permissions.ts) and never touch this list,
// which is what let the source of the rules move into the database
// (spec.md "Editable role permissions") without a single call site changing.
export const PERMISSION_ACTIONS = [
  "dashboard.view",

  "product.view",
  "product.create",
  "product.edit",
  // What a product SELLS for: basePrice, compareAtPrice and a variant's
  // priceOverride. Split out of product.edit so an Employee can fix a name,
  // a description or a category on a piece already on the shelf without
  // being able to re-price it — the money side stays with Admin/Manager.
  // `cost` is not here: it is invisible to an Employee entirely
  // (product.viewCost, CLAUDE.md rule 19).
  "product.editPrice",
  "product.delete",
  "product.hide",
  // WHICH variants a product has — adding combinations, or removing one.
  // Split out of product.edit for the same reason product.editPrice was: an
  // Employee may fix a name or a photo on a piece already on the shelf, but
  // changing what the piece even IS reaches its stock, its barcodes and its
  // labels all at once (spec.md "Employee change approvals"), so it stays
  // with Admin/Manager — and an Employee's attempt becomes a request.
  "product.editVariantSet",
  // What a piece COST the shop, and everything derived from it: COGS, gross
  // and net profit, margin, the inventory valuation at cost. ADMIN ONLY —
  // this is the owner's own margin, and it is not a Manager's to read
  // (CLAUDE.md rule 19). One action gates the field and every figure computed
  // from it, so there is no second place a profit number can slip out of.
  "product.viewCost",
  // Printing barcode labels and recording that they were printed. Held by
  // every role on purpose: an Employee may add products (spec.md), and a new
  // piece is useless on the shelf until its label is on it. It writes nothing
  // but the print timestamp — no price, stock or visibility — so it stays
  // clear of the edit/delete/hide gates an Employee must not pass.
  "product.printLabels",

  // The Reports screen and the endpoints behind it: sales by period, the
  // channel split, best sellers, returns, and — for whoever also holds
  // product.viewCost — cost, COGS, profit and margin. ADMIN ONLY.
  //
  // Its own action rather than a reuse of order.view, which was the bug this
  // replaces: order.view is held by an Employee so they can ring up and
  // follow the orders they take, and hanging the reports off it handed them
  // the shop's whole takings as a side effect. Reading ONE order you took is
  // not the same as reading EVERY order added up, so the two are now
  // different permissions. Modelled separately from product.viewCost as well,
  // even though both are Admin-only today: that one gates cost-derived
  // figures wherever they appear, this one gates a screen, and widening
  // either later must not silently widen the other.
  "report.view",

  "category.view",
  "category.manage",

  "inventory.view",
  "inventory.adjust",

  // Adding to the global option lists — a new type (Material), or a new
  // value under an existing one (Emerald). Additive only, which is what
  // makes it safe for an Employee to hold: it is part of adding a product
  // (spec.md "Inline add"), and nothing already on the shelf changes just
  // because a new colour exists.
  "variantType.create",
  // Changing or removing what is already there. A rename reaches every
  // product using that value (CLAUDE.md rule 2) and a deletion would pull it
  // out from under them, so this one stays with Admin/Manager.
  "variantType.manage",

  "images.edit",
  "images.delete",

  "order.view",
  "order.create",
  // Advancing an order along the flow, up to handing it to the courier
  // (spec.md: Employees "create + hand over" orders). Cancelling is NOT part
  // of this — it has its own action below, so an Employee can move an order
  // forward but never void it.
  "order.updateStatus",
  "order.edit",
  "order.cancel",
  "order.delete",
  // Reversing a sale, in whole or in part. Gated with cancel/delete rather
  // than with updateStatus for the same reason: a sale must not be undoable
  // by the person who rang it up.
  "order.return",
  // Recording that the delivery company has actually paid for an order.
  // Admin/Manager only: this is the shop's cash position, and the person who
  // took the order must not be able to declare its money received — the same
  // anti-theft reasoning that keeps cancel and delete out of their hands.
  "order.markCollected",
  // Giving stock away: an order of type GIFT, rung up at the POS, which
  // deducts stock exactly like a sale but takes no money. Admin/Manager only
  // — an Employee who could file a sale as a gift could walk out with the
  // piece, which is the same reasoning that keeps cancel and delete from
  // them.
  "order.createGift",

  // --- the cash drawer (spec.md "Cash drawer & expenses") ---
  // Opening the day's drawer, closing it against a physical count, and
  // reading what it says. Admin/Manager only, both halves: the count IS the
  // shop's cash position, so the person standing at the till must not be the
  // one who declares what should have been in it.
  "cashSession.view",
  "cashSession.manage",

  // --- expenses ---
  // Recording what the shop spent. Held by every role on purpose: whoever
  // pays the electricity bill should be able to write it down there and then.
  // An Employee's expense opens PENDING and buys nothing until it is
  // approved, so this is a request, not a payout.
  "expense.create",
  // Reading the expense list, which is the shop's spending laid bare —
  // Admin/Manager, like every other figure that adds up to profit.
  "expense.view",
  // Editing and deleting an expense after the fact.
  "expense.manage",
  // Signing off (or refusing) an expense someone else recorded.
  "expense.approve",

  // The category list an expense is filed under. Everyone may READ it —
  // picking "Utilities" is part of recording an expense — but changing the
  // list itself reaches every past expense, so it stays with Admin/Manager.
  "expenseCategory.view",
  "expenseCategory.manage",

  // --- change requests (spec.md "Employee change approvals") ---
  // Being allowed to ASK for a change you may not make yourself. Held by
  // every role, and only ever reached by someone who lacks the permission
  // that would apply the change outright: an Admin re-prices a piece, an
  // Employee asks to. Without it a gated action is simply refused, which is
  // what the flow looked like before this existed.
  "changeRequest.create",
  // Reading requests. Held by every role, but it does NOT mean "read
  // everyone's": the route narrows the list to your own unless you also hold
  // changeRequest.approve (see routes/changeRequests.ts). An Employee has to
  // be able to see that their price change is waiting rather than lost.
  "changeRequest.view",
  // Taking your OWN request back while it is still waiting. Held by every
  // role, and — like changeRequest.view — it does not mean "anybody's": the
  // route also checks that the caller is the one who asked. Somebody who
  // typed the wrong price should not have to occupy an Admin's attention to
  // undo it, but withdrawing is the asker's only. An Admin who disagrees
  // REJECTS, which stays on the record; a decided request can never be
  // withdrawn at all.
  "changeRequest.cancel",
  // Deciding one. ADMIN ONLY for now — this is the whole point of the gate,
  // and the person who asked must never be able to sign their own request
  // off. Modelled as its own action rather than as "is the user an Admin" so
  // that widening it later (a senior Manager, a second Admin tier) is one
  // entry in ROLE_PERMISSIONS below and nothing else.
  "changeRequest.approve",

  "user.manage",
  // ERASING a staff account, rather than editing or deactivating one.
  //
  // Its own action rather than part of user.manage, for the same reason
  // changeRequest.approve is not part of changeRequest.view: the two are
  // different powers that happen to sit on the same screen today. Editing
  // somebody's phone number and destroying their account permanently should
  // not be one permission, and widening who may do the first must not
  // silently widen the second.
  //
  // It is only ever reachable for an account with NO history — one order,
  // one expense or one audit entry and the API refuses and says to deactivate
  // instead (routes/users.ts). So this is the permission to tidy up a
  // mistake, not a permission to make somebody's work disappear.
  "user.delete",
  "user.viewSensitive",

  "settings.manage",

  // Editing this very table: which CONFIGURABLE actions each role holds
  // (spec.md "Editable role permissions"). ADMIN ONLY and PROTECTED, which
  // is not a detail — a permission to hand out permissions that could itself
  // be handed out is not a gate, it is a door with the key taped to it. It
  // can never be granted to another role, and an Admin can never take it
  // from their own, so there is no sequence of edits that ends with nobody
  // able to administer the shop.
  "permission.manage",
] as const;

type Action = (typeof PERMISSION_ACTIONS)[number];

// ===========================================================================
//  PROTECTED vs CONFIGURABLE (spec.md "Editable role permissions")
// ===========================================================================
//
// Which role holds which action is editable from the admin — but not all of
// it, and the split is declared here, next to the actions themselves, so that
// adding an action forces the question "may the shop switch this off?" at the
// moment it is written rather than the first time somebody tries.
//
// PROTECTED is the smaller list on purpose. It is not "the important ones" —
// it is the ones whose whole reason for existing is that somebody who works
// here cannot turn them off. Two kinds:
//
//   1. The anti-theft guarantees spec.md "Security rationale" is built on.
//      A sale cannot be erased, re-priced, given away or declared paid by the
//      person who rang it up, and nobody signs off their own spending. Every
//      one of those is only true while it CANNOT be granted away, because the
//      first thing an insider with an editable permission table would do is
//      grant themselves the one that hides what they did.
//   2. The keys to the building: who may read the owner's cost and profit,
//      who may manage staff, and who may edit this table. A locked-out Admin
//      is not recoverable from inside the app — it takes a terminal on the
//      VPS — so the path to locking one out is closed rather than warned
//      about.
//
// Everything else is CONFIGURABLE: real, useful decisions a shop makes about
// itself ("our Employees do handle stock", "our Manager prints the labels")
// that cost nothing if they are wrong and are put back with one tap.
//
// The two lists are exhaustive and disjoint over PERMISSION_ACTIONS, checked
// at module load below — a new action that lands in neither (or in both) is a
// crash on boot, not a permission that silently cannot be resolved.

/**
 * Never editable, by anyone, through any UI or API.
 *
 * `can()` resolves these from DEFAULT_ROLE_PERMISSIONS alone and never looks
 * at the stored config, so an action that reaches this list is beyond the
 * reach of the permissions screen, the API behind it, and a hand-written row
 * in the database alike.
 */
export const PROTECTED_ACTIONS = [
  // --- the owner's own figures (CLAUDE.md rule 19) ---
  // What each piece cost and therefore what the shop earns on it. Admin only,
  // and the one gate over cost, COGS, gross/net profit, margin and the
  // inventory valuation at cost wherever any of them appear.
  "product.viewCost",
  // The Reports screen: every order the shop has ever taken, added up. Admin
  // only, and separately from product.viewCost so that widening one can never
  // widen the other.
  "report.view",
  // A staff member's ID number.
  "user.viewSensitive",

  // --- a sale, after the fact (spec.md "Security rationale") ---
  // Re-pricing. "Nothing can be sold cheap and pocketed" is only a guarantee
  // while the re-pricing permission cannot be handed to whoever is at the
  // counter.
  "product.editPrice",
  // Changing, voiding or erasing a sale that has already been rung up.
  "order.edit",
  "order.cancel",
  "order.delete",
  // Taking one back, in whole or in part — the same power as cancelling,
  // under a different name, so it is protected with it rather than left as
  // the way round.
  "order.return",
  // Filing a sale as a gift: the same as re-pricing it to zero, so it is
  // protected for the same reason.
  "order.createGift",
  // Declaring that the delivery company's money arrived. The person who took
  // the order must never be the person who says it was paid for.
  "order.markCollected",

  // --- signing things off ---
  // Deciding somebody else's gated change (spec.md "Employee change
  // approvals"). The gate is the whole design; a grantable approval
  // permission is a gate anybody can walk around.
  "changeRequest.approve",
  // Whether your OWN expense is approved as you write it (routes/expenses.ts).
  // Held here rather than among the configurable expense actions because it
  // is self-approval by another name: granted to whoever spends the money, it
  // takes cash out of the drawer with nobody's agreement but their own.
  "expense.approve",

  // --- the keys to the building ---
  // Creating staff, changing their role, deactivating them.
  "user.manage",
  // Erasing an account outright (only ever possible for one with no history).
  "user.delete",
  // Editing this table. Never grantable, never removable — see the note on
  // the action itself above.
  "permission.manage",
] as const satisfies readonly Action[];

/**
 * Editable per role from the admin's Permissions screen, stored in the
 * database, and resolved by `can()` from there.
 *
 * Everything PROTECTED_ACTIONS does not claim. Derived rather than typed out
 * a second time, so the two can never drift apart or leave an action in
 * neither list.
 */
export const CONFIGURABLE_ACTIONS = PERMISSION_ACTIONS.filter(
  (action) => !(PROTECTED_ACTIONS as readonly string[]).includes(action)
) as readonly Exclude<Action, (typeof PROTECTED_ACTIONS)[number]>[];

// The split is exhaustive by construction (CONFIGURABLE is the complement),
// so the only way to break it is to protect something that is not an action
// at all — a typo, or an action deleted from the list above while its entry
// here stayed. `satisfies` catches that at compile time; this catches it at
// runtime too, because the apps ship compiled JavaScript and a stale build is
// exactly when a typo would otherwise become "that permission is silently
// configurable".
for (const action of PROTECTED_ACTIONS) {
  if (!(PERMISSION_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`PROTECTED_ACTIONS names "${action}", which is not a permission action.`);
  }
}

// spec.md "Roles & Permissions" table, verbatim:
// Admin: everything. Manager: products/stock/orders full, no users/settings,
// AND NO COST OR PROFIT. Employee: POS, add and edit products, edit images,
// create + hand over orders — cannot delete/hide products, cannot
// delete/edit/cancel orders, cannot mark money collected, no users/settings,
// no cost/idNumber visibility, and none of the dashboard, the reports or the
// inventory list: all three are shop-wide overviews (takings, stock levels,
// inventory value, low-stock alerts) that belong to whoever runs the shop,
// which an Employee does not. An Employee sees the orders they take and
// nothing added up.
//
// Reports are ADMIN ONLY (report.view): the sales, cost, profit and margin
// figures on that screen are the owner's read of the business, and a Manager
// gets what they need to run the floor from the dashboard instead — sold,
// received and still owed, with every cost-derived figure absent from their
// payload.
//
// Cost and profit are ADMIN ONLY (spec.md "Sensitive fields"). A Manager runs
// the shop floor — stock, orders, the drawer, what was spent — but what each
// piece cost the owner, and therefore what the shop earns on it, is the
// owner's alone. product.viewCost is the single gate: dropping it from
// MANAGER below is what removes cost from products, unitCost from order
// lines, the cost basis from the inventory valuation, and COGS / gross
// profit / net profit / margin from every report, all at once.
// Editing a product is the details only — its price is product.editPrice,
// its stock inventory.adjust, its visibility product.hide, none of which an
// Employee holds. On the global option lists they may add (variantType.create,
// so the inline add on the product form keeps working) but not rename or
// remove (variantType.manage), which would reach every product at once.
/**
 * The rules as shipped — the shop's behaviour on day one, and for PROTECTED
 * actions for ever.
 *
 * Two different jobs, which is worth being explicit about:
 *   - the PROTECTED half is the live rule. `can()` reads it directly and
 *     nothing can override it.
 *   - the CONFIGURABLE half is the SEED. `npm run bootstrap` copies it into
 *     the RolePermission table once in the life of a database (CLAUDE.md rule
 *     11), and it is also the fallback `can()` uses for any grant the stored
 *     config has no row for — a permission added in a later release, on a
 *     database bootstrapped before it existed, behaves exactly as it does
 *     here until somebody decides otherwise.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  ADMIN: [...PERMISSION_ACTIONS],
  MANAGER: [
    "dashboard.view",
    "product.view",
    "product.create",
    "product.edit",
    "product.editPrice",
    "product.delete",
    "product.hide",
    "product.editVariantSet",
    // NOTE: no "product.viewCost" — cost and profit are Admin only.
    // NOTE: no "report.view" either — the Reports screen is Admin only. The
    // dashboard (dashboard.view, above) carries the sales figures a Manager
    // runs the floor on.
    "product.printLabels",
    "category.view",
    "category.manage",
    "inventory.view",
    "inventory.adjust",
    "variantType.create",
    "variantType.manage",
    "images.edit",
    "images.delete",
    "order.view",
    "order.create",
    "order.updateStatus",
    "order.edit",
    "order.cancel",
    "order.delete",
    "order.return",
    "order.markCollected",
    "order.createGift",
    "cashSession.view",
    "cashSession.manage",
    "expense.create",
    "expense.view",
    "expense.manage",
    "expense.approve",
    "expenseCategory.view",
    "expenseCategory.manage",
    // A Manager holds every gated permission outright, so they never file a
    // request — but they carry the action anyway, so that gating a NEW field
    // above them later needs no change here. What they do NOT hold is
    // changeRequest.approve: deciding someone else's request is the Admin's,
    // which is the whole reason the gate exists.
    "changeRequest.create",
    "changeRequest.view",
    "changeRequest.cancel",
  ],
  EMPLOYEE: [
    "product.view",
    "product.create",
    "product.edit",
    "product.printLabels",
    "category.view",
    "variantType.create",
    "images.edit",
    "order.view",
    "order.create",
    "order.updateStatus",
    // Whoever pays the bill writes it down. It opens PENDING and needs an
    // Admin/Manager to approve it before it touches the drawer or the books,
    // so recording one spends nothing on its own.
    "expense.create",
    // ...and to record one they have to be able to read the category list.
    "expenseCategory.view",
    // The five gated actions (price, manual stock, image deletion,
    // hide/unhide, the variant set) are refused to an Employee outright —
    // these two are what turn that refusal into a request an Admin can say
    // yes to, and what lets them watch it waiting (spec.md "Employee change
    // approvals").
    "changeRequest.create",
    "changeRequest.view",
    // ...and to take one back when they typed it by mistake, rather than
    // waiting for an Admin to turn down something nobody wanted.
    "changeRequest.cancel",
  ],
};
