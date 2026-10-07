/**
 * UI rights — hide or disable ANY element (button, link, tab, field, table
 * column, card, text) on ANY page for chosen roles, configured entirely from
 * the frontend. Backend: voice_bot/views/views_ui_rights.py (model UiRule).
 *
 * An element is identified the way a person sees it:
 *   path  -- route pattern ("/campaigns", "/campaigns/:id", or "*" = every page)
 *   kind  -- button | link | tab | field | column | section | text
 *   label -- its visible text / field label, normalised (see normalizeLabel)
 *
 * This only shapes the SCREEN. What a role may actually do is still enforced
 * by the API (Role permissions). Any role can be restricted, the Owner role
 * included; super admins (settings.HEALTH_BALANCE_STAFF_IDS) never are.
 */
import { useSyncExternalStore } from "react";
import {
  server_get_data,
  get_my_ui_rules,
  get_all_ui_rules,
} from "@/components/ServiceConnection/serviceconnection";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type UiKind = "button" | "link" | "tab" | "field" | "column" | "section" | "text";
export type UiAction = "hide" | "disable";

export type UiRule = {
  id: number;
  path: string;
  kind: UiKind;
  label: string;
  display_label: string;
  action: UiAction;
  roles: string[];
  note?: string;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string | null;
};

export type RoleOption = { code: string; name: string };

export const KIND_LABEL: Record<UiKind, string> = {
  button: "Button",
  link: "Link / menu item",
  tab: "Tab",
  field: "Field / filter",
  column: "Table column",
  section: "Card / section",
  text: "Text",
};

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

type State = {
  myRules: UiRule[];
  allRules: UiRule[];
  roles: RoleOption[];
  canManage: boolean;
  myRole: string | null;
  dealerId: number | null; // dealer the rules below belong to
  previewRole: string | null; // admin "see the page as this role"
  pickMode: boolean;
  loaded: boolean;
  isSuperAdmin: boolean; // strict: settings.HEALTH_BALANCE_STAFF_IDS
};

const CACHE_KEY = "ui_rules_cache_v1";

function readCache(): Partial<State> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Apply the last known rules instantly on reload (no flash of hidden items).
const cached = readCache();

let state: State = {
  myRules: cached.myRules ?? [],
  allRules: [],
  roles: [],
  canManage: false,
  isSuperAdmin: false,
  myRole: cached.myRole ?? null,
  dealerId: null,
  previewRole: null,
  pickMode: false,
  loaded: false,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getUiRightsState() {
  return state;
}

export function subscribeUiRights(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUiRights(): State {
  return useSyncExternalStore(subscribeUiRights, getUiRightsState, getUiRightsState);
}

export function setPreviewRole(role: string | null) {
  setState({ previewRole: role });
}

export function setPickMode(on: boolean) {
  setState({ pickMode: on });
}

export function clearUiRightsCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
  setState({ myRules: [], allRules: [], roles: [], canManage: false, isSuperAdmin: false, myRole: null, loaded: false });
}

export async function loadMyUiRules() {
  try {
    const res = await server_get_data(get_my_ui_rules, { _t: Date.now() });
    if (!res?.success) return;
    setState({
      myRules: res.rules ?? [],
      canManage: !!res.can_manage,
      isSuperAdmin: !!res.is_super_admin,
      myRole: res.role ?? null,
      dealerId: res.dealer_id ?? null,
      loaded: true,
    });
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ myRules: res.rules ?? [], myRole: res.role ?? null }));
    } catch {
      /* ignore */
    }
    if (res.can_manage) await loadAllUiRules();
  } catch {
    /* offline / 401: keep the cached rules */
  }
}

export async function loadAllUiRules() {
  try {
    const res = await server_get_data(get_all_ui_rules, { _t: Date.now() });
    if (res?.success) setState({ allRules: res.rules ?? [], roles: res.roles ?? [] });
  } catch {
    /* ignore */
  }
}

