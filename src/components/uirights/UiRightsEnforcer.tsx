import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  activeRules,
  applyUiRules,
  exposeDebugHandle,
  findTargets,
  loadMyUiRules,
  normalizePath,
  pathMatches,
  useUiRights,
} from "@/lib/uiRights";

const REFRESH_MS = 60_000;

/**
 * Mounted once inside the app shell. Loads this user's UI rules and keeps
 * the page in line with them: every DOM change (React render, dialog open,
 * table page change) re-applies the rules before the browser paints, so a
 * hidden element never flashes on screen.
 */
export function UiRightsEnforcer() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const ui = useUiRights();

  // load + keep fresh (admin edits reach other users within a minute)
  useEffect(() => {
    exposeDebugHandle();
    loadMyUiRules();
    const t = window.setInterval(() => {
      if (!document.hidden) loadMyUiRules();
    }, REFRESH_MS);
    const onFocus = () => loadMyUiRules();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const run = () => applyUiRules(activeRules(), pathname);
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled"], // React re-enabling a control we disabled
    });
    return () => observer.disconnect();
  }, [pathname, ui.myRules, ui.allRules, ui.previewRole]);

  // A hidden menu link also closes the page itself: opening its URL directly
  // bounces to the first menu item that is still visible. (Screen-level only;
  // the API is still protected by the role's rights.)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const blocked = activeRules().some(
        (r) =>
          r.action === "hide" &&
          r.kind === "link" &&
          pathMatches(r.path, pathname) &&
          findTargets(r).some((a) => {
            const href = a.getAttribute("href");
            return !!href && href.startsWith("/") && normalizePath(href.split("?")[0]) === normalizePath(pathname);
          }),
      );
      if (!blocked) return;
      const next = Array.from(document.querySelectorAll<HTMLAnchorElement>("aside nav a[href]")).find((a) => {
        const h = a.getAttribute("href") ?? "";
        return !a.dataset.uirHidden && h.startsWith("/") && normalizePath(h) !== normalizePath(pathname);
      });
      if (next) navigate(next.getAttribute("href")!, { replace: true });
    }, 50);
    return () => window.clearTimeout(t);
  }, [pathname, ui.myRules, ui.allRules, ui.previewRole, navigate]);

  return null;
}