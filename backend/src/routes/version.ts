import { Router } from "express";
import { sendOk } from "@/lib/response";
import { getAppVersion } from "@/lib/version";

// GET /api/version — which build of the API is running.
//
// Deliberately open, unlike every other route here: it carries nothing but a
// build number, and the moment it is most needed is when a phone is stuck on
// an old cached build and its user cannot even get past the login screen. A
// version check that requires a working session would be no use precisely
// then.
const router = Router();

router.get("/", (_req, res) => {
  sendOk(res, { version: getAppVersion() });
});

export default router;
