import { Router } from "express";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { APIError } from "better-auth";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import {
  createStaffUser,
  hasUsablePassword,
  normalizeEmail,
  revokeAllSessions,
  setUserPassword,
  usersWithPassword,
} from "@/lib/credentials";
import { findUsersWithHistory, hasUserHistory } from "@/lib/userHistory";
import { sendPasswordSetupEmail } from "@/lib/passwordSetup";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from "@/validation/user";
import { findUserByPhoneField } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";
import type { SerializableUser } from "@/types";

// Staff management — Admin only (CLAUDE.md rule 5). `idNumber` is Admin-only
// data (rule 19); since this whole router is Admin-gated that's automatically
// satisfied, but the serializer still exists to keep the shape explicit and
// to strip Better Auth internals (no password/hash ever leaves this file).
const router = Router();
router.use(requireAuth, requirePermission("user.manage"));

function serializeUser(user: SerializableUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    whatsapp: user.whatsapp,
    idNumber: user.idNumber,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * What the screen shows, which is the staff row PLUS whether the account has
 * ever been finished off.
 *
 * `hasPassword` is deliberately separate from `isActive`: an account is
 * created with no password at all and its owner chooses one from an emailed
 * link (CLAUDE.md rule 17), so "enabled but nobody has ever signed in with
 * it" is a real and common state — and without it on the screen there is no
 * way to tell who is still waiting on their link. It is a boolean and never
 * the hash, the way it was set, or when: none of that is anybody's business,
 * including an Admin's.
 *
 * `hasHistory` is the other half of the same idea and answers the question
 * the remove button has to ask before it offers anything: has this account
 * ever taken an order, recorded an expense, counted a drawer or written a
 * single audit entry? If it has, "remove" can only mean deactivate — its name
 * is on records that exist to say who did what (lib/userHistory.ts).
 *
 * Both are kept out of `serializeUser` on purpose — that one feeds the audit
 * trail too, and an audit entry should record what an Admin CHANGED, not
 * facts about the account that they did not touch.
 */
function serializeUserWithState(user: SerializableUser, hasPassword: boolean, hasHistory: boolean) {
  return { ...serializeUser(user), hasPassword, hasHistory };
}

/**
 * The two extra lookups, for the routes that answer with a single account.
 *
 * The list endpoint does NOT use this — it asks both questions once for the
 * whole page instead of twice per row (see below).
 */
async function serializeUserForResponse(user: SerializableUser) {
  const [hasPassword, hasHistory] = await Promise.all([
    hasUsablePassword(user.id),
    hasUserHistory(user.id),
  ]);
  return serializeUserWithState(user, hasPassword, hasHistory);
}

/**
 * Refuses the edit that would leave the shop with no Admin.
 *
 * Demoting or deactivating the last one is a door that locks from the
 * outside: approving a change request, reaching Settings, managing staff and
 * seeing cost or profit are all Admin-only, so afterwards nobody can do any of
 * them and nothing in the app can undo it — it takes `npm run init` or a hand
 * in the database.
 *
 * Counted over ACTIVE admins, because a deactivated one cannot sign in to
 * rescue anything either. Deliberately not a permission check: an Admin is
 * entitled to make this change, and would be entitled to make it if there
 * were two of them. What is refused is the arithmetic.
 */
async function assertNotLastAdmin(
  existing: { id: string; role: Role; isActive: boolean },
  body: { role?: Role; isActive?: boolean }
): Promise<void> {
  const wasActiveAdmin = existing.role === Role.ADMIN && existing.isActive;
  if (!wasActiveAdmin) return;

  const stillActiveAdmin = (body.role ?? existing.role) === Role.ADMIN && (body.isActive ?? existing.isActive);
  if (stillActiveAdmin) return;

  const others = await prisma.user.count({
    where: { role: Role.ADMIN, isActive: true, id: { not: existing.id } },
  });
  if (others === 0) throw new AppError(409, ERROR_CODES.USER_LAST_ADMIN);
}

async function assertPhonesAvailable(input: { phone?: string; whatsapp?: string | null }, excludeUserId?: string) {
  if (input.phone) {
    const dupe = await findUserByPhoneField("phone", input.phone, excludeUserId);
    if (dupe) throw new AppError(409, ERROR_CODES.PHONE_DUPLICATE);
  }
  if (input.whatsapp) {
    const dupe = await findUserByPhoneField("whatsapp", input.whatsapp, excludeUserId);
    if (dupe) throw new AppError(409, ERROR_CODES.WHATSAPP_DUPLICATE);
  }
}

// ---------------------------------------------------------------------------
// GET /api/users — list staff (pagination + filtering)
// ---------------------------------------------------------------------------
router.get(
  "/",
  validateQuery(listUsersQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListUsersQuery;
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { email: { contains: query.q, mode: "insensitive" as const } },
              { phone: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    // Both extra facts asked ONCE for the whole page rather than twice per
    // row — `hasHistory` in particular spans ten tables, and doing it per row
    // would be ten queries per member of staff on every list render.
    const ids = users.map((user) => user.id);
    const [activated, withHistory] = await Promise.all([usersWithPassword(ids), findUsersWithHistory(ids)]);

    sendOk(res, users.map((user) => serializeUserWithState(user, activated.has(user.id), withHistory.has(user.id))), {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/users/:id — detail
// ---------------------------------------------------------------------------
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);
    sendOk(res, await serializeUserForResponse(user));
  })
);

// ---------------------------------------------------------------------------
// POST /api/users — create a staff account via Better Auth
// ---------------------------------------------------------------------------
router.post(
  "/",
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateUserInput;

    // Checked against the SAME spelling the account will be stored under, and
    // that sign-in will later look up by. Comparing the raw value let
    // "Sara@..." past a stored "sara@...", and the collision then surfaced as
    // a unique-constraint failure dressed up as error.auth.signup_failed.
    const email = normalizeEmail(body.email);
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) throw new AppError(409, ERROR_CODES.EMAIL_DUPLICATE);
    await assertPhonesAvailable(body);

    // Through Better Auth's own internal adapter rather than through its
    // public sign-up endpoint, which is now disabled outright: that endpoint
    // was reachable by anybody on the internet, and an account created by
    // "somebody filled in a form" is not a staff account (lib/auth.ts).
    //
    // No password given => no credential row at all, so there is no secret
    // anywhere that would let anybody in. The person chooses one from the
    // emailed link below (CLAUDE.md rule 17).
    let created: Awaited<ReturnType<typeof createStaffUser>>;
    try {
      created = await createStaffUser({
        email,
        name: body.name,
        role: body.role,
        phone: body.phone,
        whatsapp: body.whatsapp ?? null,
        idNumber: body.idNumber ?? null,
      });
    } catch (err) {
      if (err instanceof APIError) throw new AppError(400, ERROR_CODES.AUTH_SIGNUP_FAILED);
      throw err;
    }

    if (body.password) {
      await setUserPassword(created.id, body.password);
    }

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.USER,
      entityId: created.id,
      newValue: serializeUser(created),
    });

    // After the writes, never inside them, and never awaited on the mail
    // itself: a mail provider having a bad afternoon must not turn "the
    // account was created" into a 500 (see lib/email/index.ts). If it fails,
    // it lands in error tracking and the Admin can send another from the
    // users screen.
    if (!body.password) {
      await sendPasswordSetupEmail(created, "SET");
    }

    // A brand-new account has no history by construction — it has not had
    // the chance — so this is stated rather than looked up.
    sendOk(res, serializeUserWithState(created, Boolean(body.password), false), null, 201);
  })
);

