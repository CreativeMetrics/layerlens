const E="amd-ta-root",y="amd-ta-pinned",w="amd-ta-var-root",V="amd-sgtm-wrapper",A="amd-ta-hidden",X="amd-ta-var-hidden",v="amd-ta-pin-btn",R="amd-ta-pin-on",B="amd-ta-hl",L=new Map;let $="",S="";const U=new URLSearchParams(location.search).get("id")??"";let q=U.startsWith("GTM-")?U:"",C=(()=>{const n=document.documentElement.dataset.amdVarDisplay;return n==="names"||n==="values"?n:"default"})();const Y=[".message-list",'[class*="message-list"]',".messages-panel"],T=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],de=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'],K='variables-tab:not([aria-hidden="true"]):not(.ng-hide)',pe='event-data-tab:not([aria-hidden="true"]):not(.ng-hide)',_="amd-edv-copy-root",O=".gtm-debug-variable-table-row",Q=".gtm-debug-chip",Z=".gtm-debug-variable-table-value",me=".gtm-debug-variable-pane-content";function N(n,e=document){for(const t of n){const o=e.querySelector(t);if(o)return o}return null}function ee(n,e=document){for(const t of n){const o=Array.from(e.querySelectorAll(t));if(o.length)return o}return[]}function ue(){const n=[],e=(t,o)=>{for(const r of o){const a=document.querySelectorAll(r).length;a&&n.push(`${t}: "${r}" (${a})`)}};e("event list",Y),e("event row",T),[K,O,Q,Z].forEach(t=>{const o=document.querySelectorAll(t).length;o&&n.push(`var: "${t}" (${o})`)}),n.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),n.forEach(t=>console.log(t)),console.groupEnd())}function te(n){var e,t;return((t=(e=n.querySelector(".message-list__title span[title]"))==null?void 0:e.getAttribute("title"))==null?void 0:t.trim())??""}function j(n){var e,t;return((t=(e=n.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:e.textContent)==null?void 0:t.trim())??""}function fe(){var e;const n=N(Y);return n||(((e=N(T))==null?void 0:e.parentElement)??null)}function ne(n){let e=n.parentElement;for(;e&&e!==document.body;){const{overflowY:t}=getComputedStyle(e);if(t==="auto"||t==="scroll"||t==="overlay")return e;e=e.parentElement}return n.parentElement??document.body}function I(){return ee(T)}function ge(n){let e=n.parentElement;for(;e&&e!==document.body;){const t=e.scrollTop;if(e.scrollTop=t+1,e.scrollTop!==t||(e.scrollTop=Math.max(0,t-1),e.scrollTop!==t))return e.scrollTop=t,e;e=e.parentElement}return ne(n)}function be(n){const e=document.getElementById(E),t=document.getElementById(y);if(new URLSearchParams(location.search).has("gtm_auth")){const r=ge(n),a=(e&&r.contains(e)?e.offsetHeight:0)+(t&&r.contains(t)?t.offsetHeight:0)+8,i=n.getBoundingClientRect().top-r.getBoundingClientRect().top-a;r.scrollTop+=i}else{const r=((e==null?void 0:e.offsetHeight)??46)+((t==null?void 0:t.offsetHeight)??0)+8,a=[];let i=n.parentElement;for(;i;)a.push({el:i,before:i.scrollTop}),i=i.parentElement;n.scrollIntoView({block:"start",behavior:"instant"});for(const{el:c,before:s}of a)if(c.scrollTop!==s){c.scrollTop-=r;return}}}function oe(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function ae(n=14){return`<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}function xe(){if(document.getElementById("amd-ta-style"))return;const n=document.createElement("style");n.id="amd-ta-style",n.textContent=`
    .${A}     { display: none !important; }
    .${X} { display: none !important; }

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
    #${E} {
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
    .${v} {
      display: none;
      position: absolute; left: 3px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; line-height: 0;
      color: rgba(0,0,0,.2);
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${v} { display: inline-flex; color: #9aa0a6; }
    .${v}.${R}  { display: inline-flex !important; color: #c9ad07; }
    .${v}:hover          { color: #202124 !important; background: rgba(0,0,0,.07); }
    .${B}              { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Flash animation triggered by scrollToRow ── */
    @keyframes amd-ta-flash-kf {
      0%   { background-color: rgba(229,198,20,.5); }
      100% { background-color: transparent; }
    }
    .amd-ta-flash { animation: amd-ta-flash-kf 1.1s ease-out forwards !important; }

    /* ── Pinned section — sticky below toolbar ── */
    #${y} {
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
    .amd-ta-clone .${v}  { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 8px 4px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }

    /* ── Variables search bar ── */
    #${w} {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    #${w} .amd-ta-brand { font-size: 10px; padding: 3px 7px 3px 6px; }
    #${w} .amd-ta-searchbox { background: rgba(255,255,255,.8); border: 1px solid rgba(229,198,20,.5); }
    #amd-ta-var-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.28); padding: 2px 7px; border-radius: 10px;
    }

    /* ── Event Data copy toolbar ── */
    #${_} {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    #${_} .amd-ta-brand { font-size: 10px; padding: 3px 7px 3px 6px; }
    .amd-edv-copy-btn {
      margin-left: auto;
      display: inline-flex; align-items: center; gap: 5px;
      background: #2c2c2a; color: #fff;
      border: none; border-radius: 6px; padding: 4px 10px;
      font: 11px/1.4 system-ui, sans-serif; cursor: pointer; white-space: nowrap;
      transition: background .12s;
    }
    .amd-edv-copy-btn:hover { background: #444; }
    .amd-edv-copy-btn svg { flex-shrink: 0; }

    /* ── Tag type coloring ── */
    .gtm-debug-card.amd-tag-colored {
      border-left: 4px solid var(--amd-tag-color, #ccc) !important;
    }
    /* ── Failed tag ── */
    .gtm-debug-card.amd-tag-failed {
      background: rgba(220, 38, 38, .07) !important;
      border-left: 4px solid #dc2626 !important;
    }
    /* ── JSON formatter ── */
    .amd-json-copy {
      display: inline-block; margin: 0 0 5px;
      padding: 3px 10px; font-size: 11px; font-weight: 500; line-height: 1.5;
      background: #f1f3f4; border: 1px solid rgba(0,0,0,.14);
      border-radius: 6px; cursor: pointer; color: #3c4043;
      font-family: system-ui, sans-serif;
    }
    .amd-json-copy:hover { background: #e8eaed; }
    .amd-json-key  { color: #a626a4; }
    .amd-json-str  { color: #188038; }
    .amd-json-num  { color: #c25e00; }
    .amd-json-bool { color: #1967d2; }
    .amd-json-null { color: #80868b; font-style: italic; }

    /* ── URL param formatter ── */
    .amd-url-fmt { font-size: 12px; }
    .amd-url-fmt-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;
    }
    .amd-url-fmt-base {
      color: #5f6368; font-size: 11px; font-family: monospace;
      word-break: break-all; flex: 1; min-width: 0;
    }
    .amd-url-params {
      border-collapse: collapse; width: 100%;
      border: 1px solid rgba(0,0,0,.1); border-radius: 4px; overflow: hidden;
    }
    .amd-url-params td {
      padding: 4px 10px; vertical-align: top;
      border-bottom: 1px solid rgba(0,0,0,.05); font-size: 12px;
    }
    .amd-url-params tr:last-child td { border-bottom: none; }
    .amd-url-params tr:nth-child(even) { background: rgba(0,0,0,.02); }
    .amd-url-key { color: #a626a4; font-family: monospace; width: 30%; word-break: break-word; }
    .amd-url-val { color: #032f62; font-family: monospace; word-break: break-all; }

    /* ── Consent Mode Monitor ── */
    .amd-consent-badges {
      display: flex; gap: 5px; flex-wrap: wrap; padding: 3px 0;
    }
    .amd-consent-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 7px; border-radius: 4px;
      font-size: 11px; font-weight: 500; font-family: monospace;
      white-space: nowrap;
    }
    .amd-consent-badge::before {
      content: ''; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    }
    .amd-consent-badge.amd-c-ok  { background: #e6f4ea; color: #137333; }
    .amd-consent-badge.amd-c-ok::before  { background: #137333; }
    .amd-consent-badge.amd-c-no  { background: #fce8e6; color: #c5221f; }
    .amd-consent-badge.amd-c-no::before  { background: #c5221f; }
    .amd-consent-badge.amd-c-unk { background: #f1f3f4; color: #5f6368; }
    .amd-consent-badge.amd-c-unk::before { background: #9aa0a6; }

    /* ── Variable display select ── */
    .amd-ta-var-label {
      font: 11px/1 system-ui, sans-serif;
      color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
    }
    #amd-ta-var-display {
      font: 12px/1 system-ui, sans-serif;
      border: 1px solid rgba(229,198,20,.5); border-radius: 6px;
      padding: 3px 5px; background: rgba(255,255,255,.85);
      color: #3c4043; cursor: pointer; flex-shrink: 0; outline: none;
      max-width: 80px; width: 80px;
    }
    #amd-ta-var-display:hover { border-color: rgba(229,198,20,.9); }

    /* ── sGTM Container ID badge ── */
    #amd-ta-container-id {
      display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
      padding: 3px 9px; border-radius: 5px;
      background: #e8f0fe; color: #1967d2;
      border: 1px solid #c5d8fc;
      font: 600 11px/1 monospace;
      cursor: pointer; white-space: nowrap; user-select: none;
      transition: background .12s;
    }
    #amd-ta-container-id:hover { background: #d2e3fc; }
    #amd-ta-container-id .amd-cid-label {
      font: 500 10px/1 system-ui, sans-serif;
      color: #5f6368; letter-spacing: .04em; text-transform: uppercase;
    }
  `,document.head.appendChild(n)}function he(){var a,i,c;if((a=document.getElementById(E))!=null&&a.isConnected)return;(i=document.getElementById(E))==null||i.remove();const n=fe();if(!n)return;const e=document.createElement("div");if(e.id=E,e.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${ae(14)}
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,new URLSearchParams(location.search).has("gtm_auth")){const s=document.getElementById(V);s!=null&&s.isConnected&&(n.closest(`#${V}`)&&s.insertAdjacentElement("afterend",n),s.remove());const p=document.querySelector(".content--debugger-content-component");p?p.insertAdjacentElement("beforebegin",e):n.prepend(e),e.style.position="relative",e.style.zIndex="auto";const d=document.createElement("style");d.id="amd-sgtm-zfix",d.textContent=`
      #${E}    { z-index: 2 !important; }
      #${y}  { z-index: 2 !important; }
      #${w}{ z-index: 2 !important; }
    `,document.head.appendChild(d)}else ne(n).prepend(e);(c=document.getElementById("amd-ta-search-input"))==null||c.addEventListener("input",s=>{$=s.target.value.toLowerCase().trim(),se(I())});const o=document.createElement("span");o.className="amd-ta-var-label",o.textContent="Variabili:";const r=document.createElement("select");r.id="amd-ta-var-display",r.title="Modalità visualizzazione variabili nei dettagli tag";for(const[s,p]of[["default","Default"],["names","Nomi"],["values","Valori"]]){const d=document.createElement("option");d.value=s,d.textContent=p,r.appendChild(d)}r.value=C,r.addEventListener("change",()=>{const s=r.value;C=s,document.querySelectorAll(".tag-details__variable-mode[data-amd-var-set]").forEach(p=>{delete p.dataset.amdVarSet}),window.postMessage({action:"amd_set_var_display",value:s},"*"),s!=="default"&&ce()}),e.appendChild(o),e.appendChild(r),D()}function P(){var t,o,r;if(L.size===0){(t=document.getElementById(y))==null||t.remove();return}if(!((o=document.getElementById(y))!=null&&o.isConnected)){(r=document.getElementById(y))==null||r.remove();const a=document.getElementById(E);if(!(a!=null&&a.isConnected))return;const i=document.createElement("div");i.id=y,a.insertAdjacentElement("afterend",i)}const n=document.getElementById(y);n.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${L.size})</span></div>`;const e=I();for(const[a,i]of L){const c=e.find(s=>j(s)===a);if(c){const s=c.cloneNode(!0);s.classList.add("amd-ta-clone"),s.removeAttribute("data-amd-pin-added"),s.querySelectorAll(`.${v}`).forEach(p=>p.remove()),ye(s,a),s.addEventListener("click",p=>{if(p.target.closest(`.${v}`))return;p.preventDefault(),p.stopPropagation();const d=I().filter(l=>!l.closest(`#${y}`)).find(l=>j(l)===a);d&&(be(d),d.classList.add("amd-ta-flash"),setTimeout(()=>d.classList.remove("amd-ta-flash"),1100))}),n.appendChild(s)}else{const s=document.createElement("div");s.className="amd-ta-placeholder",s.textContent=`${i} — non in questa pagina`,n.appendChild(s)}}}function ye(n,e){const t=document.createElement("button");t.type="button",t.className=`${v} ${R}`,t.title="Rimuovi dai fissati",t.setAttribute("aria-pressed","true"),t.innerHTML=oe(),t.addEventListener("click",o=>{o.stopPropagation(),o.preventDefault(),re(e)}),n.appendChild(t)}function re(n){L.delete(n),I().filter(e=>j(e)===n).forEach(e=>{e.classList.remove(B);const t=e.querySelector(`.${v}`);t&&(t.classList.remove(R),t.title="Fissa in cima",t.setAttribute("aria-pressed","false"))}),P()}function se(n){let e=0;for(const r of n){const a=!$||te(r).toLowerCase().includes($);r.classList.toggle(A,!a),a&&e++}const t=ee(de);for(const r of t){if(!$){r.classList.remove(A);continue}let a=r.nextElementSibling,i=!1;for(;a&&a.matches(T[0]);){if(!a.classList.contains(A)){i=!0;break}a=a.nextElementSibling}r.classList.toggle(A,!i)}const o=document.getElementById("amd-ta-count");o&&($?(o.textContent=`${e} / ${n.length}`,o.style.display=""):o.style.display="none")}function ve(n){for(const e of n){if(e.dataset.amdPinAdded)continue;e.dataset.amdPinAdded="1";const t=j(e),o=te(e),r=L.has(t);r&&e.classList.add(B);const a=document.createElement("button");a.type="button",a.className=`${v}${r?` ${R}`:""}`,a.title=r?"Rimuovi dai fissati":"Fissa in cima",a.setAttribute("aria-pressed",String(r)),a.innerHTML=oe(),a.addEventListener("click",i=>{if(i.stopPropagation(),i.preventDefault(),!L.has(t))L.set(t,o),e.classList.add(B),a.classList.add(R),a.title="Rimuovi dai fissati",a.setAttribute("aria-pressed","true");else{re(t);return}P()}),e.appendChild(a)}}function J(){return document.querySelector(K)}function ke(){var r,a,i;const n=J();if(!n){(r=document.getElementById(w))==null||r.remove();return}if((a=document.getElementById(w))!=null&&a.isConnected){G(n);return}(i=document.getElementById(w))==null||i.remove();const e=n.querySelector(me);if(!e)return;const t=document.createElement("div");t.id=w,t.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${ae(13)}
      <input type="search" id="amd-ta-var-input"
             placeholder="Cerca variabile o valore…"
             autocomplete="off" spellcheck="false" />
      <span id="amd-ta-var-count" style="display:none"></span>
    </div>`,e.prepend(t);const o=t.querySelector("#amd-ta-var-input");S&&(o.value=S),o.addEventListener("input",c=>{S=c.target.value.toLowerCase().trim();const s=J();s&&G(s)}),G(n)}function G(n){var r,a,i,c;const e=Array.from(n.querySelectorAll(O));let t=0;for(const s of e){const p=((a=(r=s.querySelector(Q))==null?void 0:r.textContent)==null?void 0:a.toLowerCase())??"",d=((c=(i=s.querySelector(Z))==null?void 0:i.textContent)==null?void 0:c.toLowerCase())??"",l=!S||p.includes(S)||d.includes(S);s.classList.toggle(X,!l),l&&t++}const o=document.getElementById("amd-ta-var-count");o&&(S&&e.length>0?(o.textContent=`${t} / ${e.length}`,o.style.display=""):o.style.display="none")}const Ee='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>';function we(){var c,s,p;const n=document.querySelector(pe);if(!n){(c=document.getElementById(_))==null||c.remove();return}if((s=document.getElementById(_))!=null&&s.isConnected)return;(p=document.getElementById(_))==null||p.remove();const e=n.querySelector(".event-data");if(!e)return;const t=e.querySelector(".event-data__header");if(!t)return;const o=document.createElement("div");o.id=_;const r=document.createElement("div");r.className="amd-ta-brand",r.innerHTML='<svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#2c2c2a"/><circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/><circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/></svg>LayerLens';const a=document.createElement("button");a.type="button",a.className="amd-edv-copy-btn",a.title='Copia tutti i campi evento come JSON — incollalo nel wizard "Da evento server" in GTM';const i=()=>{a.innerHTML=Ee+" Copia JSON"};i(),a.addEventListener("click",()=>{var b,g;const d=Array.from(n.querySelectorAll(O)),l={};for(const k of d){const m=(g=(b=k.querySelector("td.gtm-debug-table-cell:first-child pre"))==null?void 0:b.textContent)==null?void 0:g.trim();m&&(l[m]=null)}if(Object.keys(l).length===0){a.textContent="Nessun campo",setTimeout(i,1500);return}navigator.clipboard.writeText(JSON.stringify(l,null,2)).then(()=>{a.textContent="✓ Copiato!",setTimeout(i,1500)}).catch(()=>{a.textContent="Errore",setTimeout(i,1500)})}),o.append(r,a),t.after(o)}const Ce=[{re:/Google Tag|Google Analytics 4|Google Analytics|GA4/i,color:"#EEA849"},{re:/Google Ads/i,color:"#4285F4"},{re:/Facebook|Meta Pixel|Meta Conv/i,color:"#1877F2"},{re:/TikTok/i,color:"#010101"},{re:/LinkedIn/i,color:"#0A66C2"},{re:/Pinterest/i,color:"#E60023"},{re:/Microsoft Ads|Bing Ads/i,color:"#00809D"},{re:/Snapchat/i,color:"#FFFC00"},{re:/Klaviyo/i,color:"#3D8D4E"},{re:/Twitter|X Ads/i,color:"#1DA1F2"}];function Se(){var e,t;const n=document.querySelectorAll(".gtm-debug-card");for(const o of n){if(o.classList.contains("amd-tag-colored")||o.classList.contains("amd-tag-failed")||o.dataset.amdCard==="skip")continue;const r=((t=(e=o.querySelector('.gtm-debug-card__subtitle, .gtm-debug-card__description, [class*="subtitle"], [class*="type-name"]'))==null?void 0:e.textContent)==null?void 0:t.trim())??"",a=o.textContent??"";if(!r&&!a.trim())continue;if(/\bfailed\b/i.test(a)||!!o.querySelector('[class*="failed"], [class*="exception"]')){o.classList.add("amd-tag-failed");continue}let c=!1;for(const{re:s,color:p}of Ce)if(s.test(r)||s.test(a)){o.style.setProperty("--amd-tag-color",p),o.classList.add("amd-tag-colored"),c=!0;break}!c&&r&&(o.dataset.amdCard="skip")}}function _e(n){return n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,t=>{let o="amd-json-num";return t.startsWith('"')?o=t.endsWith(":")?"amd-json-key":"amd-json-str":t==="true"||t==="false"?o="amd-json-bool":t==="null"&&(o="amd-json-null"),`<span class="${o}">${t}</span>`})}const Le=[".gtm-debug-table-cell--http-body pre",'pre[data-ng-bind*="getBody"]',"http-url-details pre",'[class*="http-body"] pre','[class*="outgoing-request"] pre','[class*="outgoing-http"] pre','[class*="request-body"] pre'].join(", ");function Te(){var e,t;const n=document.querySelectorAll(Le);for(const o of n){if(o.dataset.amdJsonSkip||o.classList.contains("amd-json-fmt")&&o.children.length>0)continue;const r=((e=o.textContent)==null?void 0:e.trim())??"";if(!(r.length>2e5)&&!(!r.startsWith("{")&&!r.startsWith("[")))try{const a=JSON.parse(r),i=JSON.stringify(a,null,2);let c=(t=o.parentElement)==null?void 0:t.querySelector(":scope > .amd-json-copy");c||(c=document.createElement("button"),c.type="button",c.className="amd-json-copy",o.insertAdjacentElement("beforebegin",c));const s=i;c.textContent="Copia JSON",c.onclick=p=>{p.stopPropagation(),navigator.clipboard.writeText(s).then(()=>{c.textContent="✓ Copiato",setTimeout(()=>{c.textContent="Copia JSON"},1500)}).catch(()=>{c.textContent="✗ Errore",setTimeout(()=>{c.textContent="Copia JSON"},1500)})},o.innerHTML=_e(i),o.classList.add("amd-json-fmt"),o.style.whiteSpace="pre-wrap",o.style.wordBreak="break-all"}catch{o.dataset.amdJsonSkip="1"}}}const H=["ad_storage","analytics_storage","ad_user_data","ad_personalization"];function M(n){const e=n.match(/^[Gg](\d*)$/);if(!e)return null;const t=e[1];return t.length?H.slice(0,t.length).map((o,r)=>({name:o,state:t[r]==="1"?"ok":t[r]==="0"?"no":"unk"})):null}function Ae(n){const e=n.trim().split("|").filter(Boolean);return e.length?e.slice(0,H.length).map((t,o)=>({name:H[o],state:t.trim()==="granted"?"ok":t.trim()==="denied"?"no":"unk"})):null}function ie(n){const e=document.createElement("div");e.className="amd-consent-badges";for(const t of n){const o=document.createElement("span");o.className=`amd-consent-badge amd-c-${t.state}`,o.textContent=t.name,o.title=t.state==="ok"?"granted":t.state==="no"?"denied":"unknown",e.appendChild(o)}return e}function $e(){var e,t,o,r,a,i,c,s,p;const n=document.querySelectorAll("tag-details");for(const d of n){if(d.dataset.amdConsentDone)continue;let l=null;if(!l){const m=d.querySelector('table[class*="properties-table"], .tag-details__properties-table');if(m){const u=(m.textContent??"").match(/gtm_session_consent_mode\s*:\s*"([^"]+)"/);u&&(l=Ae(u[1]))}}if(!l){const m=d.querySelectorAll('td[class*="property-cell"]');for(const f of m){if(f.dataset.amdGcsRead)continue;const u=f.querySelector('[class*="property-name"]'),x=((e=u==null?void 0:u.textContent)==null?void 0:e.trim())??((t=f.textContent)==null?void 0:t.trim())??"";if(!/^\s*gcs\s*$/i.test(x))continue;f.dataset.amdGcsRead="1";const h=f.querySelector('[class*="property-value"]'),F=((o=h==null?void 0:h.textContent)==null?void 0:o.trim())??((a=(r=f.nextElementSibling)==null?void 0:r.textContent)==null?void 0:a.trim())??"";if(/^G\d+/i.test(F)){l=M(F);break}}}if(!l){const m=d.querySelector("gtag-hits-ng");if(m){const f=m.querySelectorAll('span.param-chip, [class*="param-chip"]');for(const u of f){if(u.dataset.amdGcsRead||((i=u.textContent)==null?void 0:i.trim())!=="gcs")continue;u.dataset.amdGcsRead="1";const x=(c=u.closest("td"))==null?void 0:c.nextElementSibling,h=((s=x==null?void 0:x.textContent)==null?void 0:s.trim())??"";if(/^G\d+/i.test(h)){l=M(h);break}}}}if(!l){const m=d.querySelectorAll('td, [class*="table-cell"], [class*="TableCell"]');for(const f of m){if(f.dataset.amdGcsRead||!/^\s*gcs\s*$/.test(f.textContent??""))continue;f.dataset.amdGcsRead="1";const u=f.nextElementSibling,x=((p=u==null?void 0:u.textContent)==null?void 0:p.trim())??"";if(/^G\d+/i.test(x)){l=M(x);break}}}if(!l)continue;d.dataset.amdConsentDone="1";const b=ie(l);b.style.cssText="padding:4px 14px 7px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;";const g=document.createElement("span");g.textContent="Consent:",g.style.cssText="font:600 10px/1 system-ui,sans-serif; color:#5f6368; text-transform:uppercase; letter-spacing:.06em; flex-shrink:0;",b.prepend(g);const k=[...d.querySelectorAll('[class*="pane-header"]')].find(m=>/^\s*properties\s*$/i.test(m.textContent??""));if(k)k.parentElement.classList.add("amd-consent-host"),k.insertAdjacentElement("afterend",b);else{const m=d.querySelector(".gtm-sheet-card, .sheet-content")??d;m.classList.add("amd-consent-host"),m.prepend(b)}}}const qe=".gtm-debug-table-cell--query-param + .gtm-debug-table-cell pre";function Re(){var e;const n=document.querySelectorAll(qe);for(const t of n){if(t.dataset.amdUrlFmt)continue;const o=((e=t.textContent)==null?void 0:e.trim())??"";if(!o.startsWith("http"))continue;if(o.indexOf("?")===-1){t.dataset.amdUrlFmt="skip";continue}try{const a=new URL(o),i=[...a.searchParams.entries()];if(i.length===0){t.dataset.amdUrlFmt="skip";continue}const c=g=>g.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),s=document.createElement("div");s.className="amd-url-fmt";const p=document.createElement("div");p.className="amd-url-fmt-header";const d=document.createElement("span");d.className="amd-url-fmt-base",d.textContent=a.origin+a.pathname;const l=document.createElement("button");l.type="button",l.className="amd-json-copy",l.textContent="Copia URL",l.onclick=g=>{g.stopPropagation(),navigator.clipboard.writeText(o).then(()=>{l.textContent="✓ Copiato",setTimeout(()=>{l.textContent="Copia URL"},1500)}).catch(()=>{l.textContent="✗ Errore",setTimeout(()=>{l.textContent="Copia URL"},1500)})},p.appendChild(d),p.appendChild(l),s.appendChild(p);const b=document.createElement("table");b.className="amd-url-params";for(const[g,k]of i){const m=document.createElement("tr");let f=k;try{f=decodeURIComponent(k)}catch{}if(m.innerHTML=`<td class="amd-url-key">${c(g)}</td><td class="amd-url-val">${c(f)}</td>`,b.appendChild(m),g==="gcs"){const u=M(k);if(u){const x=document.createElement("tr"),h=document.createElement("td");h.colSpan=2,h.style.padding="2px 10px 6px",h.appendChild(ie(u)),x.appendChild(h),b.appendChild(x)}}}s.appendChild(b),t.insertAdjacentElement("beforebegin",s),t.style.display="none",t.dataset.amdUrlFmt="1"}catch{t.dataset.amdUrlFmt="skip"}}}function D(){if(!q)return;const n=document.getElementById(E);if(!(n!=null&&n.isConnected))return;let e=document.getElementById("amd-ta-container-id");e||(e=document.createElement("button"),e.id="amd-ta-container-id",e.type="button",e.title="ID container sGTM — clicca per copiare",n.appendChild(e));const t=document.createElement("span");t.className="amd-cid-label",t.textContent="sGTM",e.replaceChildren(t,document.createTextNode(" "+q)),e.onclick=()=>{navigator.clipboard.writeText(q).then(()=>{e.replaceChildren(t.cloneNode(!0),document.createTextNode(" ✓ Copiato")),setTimeout(()=>D(),1500)}).catch(()=>{})}}window.addEventListener("message",n=>{var t;if(n.source!==window)return;const e=n.data;!e||typeof e!="object"||e.code==="GTM_IDENTIFIER"&&typeof((t=e.data)==null?void 0:t.containerId)=="string"&&(q=e.data.containerId,D())});if(location.hostname==="tagassistant.google.com"){const n=XMLHttpRequest.prototype.open,e=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(t,o,...r){return this._amdUrl=String(o),n.apply(this,[t,o,...r])},XMLHttpRequest.prototype.send=function(...t){return(this._amdUrl??"").includes("get_memo?id=")&&this.addEventListener("load",function(){var r;try{let a=this.responseText;if(a.startsWith(")]}'")&&(a=a.slice(4)),!a.trim())return;const i=JSON.parse(a);for(const c of Object.keys(i)){const s=i[c];if(Array.isArray(s)){for(const p of s)if(p.messageType==="REQUEST_SUMMARY"){const d=(r=p.request)==null?void 0:r.headers,l=d==null?void 0:d["x-gtm-identifier"];if(typeof l=="string"&&l){q=l,D(),XMLHttpRequest.prototype.open=n,XMLHttpRequest.prototype.send=e;return}}}}}catch{}}),e.apply(this,t)}}function Ie(){var e;const n=document.querySelectorAll(".tag-details__show-more");for(const t of n){const o=((e=t.textContent)==null?void 0:e.toLowerCase())??"";if(!(o.includes("show more")||o.includes("mostra di più"))){delete t.dataset.amdAutoExpanded;continue}t.dataset.amdAutoExpanded||(t.dataset.amdAutoExpanded="1",t.click())}}function ce(){if(C==="default")return;const n=document.querySelectorAll(".tag-details__variable-mode");for(const e of n){if(e.dataset.amdVarSet===C)continue;const t=e.querySelector(`form input[value="${C}"]`);if(t){if(!t.checked){const o=C==="values"?"names":"values",r=e.querySelector(`form input[value="${o}"]`);r&&(r.checked=!1),t.checked=!0,t.dispatchEvent(new Event("click",{bubbles:!0}))}e.dataset.amdVarSet=C}}}function le(){if(xe(),N(T)){he();const n=I();ve(n),se(n),requestAnimationFrame(P)}ke(),we(),Ie(),ce(),Se(),Te(),Re(),$e()}let z=!1,W=!1;const Me=new MutationObserver(n=>{n.every(t=>{var r;const o=t.target;return!!((r=o.closest)!=null&&r.call(o,`#${E}, #${y}, #${w}, #${_}, #amd-ta-style, .amd-json-copy, .amd-url-fmt, .amd-gcs-val, .amd-consent-host`))})||z||(z=!0,requestAnimationFrame(()=>{z=!1,!W&&N(T)&&(W=!0,ue()),le()}))});Me.observe(document.body,{childList:!0,subtree:!0});le();
