const m="amd-ta-root",p="amd-ta-pinned",u="amd-ta-var-root",y="amd-ta-hidden",B="amd-ta-var-hidden",l="amd-ta-pin-btn",x="amd-ta-pin-on",k="amd-ta-hl",b=new Map;let v="",g="";const T=[".message-list",'[class*="message-list"]',".messages-panel"],h=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],Y=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'],R='variables-tab:not([aria-hidden="true"]):not(.ng-hide)',q=".gtm-debug-variable-table-row",P=".gtm-debug-chip",M=".gtm-debug-variable-table-value",G=".gtm-debug-variable-pane-content";function L(t,n=document){for(const e of t){const a=n.querySelector(e);if(a)return a}return null}function H(t,n=document){for(const e of t){const a=Array.from(n.querySelectorAll(e));if(a.length)return a}return[]}function U(){const t=[],n=(e,a)=>{for(const i of a){const o=document.querySelectorAll(i).length;o&&t.push(`${e}: "${i}" (${o})`)}};n("event list",T),n("event row",h),[R,q,P,M].forEach(e=>{const a=document.querySelectorAll(e).length;a&&t.push(`var: "${e}" (${a})`)}),t.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),t.forEach(e=>console.log(e)),console.groupEnd())}function N(t){var n,e;return((e=(n=t.querySelector(".message-list__title span[title]"))==null?void 0:n.getAttribute("title"))==null?void 0:e.trim())??""}function _(t){var n,e;return((e=(n=t.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:n.textContent)==null?void 0:e.trim())??""}function W(){var n;const t=L(T);return t||(((n=L(h))==null?void 0:n.parentElement)??null)}function D(t){let n=t.parentElement;for(;n&&n!==document.body;){const{overflowY:e}=getComputedStyle(n);if(e==="auto"||e==="scroll")return n;n=n.parentElement}return t.parentElement??document.body}function E(){return H(h)}function K(t){var o,s,c;const n=((o=document.getElementById(m))==null?void 0:o.parentElement)??D(t),e=(((s=document.getElementById(m))==null?void 0:s.offsetHeight)??46)+(((c=document.getElementById(p))==null?void 0:c.offsetHeight)??0)+10,a=t.getBoundingClientRect().top,i=n.getBoundingClientRect().top;n.scrollTo({top:n.scrollTop+(a-i)-e,behavior:"smooth"})}function O(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function V(t=14){return`<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}function J(){if(document.getElementById("amd-ta-style"))return;const t=document.createElement("style");t.id="amd-ta-style",t.textContent=`
    .${y}     { display: none !important; }
    .${B} { display: none !important; }

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
    #${m} {
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

    /* ── Pin button on event rows ── */
    .message-list__row--indented { position: relative; }
    .${l} {
      display: none;
      position: absolute; right: 30px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; color: #9aa0a6; line-height: 0;
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${l},
    .${l}.${x} { display: inline-flex; }
    .${l}:hover         { color: #202124; background: rgba(0,0,0,.07); }
    .${l}.${x} { color: #c9ad07; }
    .${k}             { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Pinned section — sticky below toolbar ── */
    #${p} {
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
      border-radius: 7px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,.08) !important;
      margin-bottom: 6px !important;
      padding-top: 9px !important;
      padding-bottom: 9px !important;
      min-height: 40px !important;
      cursor: pointer !important;
      transition: background .12s !important;
    }
    .amd-ta-clone:last-child { margin-bottom: 0 !important; }
    .amd-ta-clone:hover      { background: rgba(229,198,20,.22) !important; }
    .amd-ta-clone::after {
      content: '↓ vai all\\'evento';
      display: none; position: absolute; right: 52px; top: 50%; transform: translateY(-50%);
      font-size: 10px; color: #7a6f1a; background: rgba(229,198,20,.28);
      padding: 2px 8px; border-radius: 8px; white-space: nowrap;
      pointer-events: none; font-family: system-ui, sans-serif;
    }
    .amd-ta-clone:hover::after   { display: block; }
    .amd-ta-clone .${l}    { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 8px 4px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }

    /* ── Variables search bar ── */
    #${u} {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    #${u} .amd-ta-brand { font-size: 10px; padding: 3px 7px 3px 6px; }
    #${u} .amd-ta-searchbox { background: rgba(255,255,255,.8); border: 1px solid rgba(229,198,20,.5); }
    #amd-ta-var-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.28); padding: 2px 7px; border-radius: 10px;
    }
  `,document.head.appendChild(t)}function Q(){var a,i,o;if((a=document.getElementById(m))!=null&&a.isConnected)return;(i=document.getElementById(m))==null||i.remove();const t=W();if(!t)return;const n=D(t),e=document.createElement("div");e.id=m,e.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${V(14)}
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,n.prepend(e),(o=document.getElementById("amd-ta-search-input"))==null||o.addEventListener("input",s=>{v=s.target.value.toLowerCase().trim(),F(E())})}function S(){var e,a,i;if(b.size===0){(e=document.getElementById(p))==null||e.remove();return}if(!((a=document.getElementById(p))!=null&&a.isConnected)){(i=document.getElementById(p))==null||i.remove();const o=document.getElementById(m);if(!(o!=null&&o.isConnected))return;const s=document.createElement("div");s.id=p,o.insertAdjacentElement("afterend",s)}const t=document.getElementById(p);t.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${b.size})</span></div>`;const n=E();for(const[o,s]of b){const c=n.find(r=>_(r)===o);if(c){const r=c.cloneNode(!0);r.classList.add("amd-ta-clone"),r.removeAttribute("data-amd-pin-added"),r.querySelectorAll(`.${l}`).forEach(f=>f.remove()),X(r,o),r.addEventListener("click",f=>{if(f.target.closest(`.${l}`))return;f.preventDefault(),f.stopPropagation();const d=E().find(w=>_(w)===o);d&&(K(d),d.style.transition="background .1s",d.style.background="rgba(229,198,20,.45)",setTimeout(()=>{d.style.background="",d.style.transition=""},900))}),t.appendChild(r)}else{const r=document.createElement("div");r.className="amd-ta-placeholder",r.textContent=`${s} — non in questa pagina`,t.appendChild(r)}}}function X(t,n){const e=document.createElement("button");e.type="button",e.className=`${l} ${x}`,e.title="Rimuovi dai fissati",e.setAttribute("aria-pressed","true"),e.innerHTML=O(),e.addEventListener("click",a=>{a.stopPropagation(),a.preventDefault(),z(n)}),t.appendChild(e)}function z(t){b.delete(t),E().filter(n=>_(n)===t).forEach(n=>{n.classList.remove(k);const e=n.querySelector(`.${l}`);e&&(e.classList.remove(x),e.title="Fissa in cima",e.setAttribute("aria-pressed","false"))}),S()}function F(t){let n=0;for(const i of t){const o=!v||N(i).toLowerCase().includes(v);i.classList.toggle(y,!o),o&&n++}const e=H(Y);for(const i of e){if(!v){i.classList.remove(y);continue}let o=i.nextElementSibling,s=!1;for(;o&&o.matches(h[0]);){if(!o.classList.contains(y)){s=!0;break}o=o.nextElementSibling}i.classList.toggle(y,!s)}const a=document.getElementById("amd-ta-count");a&&(v?(a.textContent=`${n} / ${t.length}`,a.style.display=""):a.style.display="none")}function Z(t){for(const n of t){if(n.dataset.amdPinAdded)continue;n.dataset.amdPinAdded="1";const e=_(n),a=N(n),i=b.has(e);i&&n.classList.add(k);const o=document.createElement("button");o.type="button",o.className=`${l}${i?` ${x}`:""}`,o.title=i?"Rimuovi dai fissati":"Fissa in cima",o.setAttribute("aria-pressed",String(i)),o.innerHTML=O(),o.addEventListener("click",s=>{if(s.stopPropagation(),s.preventDefault(),!b.has(e))b.set(e,a),n.classList.add(k),o.classList.add(x),o.title="Rimuovi dai fissati",o.setAttribute("aria-pressed","true");else{z(e);return}S()}),n.appendChild(o)}}function A(){return document.querySelector(R)}function ee(){var i,o,s;const t=A();if(!t){(i=document.getElementById(u))==null||i.remove();return}if((o=document.getElementById(u))!=null&&o.isConnected){$(t);return}(s=document.getElementById(u))==null||s.remove();const n=t.querySelector(G);if(!n)return;const e=document.createElement("div");e.id=u,e.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${V(13)}
      <input type="search" id="amd-ta-var-input"
             placeholder="Cerca variabile o valore…"
             autocomplete="off" spellcheck="false" />
      <span id="amd-ta-var-count" style="display:none"></span>
    </div>`,n.prepend(e);const a=e.querySelector("#amd-ta-var-input");g&&(a.value=g),a.addEventListener("input",c=>{g=c.target.value.toLowerCase().trim();const r=A();r&&$(r)}),$(t)}function $(t){var i,o,s,c;const n=Array.from(t.querySelectorAll(q));let e=0;for(const r of n){const f=((o=(i=r.querySelector(P))==null?void 0:i.textContent)==null?void 0:o.toLowerCase())??"",d=((c=(s=r.querySelector(M))==null?void 0:s.textContent)==null?void 0:c.toLowerCase())??"",w=!g||f.includes(g)||d.includes(g);r.classList.toggle(B,!w),w&&e++}const a=document.getElementById("amd-ta-var-count");a&&(g&&n.length>0?(a.textContent=`${e} / ${n.length}`,a.style.display=""):a.style.display="none")}function j(){if(J(),L(h)){Q();const t=E();Z(t),F(t),requestAnimationFrame(S)}ee()}let C=!1,I=!1;const te=new MutationObserver(t=>{t.every(e=>{var i;const a=e.target;return!!((i=a.closest)!=null&&i.call(a,`#${m}, #${p}, #${u}, #amd-ta-style`))})||C||(C=!0,requestAnimationFrame(()=>{C=!1,!I&&L(h)&&(I=!0,U()),j()}))});te.observe(document.body,{childList:!0,subtree:!0});j();