// ---------------------------------------------------------------------------
// POST /api/users/:id/password-reset — email this person a set-password link
//
// Admin only, like everything else on this router. The link is single-use and
// short-lived, and issuing it invalidates any earlier one.
//
// The link is RETURNED as well as emailed, deliberately: an Admin already
// holds unrestricted password authority over every account (PATCH below sets
// one outright), so this hands them nothing they did not have — and it is
// what lets the shop pass a link over WhatsApp when somebody's mailbox is
// unreachable, which is the situation this whole flow has to survive.
// ---------------------------------------------------------------------------
router.post(
  "/:id/password-reset",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);

    const invite = await sendPasswordSetupEmail(user, "RESET");

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.REQUEST,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      // The link itself is never written to the trail.
      newValue: { passwordReset: "REQUESTED", source: "ADMIN", expiresAt: invite.expiresAt },
    });

    sendOk(res, { email: user.email, url: invite.url, expiresAt: invite.expiresAt });
  })
);

// ---------------------------------------------------------------------------
// POST /api/users/:id/resend-invite — send the SET-UP link again
//
// The everyday answer to "I never got my email". Deliberately NOT the same
// endpoint as the reset above, even though both put a link in the post:
//
//   * this one is refused once the account HAS a password. Somebody who has
//     finished setting up is not pending, and "resend the invitation" is then
//     the wrong description of what would happen — it would quietly become a
//     password reset, which is a different decision with a different button;
//   * it carries the SET purpose, so the link lasts 72 hours (a new member of
//     staff may not read their mail until the next shift) and the email says
//     "choose your password" rather than "you asked to reset it".
//
// A deactivated account gets nothing: there is no point setting a password on
// an account that cannot sign in, and sending one would say the opposite.
// ---------------------------------------------------------------------------
router.post(
  "/:id/resend-invite",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);
    if (!user.isActive) throw new AppError(409, ERROR_CODES.ACCOUNT_INACTIVE);
    if (await hasUsablePassword(user.id)) throw new AppError(409, ERROR_CODES.USER_ALREADY_ACTIVATED);

    const invite = await sendPasswordSetupEmail(user, "SET");

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.REQUEST,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      // The link itself never goes into the trail.
      newValue: { passwordSetup: "RESENT", source: "ADMIN", expiresAt: invite.expiresAt },
    });

    // Handed back for the same reason as the reset's (see above): a mailbox
    // that bounces is a real thing in this shop, and an Admin already holds
    // unrestricted password authority over every account.
    sendOk(res, { email: user.email, url: invite.url, expiresAt: invite.expiresAt });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/users/:id — update profile / role / deactivate / reset password
