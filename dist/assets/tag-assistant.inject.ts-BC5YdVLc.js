const w="amd-ta-root",v="amd-ta-pinned",k="amd-ta-var-root",G="amd-sgtm-wrapper",_="amd-ta-hidden",z="amd-ta-var-hidden",h="amd-ta-pin-btn",T="amd-ta-pin-on",q="amd-ta-hl",S=new Map;let A="",E="";const H=[".message-list",'[class*="message-list"]',".messages-panel"],L=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],ae=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'],U='variables-tab:not([aria-hidden="true"]):not(.ng-hide)',V=".gtm-debug-variable-table-row",J=".gtm-debug-chip",W=".gtm-debug-variable-table-value",oe=".gtm-debug-variable-pane-content";function I(a,n=document){for(const e of a){const t=n.querySelector(e);if(t)return t}return null}function Y(a,n=document){for(const e of a){const t=Array.from(n.querySelectorAll(e));if(t.length)return t}return[]}function se(){const a=[],n=(e,t)=>{for(const s of t){const o=document.querySelectorAll(s).length;o&&a.push(`${e}: "${s}" (${o})`)}};n("event list",H),n("event row",L),[U,V,J,W].forEach(e=>{const t=document.querySelectorAll(e).length;t&&a.push(`var: "${e}" (${t})`)}),a.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),a.forEach(e=>console.log(e)),console.groupEnd())}function K(a){var n,e;return((e=(n=a.querySelector(".message-list__title span[title]"))==null?void 0:n.getAttribute("title"))==null?void 0:e.trim())??""}function B(a){var n,e;return((e=(n=a.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:n.textContent)==null?void 0:e.trim())??""}function re(){var n;const a=I(H);return a||(((n=I(L))==null?void 0:n.parentElement)??null)}function ie(a){let n=a.parentElement;for(;n&&n!==document.body;){const{overflowY:e}=getComputedStyle(n);if(e==="auto"||e==="scroll"||e==="overlay")return n;n=n.parentElement}return a.parentElement??document.body}function $(){return Y(L)}function le(a){var o;const n=document.getElementById(w),e=((n==null?void 0:n.offsetHeight)??46)+(((o=document.getElementById(v))==null?void 0:o.offsetHeight)??0)+8,t=[];let s=a.parentElement;for(;s;)t.push({el:s,before:s.scrollTop}),s=s.parentElement;a.scrollIntoView({block:"start",behavior:"instant"});for(const{el:r,before:i}of t)if(r.scrollTop!==i){r.scrollTop-=e;return}}function X(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function Q(a=14){return`<svg viewBox="0 0 24 24" width="${a}" height="${a}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}function ce(){if(document.getElementById("amd-ta-style"))return;const a=document.createElement("style");a.id="amd-ta-style",a.textContent=`
    .${_}     { display: none !important; }
    .${z} { display: none !important; }

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
    #${w} {
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
    .${h} {
      display: none;
      position: absolute; left: 3px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; line-height: 0;
      color: rgba(0,0,0,.2);
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${h} { display: inline-flex; color: #9aa0a6; }
    .${h}.${T}  { display: inline-flex !important; color: #c9ad07; }
    .${h}:hover          { color: #202124 !important; background: rgba(0,0,0,.07); }
    .${q}              { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Flash animation triggered by scrollToRow ── */
    @keyframes amd-ta-flash-kf {
      0%   { background-color: rgba(229,198,20,.5); }
      100% { background-color: transparent; }
    }
    .amd-ta-flash { animation: amd-ta-flash-kf 1.1s ease-out forwards !important; }

    /* ── Pinned section — sticky below toolbar ── */
    #${v} {
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
    .amd-ta-clone .${h}  { display: inline-flex !important; color: #c9ad07; }
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
  `,document.head.appendChild(a)}function de(){var t,s,o;if((t=document.getElementById(w))!=null&&t.isConnected)return;(s=document.getElementById(w))==null||s.remove();const a=re();if(!a)return;const n=document.createElement("div");if(n.id=w,n.innerHTML=`
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
    </div>`,new URLSearchParams(location.search).has("gtm_auth")){const r=document.getElementById(G);r!=null&&r.isConnected&&(a.closest(`#${G}`)&&r.insertAdjacentElement("afterend",a),r.remove());const i=document.querySelector(".content--debugger-content-component");i?i.insertAdjacentElement("beforebegin",n):a.prepend(n),n.style.position="relative",n.style.zIndex="auto"}else ie(a).prepend(n);(o=document.getElementById("amd-ta-search-input"))==null||o.addEventListener("input",r=>{A=r.target.value.toLowerCase().trim(),ee($())})}function P(){var e,t,s;if(S.size===0){(e=document.getElementById(v))==null||e.remove();return}if(!((t=document.getElementById(v))!=null&&t.isConnected)){(s=document.getElementById(v))==null||s.remove();const o=document.getElementById(w);if(!(o!=null&&o.isConnected))return;const r=document.createElement("div");r.id=v,o.insertAdjacentElement("afterend",r)}const a=document.getElementById(v);a.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${S.size})</span></div>`;const n=$();for(const[o,r]of S){const i=n.find(l=>B(l)===o);if(i){const l=i.cloneNode(!0);l.classList.add("amd-ta-clone"),l.removeAttribute("data-amd-pin-added"),l.querySelectorAll(`.${h}`).forEach(p=>p.remove()),pe(l,o),l.addEventListener("click",p=>{if(p.target.closest(`.${h}`))return;p.preventDefault(),p.stopPropagation();const d=$().filter(c=>!c.closest(`#${v}`)).find(c=>B(c)===o);d&&(le(d),d.classList.add("amd-ta-flash"),setTimeout(()=>d.classList.remove("amd-ta-flash"),1100))}),a.appendChild(l)}else{const l=document.createElement("div");l.className="amd-ta-placeholder",l.textContent=`${r} — non in questa pagina`,a.appendChild(l)}}}function pe(a,n){const e=document.createElement("button");e.type="button",e.className=`${h} ${T}`,e.title="Rimuovi dai fissati",e.setAttribute("aria-pressed","true"),e.innerHTML=X(),e.addEventListener("click",t=>{t.stopPropagation(),t.preventDefault(),Z(n)}),a.appendChild(e)}function Z(a){S.delete(a),$().filter(n=>B(n)===a).forEach(n=>{n.classList.remove(q);const e=n.querySelector(`.${h}`);e&&(e.classList.remove(T),e.title="Fissa in cima",e.setAttribute("aria-pressed","false"))}),P()}function ee(a){let n=0;for(const s of a){const o=!A||K(s).toLowerCase().includes(A);s.classList.toggle(_,!o),o&&n++}const e=Y(ae);for(const s of e){if(!A){s.classList.remove(_);continue}let o=s.nextElementSibling,r=!1;for(;o&&o.matches(L[0]);){if(!o.classList.contains(_)){r=!0;break}o=o.nextElementSibling}s.classList.toggle(_,!r)}const t=document.getElementById("amd-ta-count");t&&(A?(t.textContent=`${n} / ${a.length}`,t.style.display=""):t.style.display="none")}function me(a){for(const n of a){if(n.dataset.amdPinAdded)continue;n.dataset.amdPinAdded="1";const e=B(n),t=K(n),s=S.has(e);s&&n.classList.add(q);const o=document.createElement("button");o.type="button",o.className=`${h}${s?` ${T}`:""}`,o.title=s?"Rimuovi dai fissati":"Fissa in cima",o.setAttribute("aria-pressed",String(s)),o.innerHTML=X(),o.addEventListener("click",r=>{if(r.stopPropagation(),r.preventDefault(),!S.has(e))S.set(e,t),n.classList.add(q),o.classList.add(T),o.title="Rimuovi dai fissati",o.setAttribute("aria-pressed","true");else{Z(e);return}P()}),n.appendChild(o)}}function D(){return document.querySelector(U)}function ue(){var s,o,r;const a=D();if(!a){(s=document.getElementById(k))==null||s.remove();return}if((o=document.getElementById(k))!=null&&o.isConnected){j(a);return}(r=document.getElementById(k))==null||r.remove();const n=a.querySelector(oe);if(!n)return;const e=document.createElement("div");e.id=k,e.innerHTML=`
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
    </div>`,n.prepend(e);const t=e.querySelector("#amd-ta-var-input");E&&(t.value=E),t.addEventListener("input",i=>{E=i.target.value.toLowerCase().trim();const l=D();l&&j(l)}),j(a)}function j(a){var s,o,r,i;const n=Array.from(a.querySelectorAll(V));let e=0;for(const l of n){const p=((o=(s=l.querySelector(J))==null?void 0:s.textContent)==null?void 0:o.toLowerCase())??"",d=((i=(r=l.querySelector(W))==null?void 0:r.textContent)==null?void 0:i.toLowerCase())??"",c=!E||p.includes(E)||d.includes(E);l.classList.toggle(z,!c),c&&e++}const t=document.getElementById("amd-ta-var-count");t&&(E&&n.length>0?(t.textContent=`${e} / ${n.length}`,t.style.display=""):t.style.display="none")}const fe=[{re:/Google Tag|Google Analytics 4|Google Analytics|GA4/i,color:"#EEA849"},{re:/Google Ads/i,color:"#4285F4"},{re:/Facebook|Meta Pixel|Meta Conv/i,color:"#1877F2"},{re:/TikTok/i,color:"#010101"},{re:/LinkedIn/i,color:"#0A66C2"},{re:/Pinterest/i,color:"#E60023"},{re:/Microsoft Ads|Bing Ads/i,color:"#00809D"},{re:/Snapchat/i,color:"#FFFC00"},{re:/Klaviyo/i,color:"#3D8D4E"},{re:/Twitter|X Ads/i,color:"#1DA1F2"}];function ge(){var n,e;const a=document.querySelectorAll(".gtm-debug-card");for(const t of a){if(t.classList.contains("amd-tag-colored")||t.classList.contains("amd-tag-failed")||t.dataset.amdCard==="skip")continue;const s=((e=(n=t.querySelector('.gtm-debug-card__subtitle, .gtm-debug-card__description, [class*="subtitle"], [class*="type-name"]'))==null?void 0:n.textContent)==null?void 0:e.trim())??"",o=t.textContent??"";if(!s&&!o.trim())continue;if(/\bfailed\b/i.test(o)||!!t.querySelector('[class*="failed"], [class*="exception"]')){t.classList.add("amd-tag-failed");continue}let i=!1;for(const{re:l,color:p}of fe)if(l.test(s)||l.test(o)){t.style.setProperty("--amd-tag-color",p),t.classList.add("amd-tag-colored"),i=!0;break}!i&&s&&(t.dataset.amdCard="skip")}}function be(a){return a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,e=>{let t="amd-json-num";return e.startsWith('"')?t=e.endsWith(":")?"amd-json-key":"amd-json-str":e==="true"||e==="false"?t="amd-json-bool":e==="null"&&(t="amd-json-null"),`<span class="${t}">${e}</span>`})}const xe=[".gtm-debug-table-cell--http-body pre",'pre[data-ng-bind*="getBody"]',"http-url-details pre",'[class*="http-body"] pre','[class*="outgoing-request"] pre','[class*="outgoing-http"] pre','[class*="request-body"] pre'].join(", ");function he(){var n,e;const a=document.querySelectorAll(xe);for(const t of a){if(t.dataset.amdJsonSkip||t.classList.contains("amd-json-fmt")&&t.children.length>0)continue;const s=((n=t.textContent)==null?void 0:n.trim())??"";if(!(s.length>2e5)&&!(!s.startsWith("{")&&!s.startsWith("[")))try{const o=JSON.parse(s),r=JSON.stringify(o,null,2);let i=(e=t.parentElement)==null?void 0:e.querySelector(":scope > .amd-json-copy");i||(i=document.createElement("button"),i.type="button",i.className="amd-json-copy",t.insertAdjacentElement("beforebegin",i));const l=r;i.textContent="Copia JSON",i.onclick=p=>{p.stopPropagation(),navigator.clipboard.writeText(l).then(()=>{i.textContent="✓ Copiato",setTimeout(()=>{i.textContent="Copia JSON"},1500)}).catch(()=>{i.textContent="✗ Errore",setTimeout(()=>{i.textContent="Copia JSON"},1500)})},t.innerHTML=be(r),t.classList.add("amd-json-fmt"),t.style.whiteSpace="pre-wrap",t.style.wordBreak="break-all"}catch{t.dataset.amdJsonSkip="1"}}}const F=["ad_storage","analytics_storage","ad_user_data","ad_personalization"];function R(a){const n=a.match(/^[Gg](\d*)$/);if(!n)return null;const e=n[1];return e.length?F.slice(0,e.length).map((t,s)=>({name:t,state:e[s]==="1"?"ok":e[s]==="0"?"no":"unk"})):null}function ye(a){const n=a.trim().split("|").filter(Boolean);return n.length?n.slice(0,F.length).map((e,t)=>({name:F[t],state:e.trim()==="granted"?"ok":e.trim()==="denied"?"no":"unk"})):null}function te(a){const n=document.createElement("div");n.className="amd-consent-badges";for(const e of a){const t=document.createElement("span");t.className=`amd-consent-badge amd-c-${e.state}`,t.textContent=e.name,t.title=e.state==="ok"?"granted":e.state==="no"?"denied":"unknown",n.appendChild(t)}return n}function ve(){var n,e,t,s,o,r,i,l,p;const a=document.querySelectorAll("tag-details");for(const d of a){if(d.dataset.amdConsentDone)continue;let c=null;if(!c){const m=d.querySelector('table[class*="properties-table"], .tag-details__properties-table');if(m){const u=(m.textContent??"").match(/gtm_session_consent_mode\s*:\s*"([^"]+)"/);u&&(c=ye(u[1]))}}if(!c){const m=d.querySelectorAll('td[class*="property-cell"]');for(const f of m){if(f.dataset.amdGcsRead)continue;const u=f.querySelector('[class*="property-name"]'),g=((n=u==null?void 0:u.textContent)==null?void 0:n.trim())??((e=f.textContent)==null?void 0:e.trim())??"";if(!/^\s*gcs\s*$/i.test(g))continue;f.dataset.amdGcsRead="1";const b=f.querySelector('[class*="property-value"]'),M=((t=b==null?void 0:b.textContent)==null?void 0:t.trim())??((o=(s=f.nextElementSibling)==null?void 0:s.textContent)==null?void 0:o.trim())??"";if(/^G\d+/i.test(M)){c=R(M);break}}}if(!c){const m=d.querySelector("gtag-hits-ng");if(m){const f=m.querySelectorAll('span.param-chip, [class*="param-chip"]');for(const u of f){if(u.dataset.amdGcsRead||((r=u.textContent)==null?void 0:r.trim())!=="gcs")continue;u.dataset.amdGcsRead="1";const g=(i=u.closest("td"))==null?void 0:i.nextElementSibling,b=((l=g==null?void 0:g.textContent)==null?void 0:l.trim())??"";if(/^G\d+/i.test(b)){c=R(b);break}}}}if(!c){const m=d.querySelectorAll('td, [class*="table-cell"], [class*="TableCell"]');for(const f of m){if(f.dataset.amdGcsRead||!/^\s*gcs\s*$/.test(f.textContent??""))continue;f.dataset.amdGcsRead="1";const u=f.nextElementSibling,g=((p=u==null?void 0:u.textContent)==null?void 0:p.trim())??"";if(/^G\d+/i.test(g)){c=R(g);break}}}if(!c)continue;d.dataset.amdConsentDone="1";const y=te(c);y.style.cssText="padding:4px 14px 7px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;";const x=document.createElement("span");x.textContent="Consent:",x.style.cssText="font:600 10px/1 system-ui,sans-serif; color:#5f6368; text-transform:uppercase; letter-spacing:.06em; flex-shrink:0;",y.prepend(x);const C=[...d.querySelectorAll('[class*="pane-header"]')].find(m=>/^\s*properties\s*$/i.test(m.textContent??""));if(C)C.parentElement.classList.add("amd-consent-host"),C.insertAdjacentElement("afterend",y);else{const m=d.querySelector(".gtm-sheet-card, .sheet-content")??d;m.classList.add("amd-consent-host"),m.prepend(y)}}}const ke=".gtm-debug-table-cell--query-param + .gtm-debug-table-cell pre";function Ce(){var n;const a=document.querySelectorAll(ke);for(const e of a){if(e.dataset.amdUrlFmt)continue;const t=((n=e.textContent)==null?void 0:n.trim())??"";if(!t.startsWith("http"))continue;if(t.indexOf("?")===-1){e.dataset.amdUrlFmt="skip";continue}try{const o=new URL(t),r=[...o.searchParams.entries()];if(r.length===0){e.dataset.amdUrlFmt="skip";continue}const i=x=>x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),l=document.createElement("div");l.className="amd-url-fmt";const p=document.createElement("div");p.className="amd-url-fmt-header";const d=document.createElement("span");d.className="amd-url-fmt-base",d.textContent=o.origin+o.pathname;const c=document.createElement("button");c.type="button",c.className="amd-json-copy",c.textContent="Copia URL",c.onclick=x=>{x.stopPropagation(),navigator.clipboard.writeText(t).then(()=>{c.textContent="✓ Copiato",setTimeout(()=>{c.textContent="Copia URL"},1500)}).catch(()=>{c.textContent="✗ Errore",setTimeout(()=>{c.textContent="Copia URL"},1500)})},p.appendChild(d),p.appendChild(c),l.appendChild(p);const y=document.createElement("table");y.className="amd-url-params";for(const[x,C]of r){const m=document.createElement("tr");let f=C;try{f=decodeURIComponent(C)}catch{}if(m.innerHTML=`<td class="amd-url-key">${i(x)}</td><td class="amd-url-val">${i(f)}</td>`,y.appendChild(m),x==="gcs"){const u=R(C);if(u){const g=document.createElement("tr"),b=document.createElement("td");b.colSpan=2,b.style.padding="2px 10px 6px",b.appendChild(te(u)),g.appendChild(b),y.appendChild(g)}}}l.appendChild(y),e.insertAdjacentElement("beforebegin",l),e.style.display="none",e.dataset.amdUrlFmt="1"}catch{e.dataset.amdUrlFmt="skip"}}}function ne(){if(ce(),I(L)){de();const a=$();me(a),ee(a),requestAnimationFrame(P)}ue(),ge(),he(),Ce(),ve()}let N=!1,O=!1;const Ee=new MutationObserver(a=>{a.every(e=>{var s;const t=e.target;return!!((s=t.closest)!=null&&s.call(t,`#${w}, #${v}, #${k}, #amd-ta-style, .amd-json-copy, .amd-url-fmt, .amd-gcs-val, .amd-consent-host`))})||N||(N=!0,requestAnimationFrame(()=>{N=!1,!O&&I(L)&&(O=!0,se()),ne()}))});Ee.observe(document.body,{childList:!0,subtree:!0});ne();
