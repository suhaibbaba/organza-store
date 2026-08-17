import { getTranslations } from "next-intl/server";
import { APP_VERSION } from "@/lib/env";
import {
  BOOT_SUPPORT_PROBE,
  BOOT_WATCHDOG_MS,
  PWA_BACKGROUND_COLOR,
  PWA_SPLASH_FOREGROUND_COLOR,
} from "@/constants/pwa";

/**
 * What replaces the boot splash when the app never starts.
 *
 * The splash (components/pwa/boot-splash.tsx) is server-rendered HTML, and the
 * only thing that ever takes it down is React mounting. So when React does not
 * mount — the bundle met syntax this browser cannot parse and refused the
 * whole chunk, a script never arrived, an uncaught error killed hydration —
 * the splash stays up with its dots pulsing, forever, and a dead app is
 * indistinguishable from a slow one. That is the bug an iPhone 7 showed us:
 * staff stared at a loading screen for a browser that had already given up.
 *
 * This is the other half of the fix from `browserslist` in package.json. That
 * one makes the app run on the old phone; this one makes sure that the day
 * something *does* break, the phone says so.
 *
 * Everything below has to work with the app's own JavaScript entirely absent,
 * which shapes all of it:
 *
 *   - The panel is server-rendered into the document, hidden by CSS, so it is
 *     already there when it is needed. Nothing fetches it.
 *   - Its words come from getTranslations, i.e. the same message files as the
 *     rest of the app (CLAUDE.md rule 12) — resolved on the server, where the
 *     bundle that is broken is not involved.
 *   - Its colours are inline, from constants/pwa.ts. The stylesheet is
 *     Tailwind v4, whose theme is built on colour functions older phones do
 *     not all have; a failure screen that renders as black-on-black would be
 *     its own bug.
 *   - The watcher is one inline ES5 script — no arrow functions, no `const`,
 *     no template literals, nothing after ES5 at all. It is the one piece of
 *     code that must run on a browser too old for everything else.
 */
export async function BootFailure() {
  const t = await getTranslations("boot");

  // Handed to the inline script rather than written into it, so every string
  // stays in messages/*.json and none of them are spelled twice.
  const config = {
    timeoutMs: BOOT_WATCHDOG_MS,
    probe: BOOT_SUPPORT_PROBE,
    unsupportedTitle: t("unsupported.title"),
    unsupportedMessage: t("unsupported.message"),
  };

  return (
    <>
      <div
        className="boot-failure"
        // Not aria-live: this is not an update to a page somebody is reading,
        // it is the only thing on screen by the time it appears.
        role="alert"
        data-boot-failure=""
        style={{ backgroundColor: PWA_BACKGROUND_COLOR, color: PWA_SPLASH_FOREGROUND_COLOR }}
      >
        <p className="boot-failure-title" data-boot-failure-title="">
          {t("failed.title")}
        </p>
        <p className="boot-failure-message" data-boot-failure-message="">
          {t("failed.message")}
        </p>
        <button
          type="button"
          className="boot-failure-retry"
          data-boot-failure-retry=""
          // The click handler is attached by the script below, not here: this
          // markup is on screen precisely because React is not running, so a
          // React handler would never be bound.
          style={{ backgroundColor: PWA_SPLASH_FOREGROUND_COLOR, color: PWA_BACKGROUND_COLOR }}
        >
          {t("failed.retry")}
        </button>
        {/* The build number, and whatever the browser said, for the person on
            the other end of the phone call. Not prose — an identifier and a
            raw browser message — so it is the one line here that does not go
            through t(). */}
        <p className="boot-failure-detail" data-boot-failure-detail="">
          {APP_VERSION}
        </p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: bootWatchdogScript(config),
        }}
      />
    </>
  );
}

interface BootWatchdogConfig {
  timeoutMs: number;
  probe: string;
  unsupportedTitle: string;
  unsupportedMessage: string;
}

/**
 * The watcher, as ES5 source.
 *
 * Two ways to conclude the app is dead, because neither alone is enough:
 *
 *   - An uncaught error before React has mounted. A chunk that fails to parse
 *     reports a SyntaxError to `window` naming the file, which is the fast
 *     path and the one an unsupported phone takes. Errors from images and
 *     other elements are ignored — a missing thumbnail is not a dead app.
 *   - A timer, for everything that fails silently: a chunk that never
 *     downloads, a hydration that hangs. Slower, but it catches what has no
 *     error to fire.
 *
 * Both funnel into one `fail()`, which runs at most once and not at all once
 * React has been seen. Once matters: a bundle that cannot load does not fail
 * a single time, it fails once per chunk, and without the latch the diagnosis
 * line grew a fresh file name fifteen times over. And because the signal is
 * an attribute on <html> rather than a variable, a late-arriving React (a
 * genuinely slow phone that beat the diagnosis to it) clears the failure
 * screen again by setting that attribute to "ready".
 */
function bootWatchdogScript(config: BootWatchdogConfig): string {
  // JSON, with < escaped so the payload can never close this script tag.
  const serialized = JSON.stringify(config).replace(/</g, "\\u003c");

  return `(function(){
var d=document,root=d.documentElement,C=${serialized},reason="",failed=false;
function fail(){
if(failed||root.getAttribute("data-boot")==="ready")return;
failed=true;
var panel=d.querySelector("[data-boot-failure]");
if(panel){
var tooOld=false;
try{new Function(C.probe)}catch(e){tooOld=true}
if(tooOld){
var title=panel.querySelector("[data-boot-failure-title]");
var message=panel.querySelector("[data-boot-failure-message]");
if(title)title.textContent=C.unsupportedTitle;
if(message)message.textContent=C.unsupportedMessage;
}
var detail=panel.querySelector("[data-boot-failure-detail]");
if(detail&&reason)detail.textContent=detail.textContent+" \\u00b7 "+reason;
var retry=panel.querySelector("[data-boot-failure-retry]");
if(retry)retry.onclick=function(){location.reload()};
}
root.setAttribute("data-boot","failed");
}
var timer=setTimeout(fail,C.timeoutMs);
window.addEventListener("error",function(event){
if(root.getAttribute("data-boot")==="ready")return;
var target=event.target;
if(target&&target!==window&&target.tagName&&target.tagName!=="SCRIPT")return;
reason=String(event.message||fileName(target&&target.src)||"").slice(0,160);
clearTimeout(timer);
fail();
},true);
function fileName(src){
if(!src)return "";
var parts=String(src).split("?")[0].split("/");
return parts[parts.length-1];
}
})();`;
}