// ---------------------------------------------------------------------------
router.patch(
  "/:id",
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);

    const body = req.body as UpdateUserInput;
    await assertPhonesAvailable(body, existing.id);

    // Turning your own account off. Refused rather than merely discouraged:
    // it ends the session making the request halfway through. Editing
    // yourself is fine — a name, a phone number — so this is checked on the
    // transition, not on the route.
    //
    // Checked BEFORE the last-Admin rule, because on a shop with one Admin
    // both are true at once and this is the more useful of the two answers:
    // "you cannot remove your own account" is what the person actually did,
    // and it stays the reason however many Admins there are. Reaching for
    // "there would be no Admin left" first would tell somebody with a
    // colleague to promote that promoting them fixes it, which it does not.
    const deactivating = body.isActive === false && existing.isActive;
    if (deactivating && existing.id === req.user!.id) {
      throw new AppError(409, ERROR_CODES.USER_SELF_REMOVAL);
    }

    await assertNotLastAdmin(existing, body);

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        role: body.role,
        phone: body.phone,
        whatsapp: body.whatsapp === undefined ? undefined : body.whatsapp,
        idNumber: body.idNumber === undefined ? undefined : body.idNumber,
        isActive: body.isActive,
      },
    });

    // DEACTIVATION HAS TO REACH THE SESSIONS THEY ALREADY HAVE.
    //
    // `isActive: false` on its own only blocks the NEXT sign-in. Everyone
    // signed in stays signed in — requireAuth reads the flag on every request
    // (middleware/auth.ts), so it would refuse them, but the bearer token in
    // their phone's localStorage is still a real token against a real session
    // row, and anything that ever reads a session without that check would
    // still let them through. Somebody walked out of the shop this morning;
    // "they cannot sign in again" is not the same promise as "they are out".
    //
    // Same call the emailed password link makes for the same reason
    // (routes/passwordSetup.ts): a reset that leaves the old session alive is
    // decorative, and so is a deactivation.
    if (deactivating) {
      await revokeAllSessions(updated.id);
    }

    // The admin-set fallback (CLAUDE.md rule 17), kept alongside the emailed
    // link for the member of staff whose mailbox is unreachable. Hashing and
    // the credential-account write live in lib/credentials.ts, shared with
    // the emailed-link path so the two can never drift apart.
    if (body.password) {
      await setUserPassword(existing.id, body.password);
    }

    // "Who removed whom, and which kind" has to be answerable from the trail
    // on its own, so switching an account off is its own action rather than
    // an UPDATE somebody has to open and diff. Exactly the reasoning (and the
    // shape) of PUBLISH/HIDE on a product — see routes/products.ts.
    const action =
      body.isActive === undefined || body.isActive === existing.isActive
        ? AuditAction.UPDATE
        : body.isActive
          ? AuditAction.USER_REACTIVATED
          : AuditAction.USER_DEACTIVATED;

    await writeAudit({
      userId: req.user!.id,
      action,
      entityType: AUDIT_ENTITY.USER,
      entityId: updated.id,
      oldValue: serializeUser(existing),
      newValue: serializeUser(updated),
    });

    sendOk(res, await serializeUserForResponse(updated));
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/users/:id — erase an account that never did anything.
//
// The narrow half of "remove somebody". The broad half is deactivation above,
// and that is the one for anybody who has actually worked here: their name is
// on orders, expenses and drawer counts, and taking it off those records
// would defeat the design that puts it there (spec.md "Security rationale").
//
// This is for the account that should not exist — a typo'd email, a duplicate,
// somebody who was set up and never started. It removes the row and, by the
// schema's own cascades, the account's plumbing with it: sessions, the
// credential account holding the password hash, any unused password-setup
// links, and push subscriptions. It never removes a business record; if one
// exists the whole thing is refused (lib/userHistory.ts).
//
// Its own permission, `user.delete`, rather than the router's `user.manage`:
// editing a phone number and destroying an account are different powers.
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  requirePermission("user.delete"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, ERROR_CODES.USER_NOT_FOUND);

    // Deleting the account you are signed in as. Same refusal as deactivating
    // yourself, and for a sharper version of the same reason.
    if (existing.id === req.user!.id) throw new AppError(409, ERROR_CODES.USER_SELF_REMOVAL);

    // The lock-out guard, reused rather than restated — deleting the last
    // Admin is the demotion case taken to its conclusion.
    //
    // Unreachable as the roles stand, and kept deliberately: `user.delete` is
    // Admin-only, the caller must be active (requireAuth) and cannot be the
    // target (checked above), so there is always at least one other active
    // Admin left. It is here for the day that permission is widened — which
    // is the whole reason it is its own action — because that is exactly the
    // change that would otherwise open this hole quietly.
    await assertNotLastAdmin(existing, { isActive: false });

    // THE CHECK THAT MAKES THIS SAFE. Not left to the database: half these
    // relations are optional, and Prisma's default for those is SetNull — so
    // the delete would succeed and quietly blank the authorship out of every
    // approved expense and closed drawer this person touched. See
    // lib/userHistory.ts.
    if (await hasUserHistory(existing.id)) {
      throw new AppError(409, ERROR_CODES.USER_HAS_HISTORY);
    }

    // Written BEFORE the row goes, and deliberately carrying the whole
    // account: once this returns there is nothing left to look up, so the
    // trail is the only place this person is recorded as ever having existed.
    // The entry belongs to the Admin who did it, so it survives the deletion
    // it describes.
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.USER,
      entityId: existing.id,
      oldValue: serializeUser(existing),
      newValue: null,
    });

    // The check above and this delete are not one atomic operation, and the
    // database is the backstop that makes that gap safe: if this account took
    // an order in the moment between them, the required relations refuse the
    // delete outright. Translated back into the same answer the check gives,
    // so a caller who lost that race is told the true reason rather than
    // "something went wrong".
    //
    // Only the required half of those relations raises this — the optional
    // ones would silently SetNull — which is exactly why the check above is
    // the real guard and this is only the backstop.
    try {
      await prisma.user.delete({ where: { id: existing.id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new AppError(409, ERROR_CODES.USER_HAS_HISTORY);
      }
      throw err;
    }

    sendOk(res, { id: existing.id, deleted: true });
  })
);

export default router;
