# Security rules for LayerLens

This is a Chrome MV3 extension that injects scripts into arbitrary third-party pages (GTM UI, Tag Assistant, Shopify storefronts, sGTM debug URLs). Data flows across three execution worlds and an untrusted postMessage channel. Apply every rule below when writing or modifying code.

---

## 1. DOM manipulation — never use innerHTML

**Never** set `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write` with any value that contains or could contain user-supplied or page-supplied data (dataLayer values, GTM tag names, event names, URL parameters, Angular model data, etc.).

Anything read from the page — `window.dataLayer`, GTM Angular scope, `window.location`, `document.title`, tag/trigger/variable names scraped from the GTM UI — is untrusted input.

**Required pattern:** use `textContent` for text, or build nodes with `document.createElement` + property assignment.

```ts
// WRONG
el.innerHTML = `<span>${tagName}</span>`;

// RIGHT
const span = document.createElement('span');
span.textContent = tagName;
el.appendChild(span);
```

If you must produce a larger block of markup, build the whole tree with `createElement` calls or use a `<template>` element cloned with `cloneNode(true)` and then fill text slots via `textContent`.

---

## 2. postMessage validation — always check origin and structure

Every `window.addEventListener('message', ...)` handler **must**:

1. Verify `event.origin` against an explicit allowlist before reading `event.data`.
2. Check that `event.data` has the expected shape (type-narrow with a discriminant field) before acting on it.
3. Never execute or eval any string from `event.data`.

```ts
// WRONG
window.addEventListener('message', (e) => {
  if (e.data.code === 'DL_PUSH') handlePush(e.data.payload);
});

// RIGHT
const ALLOWED_ORIGINS = new Set([chrome.runtime.getURL('').slice(0, -1)]);
window.addEventListener('message', (e) => {
  if (!ALLOWED_ORIGINS.has(e.origin) && e.origin !== window.location.origin) return;
  if (typeof e.data !== 'object' || e.data === null) return;
  if (e.data.code === 'DL_PUSH') handlePush(e.data.payload);
});
```

For the Shopify sandbox bridge (cross-origin iframe to parent), accept only `chrome-extension://` origins or the known Shopify CDN origin — never `'*'`.

---

## 3. chrome.runtime message validation

`onRuntimeMessage` handlers receive messages from content scripts and the popup. Even though these are extension-internal, a compromised web page can spoof `chrome.runtime.sendMessage` to an externally-connectable extension. Always:

- Check that `sender.id === chrome.runtime.id` in background message handlers.
- Type-narrow `message` with a discriminant (`code` or `action`) before accessing payload fields.
- Never pass `message` payloads directly to `eval`, `Function()`, or `chrome.tabs.executeScript` string forms.

---

## 4. No eval, no dynamic script strings

Never use:
- `eval()`
- `new Function(str)`
- `setTimeout(str, ...)` / `setInterval(str, ...)`
- `chrome.tabs.executeScript({ code: userControlledString })`

If you need to run code in a tab, use a static function reference with `chrome.scripting.executeScript({ func: myFunc, args: [...] })`.

---

## 5. Storage reads are trusted but must be validated on write

`chrome.storage.local` is extension-internal and not directly writable by web pages. However, any value ultimately derived from page content (e.g. a captured dataLayer event) **must be sanitised before storage** — strip or encode any HTML-like characters so that if the value is later rendered into the popup it cannot escape a text node.

Use a helper like:

```ts
function sanitiseForStorage(value: unknown): string {
  return String(value).replace(/[<>"'&]/g, (c) => `&#${c.charCodeAt(0)};`);
}
```

Apply this at the point where page data enters storage, not at render time (defence in depth still applies at render, but the source should be clean).

---

## 6. URL and redirect safety

Never pass unvalidated strings to:
- `chrome.tabs.create({ url: ... })`
- `window.location.assign()`
- Any `href` attribute set via JS

If the URL comes from storage or a message payload, validate it with:

```ts
function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
```

---

## 7. CSS selector injection via gtm-selectors.ts

`gtm-selectors.ts` is the single source for CSS selectors used in `querySelector` / `querySelectorAll`. Selectors are static constants — never interpolate page data into a selector string, as malformed input can throw and potentially leak internal state in error messages.

---

## 8. Angular scope data — treat as untrusted HTML

Data read through `gtm-angular.ts` (tag names, variable values, trigger names) comes from the GTM Angular model which mirrors content the user entered in GTM — but could also be a crafted GTM container. Treat all string values from Angular scope as untrusted and render via `textContent` only (rule 1 applies).

---

## 9. Permissions and manifest hygiene

- Do not add new `host_permissions` without explicit justification in the PR description.
- Do not add `"<all_urls>"` content script matches unless strictly required; prefer specific origins (`tagmanager.google.com`, `tagassistant.google.com`).
- The global CSP-stripping rule (`declarativeNetRequest`) is a known trade-off; do not widen it further. Any new `declarativeNetRequest` rules must strip only specific response headers, not whole-page CSP.

---

## 10. Secrets and credentials

- Never hardcode API keys, tokens, or credentials in source files.
- Do not log sensitive storage values (`chrome.storage.local.get` results, auth tokens) to `console`.
- The extension has no server-side component, so there is no risk of server-side injection — but do not introduce one (e.g. do not add a fetch to a user-configurable endpoint without validating the URL scheme).