/** Rules to apply right now (admin preview wins over the user's own). */
export function activeRules(): UiRule[] {
  if (state.previewRole) {
    return state.allRules.filter((r) => r.is_active && r.roles.includes(state.previewRole as string));
  }
  return state.myRules.filter((r) => r.is_active);
}

/* ------------------------------------------------------------------ */
/* Text + path helpers (must match views_ui_rights.normalize_*)         */
/* ------------------------------------------------------------------ */

export function normalizeLabel(text: string | null | undefined): string {
  let s = String(text ?? "").toLowerCase();
  s = s.replace(/\(\s*[\d,.\s]*\)/g, " ");
  s = s.replace(/\d+/g, " ");
  s = s.replace(/[^\p{L}\p{N}_\u0900-\u097F]+/gu, " ");
  return s.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function normalizePath(path: string): string {
  let p = (path || "").trim() || "*";
  if (p === "*") return p;
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/$/, "");
  return p || "/";
}

/** "/campaigns/12" -> "/campaigns/:id" (ids, uuids, long numbers). */
export function patternFor(pathname: string): string {
  return normalizePath(
    pathname
      .split("/")
      .map((seg) =>
        /^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^\+?\d{8,}$/.test(seg) ? ":id" : seg,
      )
      .join("/"),
  );
}

export function pathMatches(pattern: string, pathname: string): boolean {
  if (pattern === "*") return true;
  const a = normalizePath(pattern).split("/");
  const b = normalizePath(pathname).split("/");
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg.startsWith(":") || seg === b[i]);
}

/* ------------------------------------------------------------------ */
/* Element identification                                              */
/* ------------------------------------------------------------------ */

const FIELD_SEL = 'input:not([type="hidden"]), select, textarea, button[role="combobox"]';
const CARD_SEL = '.rounded-xl.border, [data-slot="card"], section';

function isOurUi(el: Element | null): boolean {
  return !!el?.closest("[data-uir-ui]");
}

function iconName(el: Element): string {
  const svg = el.querySelector("svg[class*='lucide-']");
  const cls = svg?.getAttribute("class") ?? "";
  const m = cls.match(/lucide-([a-z0-9-]+)/g);
  const name = m?.find((c) => c !== "lucide-icon")?.replace("lucide-", "");
  return name ? `icon ${name}` : "";
}

/**
 * The element's leading visible words: its FIRST non-empty text node.
 * Deliberately not innerText -- innerText of an element WE hid (display:none)
 * collapses "Data Import" + badge "1 ready" into "Data Import1 ready", so the
 * rule stopped matching after hiding and the element popped back on the next
 * render. The first text node is the same whether the element is shown or not.
 */
function ownText(el: Element): string {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  return "";
}

export function controlLabel(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const title = el.getAttribute("title");
  const text = ownText(el);
  return text || title || iconName(el);
}

export function fieldLabel(el: Element): string {
  const id = el.getAttribute("id");
  if (id) {
    const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (lab?.textContent?.trim()) return lab.textContent.trim();
  }
  // nearest label in the field's own wrapper (up to 4 levels)
  let p: Element | null = el.parentElement;
  for (let i = 0; i < 4 && p; i++) {
    const lab = p.querySelector("label");
    if (lab && lab.textContent?.trim() && p.querySelectorAll(FIELD_SEL).length <= 1) {
      return lab.textContent.trim();
    }
    p = p.parentElement;
  }
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    el.querySelector("[data-placeholder]")?.textContent ||
    el.getAttribute("name") ||
    ownText(el) ||
    ""
  );
}

/** Element to hide for a field: its own wrapper (label + control). */
export function fieldContainer(el: Element): HTMLElement {
  let t = el as HTMLElement;
  let p = t.parentElement;
  for (let i = 0; i < 4 && p; i++) {
    if (p.querySelectorAll(FIELD_SEL).length > 1) break;
    t = p;
    if (p.querySelector("label")) break;
    p = p.parentElement;
  }
  return t;
}

