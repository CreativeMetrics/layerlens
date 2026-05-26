const m="amd-ta-root",u="amd-ta-pinned",y="amd-ta-hidden",l="amd-ta-pin-btn",f="amd-ta-pin-on",v="amd-ta-hl",d=new Set;let x="";const C=[".message-list",'[class*="message-list"]',".messages-panel"],h=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],T=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'];function B(){const n=[];for(const e of C){const t=document.querySelectorAll(e).length;t&&n.push(`list container: "${e}" (${t} found)`)}for(const e of h){const t=document.querySelectorAll(e).length;t&&n.push(`event row: "${e}" (${t} found)`)}n.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),n.forEach(e=>console.log(e)),console.groupEnd())}function w(n,e=document){for(const t of n){const o=e.querySelector(t);if(o)return o}return null}function $(n,e=document){for(const t of n){const o=Array.from(e.querySelectorAll(t));if(o.length)return o}return[]}function g(n){var e,t;return((t=(e=n.querySelector(".message-list__title span[title]"))==null?void 0:e.getAttribute("title"))==null?void 0:t.trim())??""}function P(){var e;const n=w(C);return n||(((e=w(h))==null?void 0:e.parentElement)??null)}function N(n){let e=n.parentElement;for(;e&&e!==document.body;){const{overflowY:t}=getComputedStyle(e);if(t==="auto"||t==="scroll")return e;e=e.parentElement}return n.parentElement??document.body}function b(){return $(h)}function S(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function q(){if(document.getElementById("amd-ta-style"))return;const n=document.createElement("style");n.id="amd-ta-style",n.textContent=`
    .${y} { display: none !important; }

    /* ── Toolbar ── sticky top, brand-tinted so it's clearly "LayerLens" */
    #${m} {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-ta-searchbox {
      display: flex; align-items: center; gap: 7px; flex: 1;
      background: rgba(255,255,255,.75); border-radius: 8px; padding: 6px 10px;
      border: 1px solid rgba(229,198,20,.45);
    }
    .amd-ta-searchbox svg { flex-shrink: 0; color: #9aa0a6; }
    .amd-ta-searchbox input {
      flex: 1; border: none; background: none; outline: none;
      font: inherit; color: #202124;
    }
    .amd-ta-searchbox input::-webkit-search-cancel-button { -webkit-appearance: none; }
    #amd-ta-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.25); padding: 2px 7px; border-radius: 10px;
    }

    /* ── Pin button on each event row ── */
    .message-list__row--indented { position: relative; }
    .${l} {
      display: none;
      position: absolute; right: 30px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; color: #9aa0a6; line-height: 0;
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${l},
    .${l}.${f} { display: inline-flex; }
    .${l}:hover { color: #202124; background: rgba(0,0,0,.07); }
    .${l}.${f} { color: #c9ad07; }
    .${v} { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Pinned section — sticky below toolbar, clearly branded ── */
    #${u} {
      position: sticky; top: 45px; z-index: 99;
      background: #fffdf0;
      border-bottom: 2px solid rgba(229,198,20,.5);
      padding: 0 10px 10px;   /* lateral breathing room for the clone cards */
    }
    .amd-ta-pin-sep {
      display: flex; align-items: center; gap: 7px;
      padding: 10px 2px 8px;  /* taller header */
      font-size: 11px; font-weight: 700; letter-spacing: .07em;
      text-transform: uppercase; font-family: system-ui, sans-serif;
      color: #7a6f1a;
    }
    /* small pin icon before the label */
    .amd-ta-pin-sep::before {
      content: '';
      display: inline-block; width: 10px; height: 10px; flex-shrink: 0;
      background: #e5c614; border-radius: 2px;
    }

    /* cloned pinned rows — card style with margin from edges */
    .amd-ta-clone {
      background: rgba(229,198,20,.13) !important;
      border-left: 3px solid #e5c614 !important;
      border-radius: 7px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,.08) !important;
      margin-bottom: 5px !important;
      cursor: pointer !important;
      transition: background .12s !important;
    }
    .amd-ta-clone:last-child { margin-bottom: 0 !important; }
    .amd-ta-clone:hover { background: rgba(229,198,20,.22) !important; }
    /* "jump to" hint on hover */
    .amd-ta-clone::after {
      content: '↓ vai all'evento';
      display: none; position: absolute; right: 52px; top: 50%; transform: translateY(-50%);
      font-size: 10px; color: #7a6f1a; background: rgba(229,198,20,.25);
      padding: 2px 7px; border-radius: 8px; white-space: nowrap;
      pointer-events: none;
    }
    .amd-ta-clone:hover::after { display: block; }
    .amd-ta-clone .${l} { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 8px 4px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }
  `,document.head.appendChild(n)}function M(){var o,a,s;if((o=document.getElementById(m))!=null&&o.isConnected)return;(a=document.getElementById(m))==null||a.remove();const n=P();if(!n)return;const e=N(n),t=document.createElement("div");t.id=m,t.innerHTML=`
    <div class="amd-ta-searchbox">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,e.prepend(t),(s=document.getElementById("amd-ta-search-input"))==null||s.addEventListener("input",r=>{x=r.target.value.toLowerCase().trim(),_(b())})}function E(){var t,o,a;if(d.size===0){(t=document.getElementById(u))==null||t.remove();return}if(!((o=document.getElementById(u))!=null&&o.isConnected)){(a=document.getElementById(u))==null||a.remove();const s=document.getElementById(m);if(!(s!=null&&s.isConnected))return;const r=document.createElement("div");r.id=u,s.insertAdjacentElement("afterend",r)}const n=document.getElementById(u);n.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${d.size})</span></div>`;const e=b();for(const s of d){const r=e.find(i=>g(i).toLowerCase()===s);if(r){const i=r.cloneNode(!0);i.classList.add("amd-ta-clone"),i.removeAttribute("data-amd-pin-added"),i.querySelectorAll(`.${l}`).forEach(c=>c.remove()),R(i,s),i.addEventListener("click",c=>{if(c.target.closest(`.${l}`))return;c.preventDefault(),c.stopPropagation();const p=b().find(I=>g(I).toLowerCase()===s);p&&(p.scrollIntoView({behavior:"smooth",block:"center"}),p.style.transition="background .1s",p.style.background="rgba(229,198,20,.4)",setTimeout(()=>{p.style.background="",p.style.transition=""},700),p.click())}),n.appendChild(i)}else{const i=document.createElement("div");i.className="amd-ta-placeholder",i.textContent=`${s} — non in questa pagina`,n.appendChild(i)}}}function R(n,e){const t=document.createElement("button");t.type="button",t.className=`${l} ${f}`,t.title="Rimuovi dai fissati",t.setAttribute("aria-pressed","true"),t.innerHTML=S(),t.addEventListener("click",o=>{o.stopPropagation(),o.preventDefault(),z(e)}),n.appendChild(t)}function z(n){d.delete(n),b().filter(e=>g(e).toLowerCase()===n).forEach(e=>{e.classList.remove(v);const t=e.querySelector(`.${l}`);t&&(t.classList.remove(f),t.title="Fissa in cima",t.setAttribute("aria-pressed","false"))}),E()}function _(n){let e=0;for(const a of n){const s=!x||g(a).toLowerCase().includes(x);a.classList.toggle(y,!s),s&&e++}const t=$(T);for(const a of t){if(!x){a.classList.remove(y);continue}let s=a.nextElementSibling,r=!1;for(;s&&s.matches(h[0]);){if(!s.classList.contains(y)){r=!0;break}s=s.nextElementSibling}a.classList.toggle(y,!r)}const o=document.getElementById("amd-ta-count");o&&(x?(o.textContent=`${e} / ${n.length}`,o.style.display=""):o.style.display="none")}function D(n){for(const e of n){if(e.dataset.amdPinAdded)continue;e.dataset.amdPinAdded="1";const t=g(e).toLowerCase(),o=d.has(t);o&&e.classList.add(v);const a=document.createElement("button");a.type="button",a.className=`${l}${o?` ${f}`:""}`,a.title=o?"Rimuovi dai fissati":"Fissa in cima",a.setAttribute("aria-pressed",String(o)),a.innerHTML=S(),a.addEventListener("click",s=>{s.stopPropagation(),s.preventDefault();const r=!d.has(t);r?d.add(t):d.delete(t),b().filter(i=>g(i).toLowerCase()===t).forEach(i=>{i.classList.toggle(v,r);const c=i.querySelector(`.${l}`);c&&(c.classList.toggle(f,r),c.title=r?"Rimuovi dai fissati":"Fissa in cima",c.setAttribute("aria-pressed",String(r)))}),E()}),e.appendChild(a)}}function A(){if(!w(h))return;q(),M();const n=b();D(n),_(n),requestAnimationFrame(E)}let k=!1,L=!1;const H=new MutationObserver(n=>{n.every(t=>{var a;const o=t.target;return!!((a=o.closest)!=null&&a.call(o,`#${m}, #${u}, #amd-ta-style`))})||k||(k=!0,requestAnimationFrame(()=>{k=!1,!L&&w(h)&&(L=!0,B()),A()}))});H.observe(document.body,{childList:!0,subtree:!0});A();
