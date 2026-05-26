const f="amd-ta-root",d="amd-ta-pinned",p="amd-ta-var-root",h="amd-ta-hidden",I="amd-ta-var-hidden",c="amd-ta-pin-btn",v="amd-ta-pin-on",k="amd-ta-hl",g=new Map;let y="",u="";const F=[".message-list",'[class*="message-list"]',".messages-panel"],E=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],j=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'],T='variables-tab:not([aria-hidden="true"]):not(.ng-hide)',B=".gtm-debug-variable-table-row",R=".gtm-debug-chip",q=".gtm-debug-variable-table-value",G=".gtm-debug-variable-pane-content";function P(t,n=document){for(const e of t){const a=n.querySelector(e);if(a)return a}return null}function M(t,n=document){for(const e of t){const a=Array.from(n.querySelectorAll(e));if(a.length)return a}return[]}function U(){const t=[],n=(e,a)=>{for(const i of a){const o=document.querySelectorAll(i).length;o&&t.push(`${e}: "${i}" (${o})`)}};n("event list",F),n("event row",E),[T,B,R,q].forEach(e=>{const a=document.querySelectorAll(e).length;a&&t.push(`var: "${e}" (${a})`)}),t.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),t.forEach(e=>console.log(e)),console.groupEnd())}function H(t){var n,e;return((e=(n=t.querySelector(".message-list__title span[title]"))==null?void 0:n.getAttribute("title"))==null?void 0:e.trim())??""}function _(t){var n,e;return((e=(n=t.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:n.textContent)==null?void 0:e.trim())??""}function w(){return M(E)}function W(t){var l;const n=document.getElementById(f),e=n==null?void 0:n.parentElement;if(!e)return;const a=(n.offsetHeight??46)+(((l=document.getElementById(d))==null?void 0:l.offsetHeight)??0)+8,i=e.getBoundingClientRect().top,r=t.getBoundingClientRect().top-i-a;e.scrollTop+=r}function N(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function z(t=14){return`<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}function Y(){if(document.getElementById("amd-ta-style"))return;const t=document.createElement("style");t.id="amd-ta-style",t.textContent=`
    .${h}     { display: none !important; }
    .${I} { display: none !important; }

    /* ── Brand badge ── */
    .amd-ta-brand {
      display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
      background: #e5c614; color: #2c2c2a;
      border-radius: 7px; padding: 4px 9px 4px 7px;
      font: 700 11px/1 system-ui, sans-serif; letter-spacing: .02em;
      white-space: nowrap; user-select: none;
    }
    .amd-ta-brand svg { flex-shrink: 0; }

    /* ── Toolbar — sticky top ── */
    #${f} {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-ta-searchbox {
      display: flex; align-items: center; gap: 7px; flex: 1;
      background: rgba(255,255,255,.8); border-radius: 8px; padding: 5px 10px;
      border: 1px solid rgba(229,198,20,.5);
    }
    .amd-ta-searchbox svg { flex-shrink: 0; color: #9aa0a6; }
    .amd-ta-searchbox input {
      flex: 1; border: none; background: none; outline: none;
      font: inherit; color: #202124;
    }
    .amd-ta-searchbox input::-webkit-search-cancel-button { -webkit-appearance: none; }
    #amd-ta-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.28); padding: 2px 7px; border-radius: 10px;
    }

    /* ── Pin button — LEFT of the event number, always visible when pinned ── */
    .message-list__row--indented {
      position: relative;
      padding-left: 26px !important;  /* space for the pin icon */
    }
    .${c} {
      display: none;
      position: absolute; left: 3px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; line-height: 0;
      color: rgba(0,0,0,.2);
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${c} { display: inline-flex; color: #9aa0a6; }
    .${c}.${v}  { display: inline-flex !important; color: #c9ad07; }
    .${c}:hover          { color: #202124 !important; background: rgba(0,0,0,.07); }
    .${k}              { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Flash animation triggered by scrollToRow ── */
    @keyframes amd-ta-flash-kf {
      0%   { background-color: rgba(229,198,20,.5); }
      100% { background-color: transparent; }
    }
    .amd-ta-flash { animation: amd-ta-flash-kf 1.1s ease-out forwards !important; }

    /* ── Pinned section — sticky below toolbar ── */
    #${d} {
      position: sticky; top: 46px; z-index: 99;
      background: #fffdf0;
      border-bottom: 2px solid rgba(229,198,20,.5);
      padding: 0 10px 10px;
    }
    .amd-ta-pin-sep {
      display: flex; align-items: center; gap: 7px;
      padding: 10px 2px 8px;
      font-size: 11px; font-weight: 700; letter-spacing: .07em;
      text-transform: uppercase; font-family: system-ui, sans-serif; color: #7a6f1a;
    }
    .amd-ta-pin-sep::before {
      content: ''; display: inline-block; width: 10px; height: 10px; flex-shrink: 0;
      background: #e5c614; border-radius: 2px;
    }

    /* ── Pinned clone cards ── */
    .amd-ta-clone {
      background: rgba(229,198,20,.13) !important;
      border-left: 3px solid #e5c614 !important;
      border-radius: 8px !important;
      box-shadow: 0 1px 4px rgba(0,0,0,.1) !important;
      margin-bottom: 10px !important;
      padding-top: 10px !important;
      padding-bottom: 10px !important;
      min-height: 44px !important;
      cursor: pointer !important;
      transition: background .12s !important;
    }
    .amd-ta-clone:last-child { margin-bottom: 0 !important; }
    .amd-ta-clone:hover      { background: rgba(229,198,20,.22) !important; }

    /* Event number: dark badge inside clone cards */
    .amd-ta-clone .message-list__index,
    .amd-ta-clone [class*="message-list__index"] {
      display: inline-flex !important; align-items: center; justify-content: center;
      background: #2c2c2a !important; color: #fff !important;
      padding: 2px 6px !important; border-radius: 4px !important;
      font-size: 11px !important; font-weight: 700 !important;
      margin-right: 6px !important; min-width: 22px !important;
      line-height: 1.4 !important; vertical-align: middle !important;
    }
    /* Event name: bold and clearly readable in clone cards */
    .amd-ta-clone .message-list__title,
    .amd-ta-clone [class*="message-list__title"] {
      font-weight: 600 !important; color: #1a1a18 !important;
    }
    .amd-ta-clone .message-list__title span[title] {
      font-size: 13px !important;
    }

    .amd-ta-clone::after {
      content: '↑ vai all\\'evento';
      display: none; position: absolute; right: 46px; top: 50%; transform: translateY(-50%);
      font-size: 10px; color: #7a6f1a; background: rgba(229,198,20,.32);
      padding: 2px 8px; border-radius: 8px; white-space: nowrap;
      pointer-events: none; font-family: system-ui, sans-serif;
    }
    .amd-ta-clone:hover::after { display: block; }
    .amd-ta-clone .${c}  { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 8px 4px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }

    /* ── Variables search bar ── */
    #${p} {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    #${p} .amd-ta-brand { font-size: 10px; padding: 3px 7px 3px 6px; }
    #${p} .amd-ta-searchbox { background: rgba(255,255,255,.8); border: 1px solid rgba(229,198,20,.5); }
    #amd-ta-var-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.28); padding: 2px 7px; border-radius: 10px;
    }
  `,document.head.appendChild(t)}function K(){var e,a,i;if((e=document.getElementById(f))!=null&&e.isConnected)return;(a=document.getElementById(f))==null||a.remove();const t=document.querySelector(".message-list__scrollpane");if(!t)return;const n=document.createElement("div");n.id=f,n.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${z(14)}
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,t.prepend(n),(i=document.getElementById("amd-ta-search-input"))==null||i.addEventListener("input",o=>{y=o.target.value.toLowerCase().trim(),O(w())})}function S(){var e,a,i;if(g.size===0){(e=document.getElementById(d))==null||e.remove();return}if(!((a=document.getElementById(d))!=null&&a.isConnected)){(i=document.getElementById(d))==null||i.remove();const o=document.getElementById(f);if(!(o!=null&&o.isConnected))return;const r=document.createElement("div");r.id=d,o.insertAdjacentElement("afterend",r)}const t=document.getElementById(d);t.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${g.size})</span></div>`;const n=w();for(const[o,r]of g){const l=n.find(s=>_(s)===o);if(l){const s=l.cloneNode(!0);s.classList.add("amd-ta-clone"),s.removeAttribute("data-amd-pin-added"),s.querySelectorAll(`.${c}`).forEach(m=>m.remove()),J(s,o),s.addEventListener("click",m=>{if(m.target.closest(`.${c}`))return;m.preventDefault(),m.stopPropagation();const b=w().filter(x=>!x.closest(`#${d}`)).find(x=>_(x)===o);b&&(W(b),b.classList.add("amd-ta-flash"),setTimeout(()=>b.classList.remove("amd-ta-flash"),1100))}),t.appendChild(s)}else{const s=document.createElement("div");s.className="amd-ta-placeholder",s.textContent=`${r} — non in questa pagina`,t.appendChild(s)}}}function J(t,n){const e=document.createElement("button");e.type="button",e.className=`${c} ${v}`,e.title="Rimuovi dai fissati",e.setAttribute("aria-pressed","true"),e.innerHTML=N(),e.addEventListener("click",a=>{a.stopPropagation(),a.preventDefault(),D(n)}),t.appendChild(e)}function D(t){g.delete(t),w().filter(n=>_(n)===t).forEach(n=>{n.classList.remove(k);const e=n.querySelector(`.${c}`);e&&(e.classList.remove(v),e.title="Fissa in cima",e.setAttribute("aria-pressed","false"))}),S()}function O(t){let n=0;for(const i of t){const o=!y||H(i).toLowerCase().includes(y);i.classList.toggle(h,!o),o&&n++}const e=M(j);for(const i of e){if(!y){i.classList.remove(h);continue}let o=i.nextElementSibling,r=!1;for(;o&&o.matches(E[0]);){if(!o.classList.contains(h)){r=!0;break}o=o.nextElementSibling}i.classList.toggle(h,!r)}const a=document.getElementById("amd-ta-count");a&&(y?(a.textContent=`${n} / ${t.length}`,a.style.display=""):a.style.display="none")}function Q(t){for(const n of t){if(n.dataset.amdPinAdded)continue;n.dataset.amdPinAdded="1";const e=_(n),a=H(n),i=g.has(e);i&&n.classList.add(k);const o=document.createElement("button");o.type="button",o.className=`${c}${i?` ${v}`:""}`,o.title=i?"Rimuovi dai fissati":"Fissa in cima",o.setAttribute("aria-pressed",String(i)),o.innerHTML=N(),o.addEventListener("click",r=>{if(r.stopPropagation(),r.preventDefault(),!g.has(e))g.set(e,a),n.classList.add(k),o.classList.add(v),o.title="Rimuovi dai fissati",o.setAttribute("aria-pressed","true");else{D(e);return}S()}),n.appendChild(o)}}function C(){return document.querySelector(T)}function X(){var i,o,r;const t=C();if(!t){(i=document.getElementById(p))==null||i.remove();return}if((o=document.getElementById(p))!=null&&o.isConnected){L(t);return}(r=document.getElementById(p))==null||r.remove();const n=t.querySelector(G);if(!n)return;const e=document.createElement("div");e.id=p,e.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${z(13)}
      <input type="search" id="amd-ta-var-input"
             placeholder="Cerca variabile o valore…"
             autocomplete="off" spellcheck="false" />
      <span id="amd-ta-var-count" style="display:none"></span>
    </div>`,n.prepend(e);const a=e.querySelector("#amd-ta-var-input");u&&(a.value=u),a.addEventListener("input",l=>{u=l.target.value.toLowerCase().trim();const s=C();s&&L(s)}),L(t)}function L(t){var i,o,r,l;const n=Array.from(t.querySelectorAll(B));let e=0;for(const s of n){const m=((o=(i=s.querySelector(R))==null?void 0:i.textContent)==null?void 0:o.toLowerCase())??"",b=((l=(r=s.querySelector(q))==null?void 0:r.textContent)==null?void 0:l.toLowerCase())??"",x=!u||m.includes(u)||b.includes(u);s.classList.toggle(I,!x),x&&e++}const a=document.getElementById("amd-ta-var-count");a&&(u&&n.length>0?(a.textContent=`${e} / ${n.length}`,a.style.display=""):a.style.display="none")}function V(){if(Y(),P(E)){K();const t=w();Q(t),O(t),requestAnimationFrame(S)}X()}let $=!1,A=!1;const Z=new MutationObserver(t=>{t.every(e=>{var i;const a=e.target;return!!((i=a.closest)!=null&&i.call(a,`#${f}, #${d}, #${p}, #amd-ta-style`))})||$||($=!0,requestAnimationFrame(()=>{$=!1,!A&&P(E)&&(A=!0,U()),V()}))});Z.observe(document.body,{childList:!0,subtree:!0});V();