export function sectionLabel(card: Element): string {
  const h = card.querySelector(
    'h1, h2, h3, h4, [data-slot="card-title"], .font-semibold, .font-display',
  );
  return h ? ownText(h) : "";
}

export type Candidate = { kind: UiKind; label: string; display: string; target: Element };

/** Everything an admin could mean by clicking `el`, nearest first. */
export function describeElement(start: Element): Candidate[] {
  const out: Candidate[] = [];
  const push = (kind: UiKind, display: string, target: Element) => {
    const label = normalizeLabel(display);
    if (label && !out.some((c) => c.kind === kind && c.label === label)) {
      out.push({ kind, label, display: display.slice(0, 120), target });
    }
  };

  const th = start.closest("th");
  if (th) push("column", ownText(th), th);

  const tab = start.closest('[role="tab"]');
  if (tab) push("tab", controlLabel(tab), tab);

  const field = start.closest(FIELD_SEL) ?? (start.matches("label") ? null : null);
  if (field) push("field", fieldLabel(field), fieldContainer(field));
  const label = start.closest("label");
  if (!field && label) {
    const ctl = label.htmlFor ? document.getElementById(label.htmlFor) : label.parentElement?.querySelector(FIELD_SEL);
    if (ctl) push("field", label.textContent ?? "", fieldContainer(ctl));
  }

  const btn = start.closest('button:not([role="tab"]):not([role="combobox"]), [role="button"]');
  if (btn && !tab) push("button", controlLabel(btn), btn);

  const link = start.closest("a[href]");
  if (link) push("link", controlLabel(link), link);

  if (!out.length) {
    const text = ownText(start);
    if (text && text.length <= 80) push("text", text, start);
  }

  const card = start.closest(CARD_SEL);
  if (card) push("section", sectionLabel(card), card);

  return out;
}

/* ------------------------------------------------------------------ */
/* Finding the elements a rule targets                                 */
/* ------------------------------------------------------------------ */

function each<T extends Element>(root: ParentNode, sel: string, fn: (el: T) => void) {
  root.querySelectorAll<T>(sel).forEach((el) => {
    if (!isOurUi(el)) fn(el);
  });
}

/** Elements to hide/disable for one rule on the current DOM. */
export function findTargets(rule: UiRule, root: ParentNode = document): HTMLElement[] {
  const want = rule.label;
  const out: HTMLElement[] = [];
  switch (rule.kind) {
    case "button":
      each(root, 'button:not([role="tab"]):not([role="combobox"]), [role="button"]', (el) => {
        if (normalizeLabel(controlLabel(el)) === want) out.push(el as HTMLElement);
      });
      break;
    case "link":
      each(root, "a[href]", (el) => {
        if (normalizeLabel(controlLabel(el)) === want) out.push(el as HTMLElement);
      });
      break;
    case "tab":
      each(root, '[role="tab"]', (el) => {
        if (normalizeLabel(controlLabel(el)) === want) out.push(el as HTMLElement);
      });
      break;
    case "field":
      each(root, FIELD_SEL, (el) => {
        if (normalizeLabel(fieldLabel(el)) === want) out.push(fieldContainer(el));
      });
      break;
    case "column":
      each(root, "th", (th) => {
        if (normalizeLabel(ownText(th)) !== want) return;
        const cell = th as HTMLTableCellElement;
        const table = cell.closest("table");
        const idx = cell.cellIndex;
        out.push(cell);
        table?.querySelectorAll("tr").forEach((tr) => {
          const c = (tr as HTMLTableRowElement).cells[idx];
          if (c && c !== cell) out.push(c);
        });
      });
      break;
    case "section":
      each(root, CARD_SEL, (el) => {
        if (normalizeLabel(sectionLabel(el)) === want) out.push(el as HTMLElement);
      });
      break;
    case "text": {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const parent = n.parentElement;
        if (!parent || isOurUi(parent)) continue;
        if (normalizeLabel(ownText(parent)) === want) out.push(parent);
      }
      break;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Applying / reverting                                                */
/* ------------------------------------------------------------------ */

const DISABLEABLE = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "FIELDSET"]);

