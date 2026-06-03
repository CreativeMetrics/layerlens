const k="amd-ta-root",h="amd-ta-pinned",E="amd-ta-var-root",H="amd-sgtm-wrapper",T="amd-ta-hidden",J="amd-ta-var-hidden",y="amd-ta-pin-btn",R="amd-ta-pin-on",M="amd-ta-hl",_=new Map;let A="",S="";const O=new URLSearchParams(location.search).get("id")??"";let $=O.startsWith("GTM-")?O:"",w=(()=>{const n=document.documentElement.dataset.amdVarDisplay;return n==="names"||n==="values"?n:"default"})();const W=[".message-list",'[class*="message-list"]',".messages-panel"],L=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],le=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'],X='variables-tab:not([aria-hidden="true"]):not(.ng-hide)',Y=".gtm-debug-variable-table-row",K=".gtm-debug-chip",Q=".gtm-debug-variable-table-value",de=".gtm-debug-variable-pane-content";function B(n,e=document){for(const t of n){const a=e.querySelector(t);if(a)return a}return null}function Z(n,e=document){for(const t of n){const a=Array.from(e.querySelectorAll(t));if(a.length)return a}return[]}function pe(){const n=[],e=(t,a)=>{for(const o of a){const s=document.querySelectorAll(o).length;s&&n.push(`${t}: "${o}" (${s})`)}};e("event list",W),e("event row",L),[X,Y,K,Q].forEach(t=>{const a=document.querySelectorAll(t).length;a&&n.push(`var: "${t}" (${a})`)}),n.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),n.forEach(t=>console.log(t)),console.groupEnd())}function ee(n){var e,t;return((t=(e=n.querySelector(".message-list__title span[title]"))==null?void 0:e.getAttribute("title"))==null?void 0:t.trim())??""}function N(n){var e,t;return((t=(e=n.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:e.textContent)==null?void 0:t.trim())??""}function me(){var e;const n=B(W);return n||(((e=B(L))==null?void 0:e.parentElement)??null)}function te(n){let e=n.parentElement;for(;e&&e!==document.body;){const{overflowY:t}=getComputedStyle(e);if(t==="auto"||t==="scroll"||t==="overlay")return e;e=e.parentElement}return n.parentElement??document.body}function q(){return Z(L)}function ue(n){let e=n.parentElement;for(;e&&e!==document.body;){const t=e.scrollTop;if(e.scrollTop=t+1,e.scrollTop!==t||(e.scrollTop=Math.max(0,t-1),e.scrollTop!==t))return e.scrollTop=t,e;e=e.parentElement}return te(n)}function fe(n){const e=document.getElementById(k),t=document.getElementById(h);if(new URLSearchParams(location.search).has("gtm_auth")){const o=ue(n),s=(e&&o.contains(e)?e.offsetHeight:0)+(t&&o.contains(t)?t.offsetHeight:0)+8,i=n.getBoundingClientRect().top-o.getBoundingClientRect().top-s;o.scrollTop+=i}else{const o=((e==null?void 0:e.offsetHeight)??46)+((t==null?void 0:t.offsetHeight)??0)+8,s=[];let i=n.parentElement;for(;i;)s.push({el:i,before:i.scrollTop}),i=i.parentElement;n.scrollIntoView({block:"start",behavior:"instant"});for(const{el:c,before:r}of s)if(c.scrollTop!==r){c.scrollTop-=o;return}}}function ne(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function ae(n=14){return`<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}function ge(){if(document.getElementById("amd-ta-style"))return;const n=document.createElement("style");n.id="amd-ta-style",n.textContent=`
    .${T}     { display: none !important; }
    .${J} { display: none !important; }

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
    #${k} {
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
    .${y} {
      display: none;
      position: absolute; left: 3px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; line-height: 0;
      color: rgba(0,0,0,.2);
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${y} { display: inline-flex; color: #9aa0a6; }
    .${y}.${R}  { display: inline-flex !important; color: #c9ad07; }
    .${y}:hover          { color: #202124 !important; background: rgba(0,0,0,.07); }
    .${M}              { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Flash animation triggered by scrollToRow ── */
    @keyframes amd-ta-flash-kf {
      0%   { background-color: rgba(229,198,20,.5); }
      100% { background-color: transparent; }
    }
    .amd-ta-flash { animation: amd-ta-flash-kf 1.1s ease-out forwards !important; }

    /* ── Pinned section — sticky below toolbar ── */
    #${h} {
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
    .amd-ta-clone .${y}  { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 8px 4px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }

    /* ── Variables search bar ── */
    #${E} {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    #${E} .amd-ta-brand { font-size: 10px; padding: 3px 7px 3px 6px; }
    #${E} .amd-ta-searchbox { background: rgba(255,255,255,.8); border: 1px solid rgba(229,198,20,.5); }
    #amd-ta-var-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.28); padding: 2px 7px; border-radius: 10px;
    }

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
  `,document.head.appendChild(n)}function be(){var s,i,c;if((s=document.getElementById(k))!=null&&s.isConnected)return;(i=document.getElementById(k))==null||i.remove();const n=me();if(!n)return;const e=document.createElement("div");if(e.id=k,e.innerHTML=`
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
    </div>`,new URLSearchParams(location.search).has("gtm_auth")){const r=document.getElementById(H);r!=null&&r.isConnected&&(n.closest(`#${H}`)&&r.insertAdjacentElement("afterend",n),r.remove());const p=document.querySelector(".content--debugger-content-component");p?p.insertAdjacentElement("beforebegin",e):n.prepend(e),e.style.position="relative",e.style.zIndex="auto";const l=document.createElement("style");l.id="amd-sgtm-zfix",l.textContent=`
      #${k}    { z-index: 2 !important; }
      #${h}  { z-index: 2 !important; }
      #${E}{ z-index: 2 !important; }
    `,document.head.appendChild(l)}else te(n).prepend(e);(c=document.getElementById("amd-ta-search-input"))==null||c.addEventListener("input",r=>{A=r.target.value.toLowerCase().trim(),se(q())});const a=document.createElement("span");a.className="amd-ta-var-label",a.textContent="Variabili:";const o=document.createElement("select");o.id="amd-ta-var-display",o.title="Modalità visualizzazione variabili nei dettagli tag";for(const[r,p]of[["default","Default"],["names","Nomi"],["values","Valori"]]){const l=document.createElement("option");l.value=r,l.textContent=p,o.appendChild(l)}o.value=w,o.addEventListener("change",()=>{const r=o.value;w=r,document.querySelectorAll(".tag-details__variable-mode[data-amd-var-set]").forEach(p=>{delete p.dataset.amdVarSet}),window.postMessage({action:"amd_set_var_display",value:r},"*"),r!=="default"&&ie()}),e.appendChild(a),e.appendChild(o),j()}function P(){var t,a,o;if(_.size===0){(t=document.getElementById(h))==null||t.remove();return}if(!((a=document.getElementById(h))!=null&&a.isConnected)){(o=document.getElementById(h))==null||o.remove();const s=document.getElementById(k);if(!(s!=null&&s.isConnected))return;const i=document.createElement("div");i.id=h,s.insertAdjacentElement("afterend",i)}const n=document.getElementById(h);n.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${_.size})</span></div>`;const e=q();for(const[s,i]of _){const c=e.find(r=>N(r)===s);if(c){const r=c.cloneNode(!0);r.classList.add("amd-ta-clone"),r.removeAttribute("data-amd-pin-added"),r.querySelectorAll(`.${y}`).forEach(p=>p.remove()),xe(r,s),r.addEventListener("click",p=>{if(p.target.closest(`.${y}`))return;p.preventDefault(),p.stopPropagation();const l=q().filter(d=>!d.closest(`#${h}`)).find(d=>N(d)===s);l&&(fe(l),l.classList.add("amd-ta-flash"),setTimeout(()=>l.classList.remove("amd-ta-flash"),1100))}),n.appendChild(r)}else{const r=document.createElement("div");r.className="amd-ta-placeholder",r.textContent=`${i} — non in questa pagina`,n.appendChild(r)}}}function xe(n,e){const t=document.createElement("button");t.type="button",t.className=`${y} ${R}`,t.title="Rimuovi dai fissati",t.setAttribute("aria-pressed","true"),t.innerHTML=ne(),t.addEventListener("click",a=>{a.stopPropagation(),a.preventDefault(),oe(e)}),n.appendChild(t)}function oe(n){_.delete(n),q().filter(e=>N(e)===n).forEach(e=>{e.classList.remove(M);const t=e.querySelector(`.${y}`);t&&(t.classList.remove(R),t.title="Fissa in cima",t.setAttribute("aria-pressed","false"))}),P()}function se(n){let e=0;for(const o of n){const s=!A||ee(o).toLowerCase().includes(A);o.classList.toggle(T,!s),s&&e++}const t=Z(le);for(const o of t){if(!A){o.classList.remove(T);continue}let s=o.nextElementSibling,i=!1;for(;s&&s.matches(L[0]);){if(!s.classList.contains(T)){i=!0;break}s=s.nextElementSibling}o.classList.toggle(T,!i)}const a=document.getElementById("amd-ta-count");a&&(A?(a.textContent=`${e} / ${n.length}`,a.style.display=""):a.style.display="none")}function he(n){for(const e of n){if(e.dataset.amdPinAdded)continue;e.dataset.amdPinAdded="1";const t=N(e),a=ee(e),o=_.has(t);o&&e.classList.add(M);const s=document.createElement("button");s.type="button",s.className=`${y}${o?` ${R}`:""}`,s.title=o?"Rimuovi dai fissati":"Fissa in cima",s.setAttribute("aria-pressed",String(o)),s.innerHTML=ne(),s.addEventListener("click",i=>{if(i.stopPropagation(),i.preventDefault(),!_.has(t))_.set(t,a),e.classList.add(M),s.classList.add(R),s.title="Rimuovi dai fissati",s.setAttribute("aria-pressed","true");else{oe(t);return}P()}),e.appendChild(s)}}function U(){return document.querySelector(X)}function ye(){var o,s,i;const n=U();if(!n){(o=document.getElementById(E))==null||o.remove();return}if((s=document.getElementById(E))!=null&&s.isConnected){G(n);return}(i=document.getElementById(E))==null||i.remove();const e=n.querySelector(de);if(!e)return;const t=document.createElement("div");t.id=E,t.innerHTML=`
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
    </div>`,e.prepend(t);const a=t.querySelector("#amd-ta-var-input");S&&(a.value=S),a.addEventListener("input",c=>{S=c.target.value.toLowerCase().trim();const r=U();r&&G(r)}),G(n)}function G(n){var o,s,i,c;const e=Array.from(n.querySelectorAll(Y));let t=0;for(const r of e){const p=((s=(o=r.querySelector(K))==null?void 0:o.textContent)==null?void 0:s.toLowerCase())??"",l=((c=(i=r.querySelector(Q))==null?void 0:i.textContent)==null?void 0:c.toLowerCase())??"",d=!S||p.includes(S)||l.includes(S);r.classList.toggle(J,!d),d&&t++}const a=document.getElementById("amd-ta-var-count");a&&(S&&e.length>0?(a.textContent=`${t} / ${e.length}`,a.style.display=""):a.style.display="none")}const ve=[{re:/Google Tag|Google Analytics 4|Google Analytics|GA4/i,color:"#EEA849"},{re:/Google Ads/i,color:"#4285F4"},{re:/Facebook|Meta Pixel|Meta Conv/i,color:"#1877F2"},{re:/TikTok/i,color:"#010101"},{re:/LinkedIn/i,color:"#0A66C2"},{re:/Pinterest/i,color:"#E60023"},{re:/Microsoft Ads|Bing Ads/i,color:"#00809D"},{re:/Snapchat/i,color:"#FFFC00"},{re:/Klaviyo/i,color:"#3D8D4E"},{re:/Twitter|X Ads/i,color:"#1DA1F2"}];function ke(){var e,t;const n=document.querySelectorAll(".gtm-debug-card");for(const a of n){if(a.classList.contains("amd-tag-colored")||a.classList.contains("amd-tag-failed")||a.dataset.amdCard==="skip")continue;const o=((t=(e=a.querySelector('.gtm-debug-card__subtitle, .gtm-debug-card__description, [class*="subtitle"], [class*="type-name"]'))==null?void 0:e.textContent)==null?void 0:t.trim())??"",s=a.textContent??"";if(!o&&!s.trim())continue;if(/\bfailed\b/i.test(s)||!!a.querySelector('[class*="failed"], [class*="exception"]')){a.classList.add("amd-tag-failed");continue}let c=!1;for(const{re:r,color:p}of ve)if(r.test(o)||r.test(s)){a.style.setProperty("--amd-tag-color",p),a.classList.add("amd-tag-colored"),c=!0;break}!c&&o&&(a.dataset.amdCard="skip")}}function Ee(n){return n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,t=>{let a="amd-json-num";return t.startsWith('"')?a=t.endsWith(":")?"amd-json-key":"amd-json-str":t==="true"||t==="false"?a="amd-json-bool":t==="null"&&(a="amd-json-null"),`<span class="${a}">${t}</span>`})}const Ce=[".gtm-debug-table-cell--http-body pre",'pre[data-ng-bind*="getBody"]',"http-url-details pre",'[class*="http-body"] pre','[class*="outgoing-request"] pre','[class*="outgoing-http"] pre','[class*="request-body"] pre'].join(", ");function we(){var e,t;const n=document.querySelectorAll(Ce);for(const a of n){if(a.dataset.amdJsonSkip||a.classList.contains("amd-json-fmt")&&a.children.length>0)continue;const o=((e=a.textContent)==null?void 0:e.trim())??"";if(!(o.length>2e5)&&!(!o.startsWith("{")&&!o.startsWith("[")))try{const s=JSON.parse(o),i=JSON.stringify(s,null,2);let c=(t=a.parentElement)==null?void 0:t.querySelector(":scope > .amd-json-copy");c||(c=document.createElement("button"),c.type="button",c.className="amd-json-copy",a.insertAdjacentElement("beforebegin",c));const r=i;c.textContent="Copia JSON",c.onclick=p=>{p.stopPropagation(),navigator.clipboard.writeText(r).then(()=>{c.textContent="✓ Copiato",setTimeout(()=>{c.textContent="Copia JSON"},1500)}).catch(()=>{c.textContent="✗ Errore",setTimeout(()=>{c.textContent="Copia JSON"},1500)})},a.innerHTML=Ee(i),a.classList.add("amd-json-fmt"),a.style.whiteSpace="pre-wrap",a.style.wordBreak="break-all"}catch{a.dataset.amdJsonSkip="1"}}}const F=["ad_storage","analytics_storage","ad_user_data","ad_personalization"];function I(n){const e=n.match(/^[Gg](\d*)$/);if(!e)return null;const t=e[1];return t.length?F.slice(0,t.length).map((a,o)=>({name:a,state:t[o]==="1"?"ok":t[o]==="0"?"no":"unk"})):null}function Se(n){const e=n.trim().split("|").filter(Boolean);return e.length?e.slice(0,F.length).map((t,a)=>({name:F[a],state:t.trim()==="granted"?"ok":t.trim()==="denied"?"no":"unk"})):null}function re(n){const e=document.createElement("div");e.className="amd-consent-badges";for(const t of n){const a=document.createElement("span");a.className=`amd-consent-badge amd-c-${t.state}`,a.textContent=t.name,a.title=t.state==="ok"?"granted":t.state==="no"?"denied":"unknown",e.appendChild(a)}return e}function _e(){var e,t,a,o,s,i,c,r,p;const n=document.querySelectorAll("tag-details");for(const l of n){if(l.dataset.amdConsentDone)continue;let d=null;if(!d){const m=l.querySelector('table[class*="properties-table"], .tag-details__properties-table');if(m){const u=(m.textContent??"").match(/gtm_session_consent_mode\s*:\s*"([^"]+)"/);u&&(d=Se(u[1]))}}if(!d){const m=l.querySelectorAll('td[class*="property-cell"]');for(const f of m){if(f.dataset.amdGcsRead)continue;const u=f.querySelector('[class*="property-name"]'),g=((e=u==null?void 0:u.textContent)==null?void 0:e.trim())??((t=f.textContent)==null?void 0:t.trim())??"";if(!/^\s*gcs\s*$/i.test(g))continue;f.dataset.amdGcsRead="1";const b=f.querySelector('[class*="property-value"]'),z=((a=b==null?void 0:b.textContent)==null?void 0:a.trim())??((s=(o=f.nextElementSibling)==null?void 0:o.textContent)==null?void 0:s.trim())??"";if(/^G\d+/i.test(z)){d=I(z);break}}}if(!d){const m=l.querySelector("gtag-hits-ng");if(m){const f=m.querySelectorAll('span.param-chip, [class*="param-chip"]');for(const u of f){if(u.dataset.amdGcsRead||((i=u.textContent)==null?void 0:i.trim())!=="gcs")continue;u.dataset.amdGcsRead="1";const g=(c=u.closest("td"))==null?void 0:c.nextElementSibling,b=((r=g==null?void 0:g.textContent)==null?void 0:r.trim())??"";if(/^G\d+/i.test(b)){d=I(b);break}}}}if(!d){const m=l.querySelectorAll('td, [class*="table-cell"], [class*="TableCell"]');for(const f of m){if(f.dataset.amdGcsRead||!/^\s*gcs\s*$/.test(f.textContent??""))continue;f.dataset.amdGcsRead="1";const u=f.nextElementSibling,g=((p=u==null?void 0:u.textContent)==null?void 0:p.trim())??"";if(/^G\d+/i.test(g)){d=I(g);break}}}if(!d)continue;l.dataset.amdConsentDone="1";const v=re(d);v.style.cssText="padding:4px 14px 7px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;";const x=document.createElement("span");x.textContent="Consent:",x.style.cssText="font:600 10px/1 system-ui,sans-serif; color:#5f6368; text-transform:uppercase; letter-spacing:.06em; flex-shrink:0;",v.prepend(x);const C=[...l.querySelectorAll('[class*="pane-header"]')].find(m=>/^\s*properties\s*$/i.test(m.textContent??""));if(C)C.parentElement.classList.add("amd-consent-host"),C.insertAdjacentElement("afterend",v);else{const m=l.querySelector(".gtm-sheet-card, .sheet-content")??l;m.classList.add("amd-consent-host"),m.prepend(v)}}}const Le=".gtm-debug-table-cell--query-param + .gtm-debug-table-cell pre";function Te(){var e;const n=document.querySelectorAll(Le);for(const t of n){if(t.dataset.amdUrlFmt)continue;const a=((e=t.textContent)==null?void 0:e.trim())??"";if(!a.startsWith("http"))continue;if(a.indexOf("?")===-1){t.dataset.amdUrlFmt="skip";continue}try{const s=new URL(a),i=[...s.searchParams.entries()];if(i.length===0){t.dataset.amdUrlFmt="skip";continue}const c=x=>x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),r=document.createElement("div");r.className="amd-url-fmt";const p=document.createElement("div");p.className="amd-url-fmt-header";const l=document.createElement("span");l.className="amd-url-fmt-base",l.textContent=s.origin+s.pathname;const d=document.createElement("button");d.type="button",d.className="amd-json-copy",d.textContent="Copia URL",d.onclick=x=>{x.stopPropagation(),navigator.clipboard.writeText(a).then(()=>{d.textContent="✓ Copiato",setTimeout(()=>{d.textContent="Copia URL"},1500)}).catch(()=>{d.textContent="✗ Errore",setTimeout(()=>{d.textContent="Copia URL"},1500)})},p.appendChild(l),p.appendChild(d),r.appendChild(p);const v=document.createElement("table");v.className="amd-url-params";for(const[x,C]of i){const m=document.createElement("tr");let f=C;try{f=decodeURIComponent(C)}catch{}if(m.innerHTML=`<td class="amd-url-key">${c(x)}</td><td class="amd-url-val">${c(f)}</td>`,v.appendChild(m),x==="gcs"){const u=I(C);if(u){const g=document.createElement("tr"),b=document.createElement("td");b.colSpan=2,b.style.padding="2px 10px 6px",b.appendChild(re(u)),g.appendChild(b),v.appendChild(g)}}}r.appendChild(v),t.insertAdjacentElement("beforebegin",r),t.style.display="none",t.dataset.amdUrlFmt="1"}catch{t.dataset.amdUrlFmt="skip"}}}function j(){if(!$)return;const n=document.getElementById(k);if(!(n!=null&&n.isConnected))return;let e=document.getElementById("amd-ta-container-id");e||(e=document.createElement("button"),e.id="amd-ta-container-id",e.type="button",e.title="ID container sGTM — clicca per copiare",n.appendChild(e));const t=document.createElement("span");t.className="amd-cid-label",t.textContent="sGTM",e.replaceChildren(t,document.createTextNode(" "+$)),e.onclick=()=>{navigator.clipboard.writeText($).then(()=>{e.replaceChildren(t.cloneNode(!0),document.createTextNode(" ✓ Copiato")),setTimeout(()=>j(),1500)}).catch(()=>{})}}window.addEventListener("message",n=>{var t;if(n.source!==window)return;const e=n.data;!e||typeof e!="object"||e.code==="GTM_IDENTIFIER"&&typeof((t=e.data)==null?void 0:t.containerId)=="string"&&($=e.data.containerId,j())});if(location.hostname==="tagassistant.google.com"){const n=XMLHttpRequest.prototype.open,e=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(t,a,...o){return this._amdUrl=String(a),n.apply(this,[t,a,...o])},XMLHttpRequest.prototype.send=function(...t){return(this._amdUrl??"").includes("get_memo?id=")&&this.addEventListener("load",function(){var o;try{let s=this.responseText;if(s.startsWith(")]}'")&&(s=s.slice(4)),!s.trim())return;const i=JSON.parse(s);for(const c of Object.keys(i)){const r=i[c];if(Array.isArray(r)){for(const p of r)if(p.messageType==="REQUEST_SUMMARY"){const l=(o=p.request)==null?void 0:o.headers,d=l==null?void 0:l["x-gtm-identifier"];if(typeof d=="string"&&d){$=d,j(),XMLHttpRequest.prototype.open=n,XMLHttpRequest.prototype.send=e;return}}}}}catch{}}),e.apply(this,t)}}function Ae(){var e;const n=document.querySelectorAll(".tag-details__show-more");for(const t of n){const a=((e=t.textContent)==null?void 0:e.toLowerCase())??"";if(!(a.includes("show more")||a.includes("mostra di più"))){delete t.dataset.amdAutoExpanded;continue}t.dataset.amdAutoExpanded||(t.dataset.amdAutoExpanded="1",t.click())}}function ie(){if(w==="default")return;const n=document.querySelectorAll(".tag-details__variable-mode");for(const e of n){if(e.dataset.amdVarSet===w)continue;const t=e.querySelector(`form input[value="${w}"]`);if(t){if(!t.checked){const a=w==="values"?"names":"values",o=e.querySelector(`form input[value="${a}"]`);o&&(o.checked=!1),t.checked=!0,t.dispatchEvent(new Event("click",{bubbles:!0}))}e.dataset.amdVarSet=w}}}function ce(){if(ge(),B(L)){be();const n=q();he(n),se(n),requestAnimationFrame(P)}ye(),Ae(),ie(),ke(),we(),Te(),_e()}let D=!1,V=!1;const $e=new MutationObserver(n=>{n.every(t=>{var o;const a=t.target;return!!((o=a.closest)!=null&&o.call(a,`#${k}, #${h}, #${E}, #amd-ta-style, .amd-json-copy, .amd-url-fmt, .amd-gcs-val, .amd-consent-host`))})||D||(D=!0,requestAnimationFrame(()=>{D=!1,!V&&B(L)&&(V=!0,pe()),ce()}))});$e.observe(document.body,{childList:!0,subtree:!0});ce();
