const m="amd-ta-root",p="amd-ta-pinned",u="amd-ta-var-root",h="amd-ta-hidden",A="amd-ta-var-hidden",c="amd-ta-pin-btn",x="amd-ta-pin-on",k="amd-ta-hl",f=new Map;let y="",w="";const R=[".message-list",'[class*="message-list"]',".messages-panel"],b=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],V=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'],P=[".variable-list",'[class*="variable-list"]',"ctui-variable-list",'[class*="variables-panel"]'],N=[".variable-list__row",'[class*="variable-list__row"]','[class*="variable-list"] tr','[class*="variable-list"] li'];function v(e,t=document){for(const n of e){const a=t.querySelector(n);if(a)return a}return null}function $(e,t=document){for(const n of e){const a=Array.from(t.querySelectorAll(n));if(a.length)return a}return[]}function j(){const e=[],t=(n,a)=>{for(const i of a){const o=document.querySelectorAll(i).length;o&&e.push(`${n}: "${i}" (${o})`)}};t("event list",R),t("event row",b),t("var container",P),t("var row",N),e.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),e.forEach(n=>console.log(n)),console.groupEnd())}function O(e){var t,n;return((n=(t=e.querySelector(".message-list__title span[title]"))==null?void 0:t.getAttribute("title"))==null?void 0:n.trim())??""}function L(e){var t,n;return((n=(t=e.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:t.textContent)==null?void 0:n.trim())??""}function Y(){var t;const e=v(R);return e||(((t=v(b))==null?void 0:t.parentElement)??null)}function C(e){let t=e.parentElement;for(;t&&t!==document.body;){const{overflowY:n}=getComputedStyle(t);if(n==="auto"||n==="scroll")return t;t=t.parentElement}return e.parentElement??document.body}function E(){return $(b)}function G(e){var o,s,l;const t=((o=document.getElementById(m))==null?void 0:o.parentElement)??C(e),n=(((s=document.getElementById(m))==null?void 0:s.offsetHeight)??46)+(((l=document.getElementById(p))==null?void 0:l.offsetHeight)??0)+10,a=e.getBoundingClientRect().top,i=t.getBoundingClientRect().top;t.scrollTo({top:t.scrollTop+(a-i)-n,behavior:"smooth"})}function H(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function M(e=14){return`<svg viewBox="0 0 24 24" width="${e}" height="${e}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`}function W(){if(document.getElementById("amd-ta-style"))return;const e=document.createElement("style");e.id="amd-ta-style",e.textContent=`
    .${h}     { display: none !important; }
    .${A} { display: none !important; }

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
    .${c} {
      display: none;
      position: absolute; right: 30px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; color: #9aa0a6; line-height: 0;
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${c},
    .${c}.${x} { display: inline-flex; }
    .${c}:hover         { color: #202124; background: rgba(0,0,0,.07); }
    .${c}.${x} { color: #c9ad07; }
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
    .amd-ta-clone .${c}    { display: inline-flex !important; color: #c9ad07; }
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
  `,document.head.appendChild(e)}function K(){var a,i,o;if((a=document.getElementById(m))!=null&&a.isConnected)return;(i=document.getElementById(m))==null||i.remove();const e=Y();if(!e)return;const t=C(e),n=document.createElement("div");n.id=m,n.innerHTML=`
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${M(14)}
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,t.prepend(n),(o=document.getElementById("amd-ta-search-input"))==null||o.addEventListener("input",s=>{y=s.target.value.toLowerCase().trim(),D(E())})}function S(){var n,a,i;if(f.size===0){(n=document.getElementById(p))==null||n.remove();return}if(!((a=document.getElementById(p))!=null&&a.isConnected)){(i=document.getElementById(p))==null||i.remove();const o=document.getElementById(m);if(!(o!=null&&o.isConnected))return;const s=document.createElement("div");s.id=p,o.insertAdjacentElement("afterend",s)}const e=document.getElementById(p);e.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${f.size})</span></div>`;const t=E();for(const[o,s]of f){const l=t.find(r=>L(r)===o);if(l){const r=l.cloneNode(!0);r.classList.add("amd-ta-clone"),r.removeAttribute("data-amd-pin-added"),r.querySelectorAll(`.${c}`).forEach(d=>d.remove()),U(r,o),r.addEventListener("click",d=>{if(d.target.closest(`.${c}`))return;d.preventDefault(),d.stopPropagation();const g=E().find(F=>L(F)===o);g&&(G(g),g.style.transition="background .1s",g.style.background="rgba(229,198,20,.45)",setTimeout(()=>{g.style.background="",g.style.transition=""},900))}),e.appendChild(r)}else{const r=document.createElement("div");r.className="amd-ta-placeholder",r.textContent=`${s} — non in questa pagina`,e.appendChild(r)}}}function U(e,t){const n=document.createElement("button");n.type="button",n.className=`${c} ${x}`,n.title="Rimuovi dai fissati",n.setAttribute("aria-pressed","true"),n.innerHTML=H(),n.addEventListener("click",a=>{a.stopPropagation(),a.preventDefault(),z(t)}),e.appendChild(n)}function z(e){f.delete(e),E().filter(t=>L(t)===e).forEach(t=>{t.classList.remove(k);const n=t.querySelector(`.${c}`);n&&(n.classList.remove(x),n.title="Fissa in cima",n.setAttribute("aria-pressed","false"))}),S()}function D(e){let t=0;for(const i of e){const o=!y||O(i).toLowerCase().includes(y);i.classList.toggle(h,!o),o&&t++}const n=$(V);for(const i of n){if(!y){i.classList.remove(h);continue}let o=i.nextElementSibling,s=!1;for(;o&&o.matches(b[0]);){if(!o.classList.contains(h)){s=!0;break}o=o.nextElementSibling}i.classList.toggle(h,!s)}const a=document.getElementById("amd-ta-count");a&&(y?(a.textContent=`${t} / ${e.length}`,a.style.display=""):a.style.display="none")}function J(e){for(const t of e){if(t.dataset.amdPinAdded)continue;t.dataset.amdPinAdded="1";const n=L(t),a=O(t),i=f.has(n);i&&t.classList.add(k);const o=document.createElement("button");o.type="button",o.className=`${c}${i?` ${x}`:""}`,o.title=i?"Rimuovi dai fissati":"Fissa in cima",o.setAttribute("aria-pressed",String(i)),o.innerHTML=H(),o.addEventListener("click",s=>{if(s.stopPropagation(),s.preventDefault(),!f.has(n))f.set(n,a),t.classList.add(k),o.classList.add(x),o.title="Rimuovi dai fissati",o.setAttribute("aria-pressed","true");else{z(n);return}S()}),t.appendChild(o)}}function I(){return v(P)}function Q(e){return $(N,e)}function X(){var a,i,o,s,l;const e=I();if(!e){(a=document.getElementById(u))==null||a.remove();return}if((i=document.getElementById(u))!=null&&i.isConnected){B(e);return}(o=document.getElementById(u))==null||o.remove();const t=document.createElement("div");t.id=u,t.innerHTML=`
    <div class="amd-ta-brand" style="font-size:10px;padding:3px 7px 3px 6px">
      <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${M(13)}
      <input type="search" id="amd-ta-var-input" placeholder="Filtra variabili…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-var-count" style="display:none"></span>
    </div>`;const n=C(e);n&&n!==document.body&&n!==e?n.prepend(t):(s=e.parentElement)==null||s.insertBefore(t,e),(l=document.getElementById("amd-ta-var-input"))==null||l.addEventListener("input",r=>{w=r.target.value.toLowerCase().trim();const d=I();d&&B(d)})}function B(e){var i;const t=Q(e);let n=0;for(const o of t){const s=((i=o.textContent)==null?void 0:i.toLowerCase())??"",l=!w||s.includes(w);o.classList.toggle(A,!l),l&&n++}const a=document.getElementById("amd-ta-var-count");a&&(w&&t.length>0?(a.textContent=`${n} / ${t.length}`,a.style.display=""):a.style.display="none")}function q(){if(W(),v(b)){K();const e=E();J(e),D(e),requestAnimationFrame(S)}X()}let _=!1,T=!1;const Z=new MutationObserver(e=>{e.every(n=>{var i;const a=n.target;return!!((i=a.closest)!=null&&i.call(a,`#${m}, #${p}, #${u}, #amd-ta-style`))})||_||(_=!0,requestAnimationFrame(()=>{_=!1,!T&&v(b)&&(T=!0,j()),q()}))});Z.observe(document.body,{childList:!0,subtree:!0});q();