function hide(el: HTMLElement) {
  if (el.dataset.uirHidden === "1") return;
  el.dataset.uirHidden = "1";
  el.dataset.uirPrevDisplay = el.style.getPropertyValue("display") || "";
  el.style.setProperty("display", "none", "important");
}

function disable(el: HTMLElement) {
  const targets: HTMLElement[] = DISABLEABLE.has(el.tagName)
    ? [el]
    : Array.from(el.querySelectorAll<HTMLElement>("button, input, select, textarea"));
  if (el.dataset.uirDisabled !== "1") {
    el.dataset.uirDisabled = "1";
    el.dataset.uirPrevPe = el.style.pointerEvents || "";
    el.dataset.uirPrevOpacity = el.style.opacity || "";
    el.setAttribute("aria-disabled", "true");
    el.style.pointerEvents = "none";
    el.style.opacity = "0.5";
  }
  targets.forEach((t) => {
    if (!(t as HTMLButtonElement).disabled) {
      t.dataset.uirSetDisabled = "1";
      (t as HTMLButtonElement).disabled = true;
    }
  });
}

function restore(el: HTMLElement) {
  if (el.dataset.uirHidden === "1") {
    el.style.removeProperty("display");
    if (el.dataset.uirPrevDisplay) el.style.setProperty("display", el.dataset.uirPrevDisplay);
    delete el.dataset.uirHidden;
    delete el.dataset.uirPrevDisplay;
  }
  if (el.dataset.uirDisabled === "1") {
    el.style.pointerEvents = el.dataset.uirPrevPe ?? "";
    el.style.opacity = el.dataset.uirPrevOpacity ?? "";
    el.removeAttribute("aria-disabled");
    delete el.dataset.uirDisabled;
    delete el.dataset.uirPrevPe;
    delete el.dataset.uirPrevOpacity;
  }
  const own = el.dataset.uirSetDisabled === "1" ? [el] : [];
  [...own, ...Array.from(el.querySelectorAll<HTMLElement>("[data-uir-set-disabled]"))].forEach((t) => {
    (t as HTMLButtonElement).disabled = false;
    delete t.dataset.uirSetDisabled;
  });
}

/**
 * Bring the DOM in line with `rules` for `pathname`: apply what matches,
 * undo what no longer does. Idempotent and cheap enough to run on every DOM
 * mutation (runs before paint, so hidden items never flash).
 */
export function applyUiRules(rules: UiRule[], pathname: string) {
  const want = new Map<HTMLElement, UiAction>();
  for (const rule of rules) {
    if (!pathMatches(rule.path, pathname)) continue;
    for (const el of findTargets(rule)) {
      // hide beats disable when two rules hit the same element
      if (want.get(el) !== "hide") want.set(el, rule.action);
    }
  }

  document.querySelectorAll<HTMLElement>("[data-uir-hidden], [data-uir-disabled], [data-uir-set-disabled]").forEach((el) => {
    const action = want.get(el);
    if (!action) {
      if (el.dataset.uirHidden || el.dataset.uirDisabled) restore(el);
      return;
    }
    if (action === "disable" && el.dataset.uirHidden) restore(el);
    if (action === "hide" && el.dataset.uirDisabled) restore(el);
  });

  want.forEach((action, el) => (action === "hide" ? hide(el) : disable(el)));
}

/** Support/debug handle: in the browser console, window.__uiRights.explain()
 *  lists every active rule and how many elements it hits on this page. */
export function exposeDebugHandle() {
  (window as any).__uiRights = {
    state: () => state,
    rules: () => activeRules(),
    explain: () =>
      activeRules().map((r) => ({
        rule: `${r.action} ${r.kind} "${r.display_label}" @ ${r.path}`,
        pathMatches: pathMatches(r.path, window.location.pathname),
        targets: findTargets(r).length,
      })),
  };
}