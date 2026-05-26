const u="amd-ta-root",d="amd-ta-pinned",g="amd-ta-hidden",l="amd-ta-pin-btn",m="amd-ta-pin-on",x="amd-ta-hl",c=new Set;let b="";const k=[".message-list",'[class*="message-list"]',".messages-panel"],f=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],A=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'];function I(){const n=[];for(const e of k){const t=document.querySelectorAll(e).length;t&&n.push(`list container: "${e}" (${t} found)`)}for(const e of f){const t=document.querySelectorAll(e).length;t&&n.push(`event row: "${e}" (${t} found)`)}n.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),n.forEach(e=>console.log(e)),console.groupEnd())}function v(n,e=document){for(const t of n){const o=e.querySelector(t);if(o)return o}return null}function C(n,e=document){for(const t of n){const o=Array.from(e.querySelectorAll(t));if(o.length)return o}return[]}function h(n){var e,t;return((t=(e=n.querySelector(".message-list__title span[title]"))==null?void 0:e.getAttribute("title"))==null?void 0:t.trim())??""}function B(){var e;const n=v(k);return n||(((e=v(f))==null?void 0:e.parentElement)??null)}function T(n){let e=n.parentElement;for(;e&&e!==document.body;){const{overflowY:t}=getComputedStyle(e);if(t==="auto"||t==="scroll")return e;e=e.parentElement}return n.parentElement??document.body}function y(){return C(f)}function $(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function N(){if(document.getElementById("amd-ta-style"))return;const n=document.createElement("style");n.id="amd-ta-style",n.textContent=`
    .${g} { display: none !important; }

    /* ── Toolbar ── sticky top, brand-tinted so it's clearly "LayerLens" */
    #${u} {
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
    .${l}.${m} { display: inline-flex; }
    .${l}:hover { color: #202124; background: rgba(0,0,0,.07); }
    .${l}.${m} { color: #c9ad07; }
    .${x} { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Pinned section — sticky below toolbar, clearly branded ── */
    #${d} {
      position: sticky; top: 45px; z-index: 99;
      background: #fffdf0;
      border-bottom: 2px solid rgba(229,198,20,.5);
    }
    .amd-ta-pin-sep {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 10px 4px;
      font-size: 10px; font-weight: 700; letter-spacing: .07em;
      text-transform: uppercase; font-family: system-ui, sans-serif;
      color: #7a6f1a;
    }
    /* small pin icon before the label */
    .amd-ta-pin-sep::before {
      content: '';
      display: inline-block; width: 10px; height: 10px; flex-shrink: 0;
      background: #e5c614; border-radius: 2px;
    }

    /* cloned pinned rows */
    .amd-ta-clone {
      background: rgba(229,198,20,.13) !important;
      border-left: 3px solid #e5c614 !important;
      box-shadow: none !important;
    }
    .amd-ta-clone:hover { background: rgba(229,198,20,.2) !important; }
    .amd-ta-clone .${l} { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 7px 12px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }
  `,document.head.appendChild(n)}function P(){var o,s,i;if((o=document.getElementById(u))!=null&&o.isConnected)return;(s=document.getElementById(u))==null||s.remove();const n=B();if(!n)return;const e=T(n),t=document.createElement("div");t.id=u,t.innerHTML=`
    <div class="amd-ta-searchbox">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,e.prepend(t),(i=document.getElementById("amd-ta-search-input"))==null||i.addEventListener("input",a=>{b=a.target.value.toLowerCase().trim(),S(y())})}function E(){var t,o,s;if(c.size===0){(t=document.getElementById(d))==null||t.remove();return}if(!((o=document.getElementById(d))!=null&&o.isConnected)){(s=document.getElementById(d))==null||s.remove();const i=document.getElementById(u);if(!(i!=null&&i.isConnected))return;const a=document.createElement("div");a.id=d,i.insertAdjacentElement("afterend",a)}const n=document.getElementById(d);n.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${c.size})</span></div>`;const e=y();for(const i of c){const a=[...e].reverse().find(r=>h(r).toLowerCase()===i);if(a){const r=a.cloneNode(!0);r.classList.add("amd-ta-clone"),r.removeAttribute("data-amd-pin-added"),r.querySelectorAll(`.${l}`).forEach(p=>p.remove()),q(r,i),n.appendChild(r)}else{const r=document.createElement("div");r.className="amd-ta-placeholder",r.textContent=`${i} — non in questa pagina`,n.appendChild(r)}}}function q(n,e){const t=document.createElement("button");t.type="button",t.className=`${l} ${m}`,t.title="Rimuovi dai fissati",t.setAttribute("aria-pressed","true"),t.innerHTML=$(),t.addEventListener("click",o=>{o.stopPropagation(),o.preventDefault(),M(e)}),n.appendChild(t)}function M(n){c.delete(n),y().filter(e=>h(e).toLowerCase()===n).forEach(e=>{e.classList.remove(x);const t=e.querySelector(`.${l}`);t&&(t.classList.remove(m),t.title="Fissa in cima",t.setAttribute("aria-pressed","false"))}),E()}function S(n){let e=0;for(const s of n){const i=!b||h(s).toLowerCase().includes(b);s.classList.toggle(g,!i),i&&e++}const t=C(A);for(const s of t){if(!b){s.classList.remove(g);continue}let i=s.nextElementSibling,a=!1;for(;i&&i.matches(f[0]);){if(!i.classList.contains(g)){a=!0;break}i=i.nextElementSibling}s.classList.toggle(g,!a)}const o=document.getElementById("amd-ta-count");o&&(b?(o.textContent=`${e} / ${n.length}`,o.style.display=""):o.style.display="none")}function R(n){for(const e of n){if(e.dataset.amdPinAdded)continue;e.dataset.amdPinAdded="1";const t=h(e).toLowerCase(),o=c.has(t);o&&e.classList.add(x);const s=document.createElement("button");s.type="button",s.className=`${l}${o?` ${m}`:""}`,s.title=o?"Rimuovi dai fissati":"Fissa in cima",s.setAttribute("aria-pressed",String(o)),s.innerHTML=$(),s.addEventListener("click",i=>{i.stopPropagation(),i.preventDefault();const a=!c.has(t);a?c.add(t):c.delete(t),y().filter(r=>h(r).toLowerCase()===t).forEach(r=>{r.classList.toggle(x,a);const p=r.querySelector(`.${l}`);p&&(p.classList.toggle(m,a),p.title=a?"Rimuovi dai fissati":"Fissa in cima",p.setAttribute("aria-pressed",String(a)))}),E()}),e.appendChild(s)}}function _(){if(!v(f))return;N(),P();const n=y();R(n),S(n),requestAnimationFrame(E)}let w=!1,L=!1;const H=new MutationObserver(n=>{n.every(t=>{var s;const o=t.target;return!!((s=o.closest)!=null&&s.call(o,`#${u}, #${d}, #amd-ta-style`))})||w||(w=!0,requestAnimationFrame(()=>{w=!1,!L&&v(f)&&(L=!0,I()),_()}))});H.observe(document.body,{childList:!0,subtree:!0});_();
