const f="amd-ta-root",d="amd-ta-pinned",p="amd-ta-var-root",y="amd-ta-hidden",T="amd-ta-var-hidden",c="amd-ta-pin-btn",w="amd-ta-pin-on",k="amd-ta-hl",g=new Map;let v="",u="";const B=[".message-list",'[class*="message-list"]',".messages-panel"],h=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],j=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'],R='variables-tab:not([aria-hidden="true"]):not(.ng-hide)',q=".gtm-debug-variable-table-row",P=".gtm-debug-chip",M=".gtm-debug-variable-table-value",Y=".gtm-debug-variable-pane-content";function _(t,n=document){for(const e of t){const a=n.querySelector(e);if(a)return a}return null}function H(t,n=document){for(const e of t){const a=Array.from(n.querySelectorAll(e));if(a.length)return a}return[]}function G(){const t=[],n=(e,a)=>{for(const i of a){const o=document.querySelectorAll(i).length;o&&t.push(`${e}: "${i}" (${o})`)}};n("event list",B),n("event row",h),[R,q,P,M].forEach(e=>{const a=document.querySelectorAll(e).length;a&&t.push(`var: "${e}" (${a})`)}),t.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),t.forEach(e=>console.log(e)),console.groupEnd())}function N(t){var n,e;return((e=(n=t.querySelector(".message-list__title span[title]"))==null?void 0:n.getAttribute("title"))==null?void 0:e.trim())??""}function L(t){var n,e;return((e=(n=t.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:n.textContent)==null?void 0:e.trim())??""}function U(){var n;const t=_(B);return t||(((n=_(h))==null?void 0:n.parentElement)??null)}function W(t){let n=t.parentElement;for(;n&&n!==document.body;){const{overflowY:e}=getComputedStyle(n);if(e==="auto"||e==="scroll"||e==="overlay")return n;n=n.parentElement}return t.parentElement??document.body}function E(){return H(h)}function K(t){var o;const n=document.getElementById(f),e=((n==null?void 0:n.offsetHeight)??46)+(((o=document.getElementById(d))==null?void 0:o.offsetHeight)??0)+8,a=[];let i=t.parentElement;for(;i;)a.push({el:i,before:i.scrollTop}),i=i.parentElement;t.scrollIntoView({block:"start",behavior:"instant"});for(const{el:s,before:l}of a)if(s.scrollTop!==l){s.scrollTop-=e;return}}function V(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function z(t=14){return`<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}function J(){if(document.getElementById("amd-ta-style"))return;const t=document.createElement("style");t.id="amd-ta-style",t.textContent=`
    .${y}     { display: none !important; }
    .${T} { display: none !important; }

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
    .${c}.${w}  { display: inline-flex !important; color: #c9ad07; }
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
  `,document.head.appendChild(t)}function Q(){var a,i,o;if((a=document.getElementById(f))!=null&&a.isConnected)return;(i=document.getElementById(f))==null||i.remove();const t=U();if(!t)return;const n=W(t),e=document.createElement("div");e.id=f,e.innerHTML=`
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
    </div>`,n.prepend(e),(o=document.getElementById("amd-ta-search-input"))==null||o.addEventListener("input",s=>{v=s.target.value.toLowerCase().trim(),O(E())})}function C(){var e,a,i;if(g.size===0){(e=document.getElementById(d))==null||e.remove();return}if(!((a=document.getElementById(d))!=null&&a.isConnected)){(i=document.getElementById(d))==null||i.remove();const o=document.getElementById(f);if(!(o!=null&&o.isConnected))return;const s=document.createElement("div");s.id=d,o.insertAdjacentElement("afterend",s)}const t=document.getElementById(d);t.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${g.size})</span></div>`;const n=E();for(const[o,s]of g){const l=n.find(r=>L(r)===o);if(l){const r=l.cloneNode(!0);r.classList.add("amd-ta-clone"),r.removeAttribute("data-amd-pin-added"),r.querySelectorAll(`.${c}`).forEach(m=>m.remove()),X(r,o),r.addEventListener("click",m=>{if(m.target.closest(`.${c}`))return;m.preventDefault(),m.stopPropagation();const b=E().filter(x=>!x.closest(`#${d}`)).find(x=>L(x)===o);b&&(K(b),b.classList.add("amd-ta-flash"),setTimeout(()=>b.classList.remove("amd-ta-flash"),1100))}),t.appendChild(r)}else{const r=document.createElement("div");r.className="amd-ta-placeholder",r.textContent=`${s} — non in questa pagina`,t.appendChild(r)}}}function X(t,n){const e=document.createElement("button");e.type="button",e.className=`${c} ${w}`,e.title="Rimuovi dai fissati",e.setAttribute("aria-pressed","true"),e.innerHTML=V(),e.addEventListener("click",a=>{a.stopPropagation(),a.preventDefault(),D(n)}),t.appendChild(e)}function D(t){g.delete(t),E().filter(n=>L(n)===t).forEach(n=>{n.classList.remove(k);const e=n.querySelector(`.${c}`);e&&(e.classList.remove(w),e.title="Fissa in cima",e.setAttribute("aria-pressed","false"))}),C()}function O(t){let n=0;for(const i of t){const o=!v||N(i).toLowerCase().includes(v);i.classList.toggle(y,!o),o&&n++}const e=H(j);for(const i of e){if(!v){i.classList.remove(y);continue}let o=i.nextElementSibling,s=!1;for(;o&&o.matches(h[0]);){if(!o.classList.contains(y)){s=!0;break}o=o.nextElementSibling}i.classList.toggle(y,!s)}const a=document.getElementById("amd-ta-count");a&&(v?(a.textContent=`${n} / ${t.length}`,a.style.display=""):a.style.display="none")}function Z(t){for(const n of t){if(n.dataset.amdPinAdded)continue;n.dataset.amdPinAdded="1";const e=L(n),a=N(n),i=g.has(e);i&&n.classList.add(k);const o=document.createElement("button");o.type="button",o.className=`${c}${i?` ${w}`:""}`,o.title=i?"Rimuovi dai fissati":"Fissa in cima",o.setAttribute("aria-pressed",String(i)),o.innerHTML=V(),o.addEventListener("click",s=>{if(s.stopPropagation(),s.preventDefault(),!g.has(e))g.set(e,a),n.classList.add(k),o.classList.add(w),o.title="Rimuovi dai fissati",o.setAttribute("aria-pressed","true");else{D(e);return}C()}),n.appendChild(o)}}function A(){return document.querySelector(R)}function ee(){var i,o,s;const t=A();if(!t){(i=document.getElementById(p))==null||i.remove();return}if((o=document.getElementById(p))!=null&&o.isConnected){$(t);return}(s=document.getElementById(p))==null||s.remove();const n=t.querySelector(Y);if(!n)return;const e=document.createElement("div");e.id=p,e.innerHTML=`
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
    </div>`,n.prepend(e);const a=e.querySelector("#amd-ta-var-input");u&&(a.value=u),a.addEventListener("input",l=>{u=l.target.value.toLowerCase().trim();const r=A();r&&$(r)}),$(t)}function $(t){var i,o,s,l;const n=Array.from(t.querySelectorAll(q));let e=0;for(const r of n){const m=((o=(i=r.querySelector(P))==null?void 0:i.textContent)==null?void 0:o.toLowerCase())??"",b=((l=(s=r.querySelector(M))==null?void 0:s.textContent)==null?void 0:l.toLowerCase())??"",x=!u||m.includes(u)||b.includes(u);r.classList.toggle(T,!x),x&&e++}const a=document.getElementById("amd-ta-var-count");a&&(u&&n.length>0?(a.textContent=`${e} / ${n.length}`,a.style.display=""):a.style.display="none")}function F(){if(J(),_(h)){Q();const t=E();Z(t),O(t),requestAnimationFrame(C)}ee()}let S=!1,I=!1;const te=new MutationObserver(t=>{t.every(e=>{var i;const a=e.target;return!!((i=a.closest)!=null&&i.call(a,`#${f}, #${d}, #${p}, #amd-ta-style`))})||S||(S=!0,requestAnimationFrame(()=>{S=!1,!I&&_(h)&&(I=!0,G()),F()}))});te.observe(document.body,{childList:!0,subtree:!0});F();
