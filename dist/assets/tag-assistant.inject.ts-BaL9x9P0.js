const C="amd-ta-root",h="amd-ta-pinned",k="amd-ta-var-root",G="amd-sgtm-wrapper",_="amd-ta-hidden",H="amd-ta-var-hidden",y="amd-ta-pin-btn",A="amd-ta-pin-on",q="amd-ta-hl",S=new Map;let T="",w="";const O=[".message-list",'[class*="message-list"]',".messages-panel"],L=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],ae=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'],U='variables-tab:not([aria-hidden="true"]):not(.ng-hide)',V=".gtm-debug-variable-table-row",J=".gtm-debug-chip",W=".gtm-debug-variable-table-value",se=".gtm-debug-variable-pane-content";function I(o,t=document){for(const e of o){const n=t.querySelector(e);if(n)return n}return null}function Y(o,t=document){for(const e of o){const n=Array.from(t.querySelectorAll(e));if(n.length)return n}return[]}function re(){const o=[],t=(e,n)=>{for(const s of n){const a=document.querySelectorAll(s).length;a&&o.push(`${e}: "${s}" (${a})`)}};t("event list",O),t("event row",L),[U,V,J,W].forEach(e=>{const n=document.querySelectorAll(e).length;n&&o.push(`var: "${e}" (${n})`)}),o.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),o.forEach(e=>console.log(e)),console.groupEnd())}function K(o){var t,e;return((e=(t=o.querySelector(".message-list__title span[title]"))==null?void 0:t.getAttribute("title"))==null?void 0:e.trim())??""}function B(o){var t,e;return((e=(t=o.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:t.textContent)==null?void 0:e.trim())??""}function ie(){var t;const o=I(O);return o||(((t=I(L))==null?void 0:t.parentElement)??null)}function X(o){let t=o.parentElement;for(;t&&t!==document.body;){const{overflowY:e}=getComputedStyle(t);if(e==="auto"||e==="scroll"||e==="overlay")return t;t=t.parentElement}return o.parentElement??document.body}function $(){return Y(L)}function le(o){let t=o.parentElement;for(;t&&t!==document.body;){const e=t.scrollTop;if(t.scrollTop=e+1,t.scrollTop!==e||(t.scrollTop=Math.max(0,e-1),t.scrollTop!==e))return t.scrollTop=e,t;t=t.parentElement}return X(o)}function ce(o){const t=document.getElementById(C),e=document.getElementById(h);if(new URLSearchParams(location.search).has("gtm_auth")){const s=le(o),a=(t&&s.contains(t)?t.offsetHeight:0)+(e&&s.contains(e)?e.offsetHeight:0)+8,r=o.getBoundingClientRect().top-s.getBoundingClientRect().top-a;s.scrollTop+=r}else{const s=((t==null?void 0:t.offsetHeight)??46)+((e==null?void 0:e.offsetHeight)??0)+8,a=[];let r=o.parentElement;for(;r;)a.push({el:r,before:r.scrollTop}),r=r.parentElement;o.scrollIntoView({block:"start",behavior:"instant"});for(const{el:l,before:i}of a)if(l.scrollTop!==i){l.scrollTop-=s;return}}}function Z(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function Q(o=14){return`<svg viewBox="0 0 24 24" width="${o}" height="${o}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}function de(){if(document.getElementById("amd-ta-style"))return;const o=document.createElement("style");o.id="amd-ta-style",o.textContent=`
    .${_}     { display: none !important; }
    .${H} { display: none !important; }

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
    #${C} {
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
    .${y}.${A}  { display: inline-flex !important; color: #c9ad07; }
    .${y}:hover          { color: #202124 !important; background: rgba(0,0,0,.07); }
    .${q}              { box-shadow: inset 3px 0 0 #e5c614; }

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
    #${k} {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    #${k} .amd-ta-brand { font-size: 10px; padding: 3px 7px 3px 6px; }
    #${k} .amd-ta-searchbox { background: rgba(255,255,255,.8); border: 1px solid rgba(229,198,20,.5); }
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
  `,document.head.appendChild(o)}function pe(){var n,s,a;if((n=document.getElementById(C))!=null&&n.isConnected)return;(s=document.getElementById(C))==null||s.remove();const o=ie();if(!o)return;const t=document.createElement("div");if(t.id=C,t.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${Q(14)}
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,new URLSearchParams(location.search).has("gtm_auth")){const r=document.getElementById(G);r!=null&&r.isConnected&&(o.closest(`#${G}`)&&r.insertAdjacentElement("afterend",o),r.remove());const l=document.querySelector(".content--debugger-content-component");l?l.insertAdjacentElement("beforebegin",t):o.prepend(t),t.style.position="relative",t.style.zIndex="auto";const i=document.createElement("style");i.id="amd-sgtm-zfix",i.textContent=`
      #${C}    { z-index: 2 !important; }
      #${h}  { z-index: 2 !important; }
      #${k}{ z-index: 2 !important; }
    `,document.head.appendChild(i)}else X(o).prepend(t);(a=document.getElementById("amd-ta-search-input"))==null||a.addEventListener("input",r=>{T=r.target.value.toLowerCase().trim(),te($())})}function F(){var e,n,s;if(S.size===0){(e=document.getElementById(h))==null||e.remove();return}if(!((n=document.getElementById(h))!=null&&n.isConnected)){(s=document.getElementById(h))==null||s.remove();const a=document.getElementById(C);if(!(a!=null&&a.isConnected))return;const r=document.createElement("div");r.id=h,a.insertAdjacentElement("afterend",r)}const o=document.getElementById(h);o.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${S.size})</span></div>`;const t=$();for(const[a,r]of S){const l=t.find(i=>B(i)===a);if(l){const i=l.cloneNode(!0);i.classList.add("amd-ta-clone"),i.removeAttribute("data-amd-pin-added"),i.querySelectorAll(`.${y}`).forEach(p=>p.remove()),me(i,a),i.addEventListener("click",p=>{if(p.target.closest(`.${y}`))return;p.preventDefault(),p.stopPropagation();const d=$().filter(c=>!c.closest(`#${h}`)).find(c=>B(c)===a);d&&(ce(d),d.classList.add("amd-ta-flash"),setTimeout(()=>d.classList.remove("amd-ta-flash"),1100))}),o.appendChild(i)}else{const i=document.createElement("div");i.className="amd-ta-placeholder",i.textContent=`${r} — non in questa pagina`,o.appendChild(i)}}}function me(o,t){const e=document.createElement("button");e.type="button",e.className=`${y} ${A}`,e.title="Rimuovi dai fissati",e.setAttribute("aria-pressed","true"),e.innerHTML=Z(),e.addEventListener("click",n=>{n.stopPropagation(),n.preventDefault(),ee(t)}),o.appendChild(e)}function ee(o){S.delete(o),$().filter(t=>B(t)===o).forEach(t=>{t.classList.remove(q);const e=t.querySelector(`.${y}`);e&&(e.classList.remove(A),e.title="Fissa in cima",e.setAttribute("aria-pressed","false"))}),F()}function te(o){let t=0;for(const s of o){const a=!T||K(s).toLowerCase().includes(T);s.classList.toggle(_,!a),a&&t++}const e=Y(ae);for(const s of e){if(!T){s.classList.remove(_);continue}let a=s.nextElementSibling,r=!1;for(;a&&a.matches(L[0]);){if(!a.classList.contains(_)){r=!0;break}a=a.nextElementSibling}s.classList.toggle(_,!r)}const n=document.getElementById("amd-ta-count");n&&(T?(n.textContent=`${t} / ${o.length}`,n.style.display=""):n.style.display="none")}function ue(o){for(const t of o){if(t.dataset.amdPinAdded)continue;t.dataset.amdPinAdded="1";const e=B(t),n=K(t),s=S.has(e);s&&t.classList.add(q);const a=document.createElement("button");a.type="button",a.className=`${y}${s?` ${A}`:""}`,a.title=s?"Rimuovi dai fissati":"Fissa in cima",a.setAttribute("aria-pressed",String(s)),a.innerHTML=Z(),a.addEventListener("click",r=>{if(r.stopPropagation(),r.preventDefault(),!S.has(e))S.set(e,n),t.classList.add(q),a.classList.add(A),a.title="Rimuovi dai fissati",a.setAttribute("aria-pressed","true");else{ee(e);return}F()}),t.appendChild(a)}}function z(){return document.querySelector(U)}function fe(){var s,a,r;const o=z();if(!o){(s=document.getElementById(k))==null||s.remove();return}if((a=document.getElementById(k))!=null&&a.isConnected){j(o);return}(r=document.getElementById(k))==null||r.remove();const t=o.querySelector(se);if(!t)return;const e=document.createElement("div");e.id=k,e.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${Q(13)}
      <input type="search" id="amd-ta-var-input"
             placeholder="Cerca variabile o valore…"
             autocomplete="off" spellcheck="false" />
      <span id="amd-ta-var-count" style="display:none"></span>
    </div>`,t.prepend(e);const n=e.querySelector("#amd-ta-var-input");w&&(n.value=w),n.addEventListener("input",l=>{w=l.target.value.toLowerCase().trim();const i=z();i&&j(i)}),j(o)}function j(o){var s,a,r,l;const t=Array.from(o.querySelectorAll(V));let e=0;for(const i of t){const p=((a=(s=i.querySelector(J))==null?void 0:s.textContent)==null?void 0:a.toLowerCase())??"",d=((l=(r=i.querySelector(W))==null?void 0:r.textContent)==null?void 0:l.toLowerCase())??"",c=!w||p.includes(w)||d.includes(w);i.classList.toggle(H,!c),c&&e++}const n=document.getElementById("amd-ta-var-count");n&&(w&&t.length>0?(n.textContent=`${e} / ${t.length}`,n.style.display=""):n.style.display="none")}const ge=[{re:/Google Tag|Google Analytics 4|Google Analytics|GA4/i,color:"#EEA849"},{re:/Google Ads/i,color:"#4285F4"},{re:/Facebook|Meta Pixel|Meta Conv/i,color:"#1877F2"},{re:/TikTok/i,color:"#010101"},{re:/LinkedIn/i,color:"#0A66C2"},{re:/Pinterest/i,color:"#E60023"},{re:/Microsoft Ads|Bing Ads/i,color:"#00809D"},{re:/Snapchat/i,color:"#FFFC00"},{re:/Klaviyo/i,color:"#3D8D4E"},{re:/Twitter|X Ads/i,color:"#1DA1F2"}];function be(){var t,e;const o=document.querySelectorAll(".gtm-debug-card");for(const n of o){if(n.classList.contains("amd-tag-colored")||n.classList.contains("amd-tag-failed")||n.dataset.amdCard==="skip")continue;const s=((e=(t=n.querySelector('.gtm-debug-card__subtitle, .gtm-debug-card__description, [class*="subtitle"], [class*="type-name"]'))==null?void 0:t.textContent)==null?void 0:e.trim())??"",a=n.textContent??"";if(!s&&!a.trim())continue;if(/\bfailed\b/i.test(a)||!!n.querySelector('[class*="failed"], [class*="exception"]')){n.classList.add("amd-tag-failed");continue}let l=!1;for(const{re:i,color:p}of ge)if(i.test(s)||i.test(a)){n.style.setProperty("--amd-tag-color",p),n.classList.add("amd-tag-colored"),l=!0;break}!l&&s&&(n.dataset.amdCard="skip")}}function xe(o){return o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,e=>{let n="amd-json-num";return e.startsWith('"')?n=e.endsWith(":")?"amd-json-key":"amd-json-str":e==="true"||e==="false"?n="amd-json-bool":e==="null"&&(n="amd-json-null"),`<span class="${n}">${e}</span>`})}const he=[".gtm-debug-table-cell--http-body pre",'pre[data-ng-bind*="getBody"]',"http-url-details pre",'[class*="http-body"] pre','[class*="outgoing-request"] pre','[class*="outgoing-http"] pre','[class*="request-body"] pre'].join(", ");function ye(){var t,e;const o=document.querySelectorAll(he);for(const n of o){if(n.dataset.amdJsonSkip||n.classList.contains("amd-json-fmt")&&n.children.length>0)continue;const s=((t=n.textContent)==null?void 0:t.trim())??"";if(!(s.length>2e5)&&!(!s.startsWith("{")&&!s.startsWith("[")))try{const a=JSON.parse(s),r=JSON.stringify(a,null,2);let l=(e=n.parentElement)==null?void 0:e.querySelector(":scope > .amd-json-copy");l||(l=document.createElement("button"),l.type="button",l.className="amd-json-copy",n.insertAdjacentElement("beforebegin",l));const i=r;l.textContent="Copia JSON",l.onclick=p=>{p.stopPropagation(),navigator.clipboard.writeText(i).then(()=>{l.textContent="✓ Copiato",setTimeout(()=>{l.textContent="Copia JSON"},1500)}).catch(()=>{l.textContent="✗ Errore",setTimeout(()=>{l.textContent="Copia JSON"},1500)})},n.innerHTML=xe(r),n.classList.add("amd-json-fmt"),n.style.whiteSpace="pre-wrap",n.style.wordBreak="break-all"}catch{n.dataset.amdJsonSkip="1"}}}const N=["ad_storage","analytics_storage","ad_user_data","ad_personalization"];function R(o){const t=o.match(/^[Gg](\d*)$/);if(!t)return null;const e=t[1];return e.length?N.slice(0,e.length).map((n,s)=>({name:n,state:e[s]==="1"?"ok":e[s]==="0"?"no":"unk"})):null}function ve(o){const t=o.trim().split("|").filter(Boolean);return t.length?t.slice(0,N.length).map((e,n)=>({name:N[n],state:e.trim()==="granted"?"ok":e.trim()==="denied"?"no":"unk"})):null}function ne(o){const t=document.createElement("div");t.className="amd-consent-badges";for(const e of o){const n=document.createElement("span");n.className=`amd-consent-badge amd-c-${e.state}`,n.textContent=e.name,n.title=e.state==="ok"?"granted":e.state==="no"?"denied":"unknown",t.appendChild(n)}return t}function ke(){var t,e,n,s,a,r,l,i,p;const o=document.querySelectorAll("tag-details");for(const d of o){if(d.dataset.amdConsentDone)continue;let c=null;if(!c){const m=d.querySelector('table[class*="properties-table"], .tag-details__properties-table');if(m){const u=(m.textContent??"").match(/gtm_session_consent_mode\s*:\s*"([^"]+)"/);u&&(c=ve(u[1]))}}if(!c){const m=d.querySelectorAll('td[class*="property-cell"]');for(const f of m){if(f.dataset.amdGcsRead)continue;const u=f.querySelector('[class*="property-name"]'),g=((t=u==null?void 0:u.textContent)==null?void 0:t.trim())??((e=f.textContent)==null?void 0:e.trim())??"";if(!/^\s*gcs\s*$/i.test(g))continue;f.dataset.amdGcsRead="1";const b=f.querySelector('[class*="property-value"]'),P=((n=b==null?void 0:b.textContent)==null?void 0:n.trim())??((a=(s=f.nextElementSibling)==null?void 0:s.textContent)==null?void 0:a.trim())??"";if(/^G\d+/i.test(P)){c=R(P);break}}}if(!c){const m=d.querySelector("gtag-hits-ng");if(m){const f=m.querySelectorAll('span.param-chip, [class*="param-chip"]');for(const u of f){if(u.dataset.amdGcsRead||((r=u.textContent)==null?void 0:r.trim())!=="gcs")continue;u.dataset.amdGcsRead="1";const g=(l=u.closest("td"))==null?void 0:l.nextElementSibling,b=((i=g==null?void 0:g.textContent)==null?void 0:i.trim())??"";if(/^G\d+/i.test(b)){c=R(b);break}}}}if(!c){const m=d.querySelectorAll('td, [class*="table-cell"], [class*="TableCell"]');for(const f of m){if(f.dataset.amdGcsRead||!/^\s*gcs\s*$/.test(f.textContent??""))continue;f.dataset.amdGcsRead="1";const u=f.nextElementSibling,g=((p=u==null?void 0:u.textContent)==null?void 0:p.trim())??"";if(/^G\d+/i.test(g)){c=R(g);break}}}if(!c)continue;d.dataset.amdConsentDone="1";const v=ne(c);v.style.cssText="padding:4px 14px 7px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;";const x=document.createElement("span");x.textContent="Consent:",x.style.cssText="font:600 10px/1 system-ui,sans-serif; color:#5f6368; text-transform:uppercase; letter-spacing:.06em; flex-shrink:0;",v.prepend(x);const E=[...d.querySelectorAll('[class*="pane-header"]')].find(m=>/^\s*properties\s*$/i.test(m.textContent??""));if(E)E.parentElement.classList.add("amd-consent-host"),E.insertAdjacentElement("afterend",v);else{const m=d.querySelector(".gtm-sheet-card, .sheet-content")??d;m.classList.add("amd-consent-host"),m.prepend(v)}}}const Ce=".gtm-debug-table-cell--query-param + .gtm-debug-table-cell pre";function Ee(){var t;const o=document.querySelectorAll(Ce);for(const e of o){if(e.dataset.amdUrlFmt)continue;const n=((t=e.textContent)==null?void 0:t.trim())??"";if(!n.startsWith("http"))continue;if(n.indexOf("?")===-1){e.dataset.amdUrlFmt="skip";continue}try{const a=new URL(n),r=[...a.searchParams.entries()];if(r.length===0){e.dataset.amdUrlFmt="skip";continue}const l=x=>x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),i=document.createElement("div");i.className="amd-url-fmt";const p=document.createElement("div");p.className="amd-url-fmt-header";const d=document.createElement("span");d.className="amd-url-fmt-base",d.textContent=a.origin+a.pathname;const c=document.createElement("button");c.type="button",c.className="amd-json-copy",c.textContent="Copia URL",c.onclick=x=>{x.stopPropagation(),navigator.clipboard.writeText(n).then(()=>{c.textContent="✓ Copiato",setTimeout(()=>{c.textContent="Copia URL"},1500)}).catch(()=>{c.textContent="✗ Errore",setTimeout(()=>{c.textContent="Copia URL"},1500)})},p.appendChild(d),p.appendChild(c),i.appendChild(p);const v=document.createElement("table");v.className="amd-url-params";for(const[x,E]of r){const m=document.createElement("tr");let f=E;try{f=decodeURIComponent(E)}catch{}if(m.innerHTML=`<td class="amd-url-key">${l(x)}</td><td class="amd-url-val">${l(f)}</td>`,v.appendChild(m),x==="gcs"){const u=R(E);if(u){const g=document.createElement("tr"),b=document.createElement("td");b.colSpan=2,b.style.padding="2px 10px 6px",b.appendChild(ne(u)),g.appendChild(b),v.appendChild(g)}}}i.appendChild(v),e.insertAdjacentElement("beforebegin",i),e.style.display="none",e.dataset.amdUrlFmt="1"}catch{e.dataset.amdUrlFmt="skip"}}}function oe(){if(de(),I(L)){pe();const o=$();ue(o),te(o),requestAnimationFrame(F)}fe(),be(),ye(),Ee(),ke()}let M=!1,D=!1;const we=new MutationObserver(o=>{o.every(e=>{var s;const n=e.target;return!!((s=n.closest)!=null&&s.call(n,`#${C}, #${h}, #${k}, #amd-ta-style, .amd-json-copy, .amd-url-fmt, .amd-gcs-val, .amd-consent-host`))})||M||(M=!0,requestAnimationFrame(()=>{M=!1,!D&&I(L)&&(D=!0,re()),oe()}))});we.observe(document.body,{childList:!0,subtree:!0});oe();
