const p="amd-ta-root",d="amd-ta-pinned",b="amd-ta-hidden",l="amd-ta-pin-btn",m="amd-ta-pin-on",x="amd-ta-hl",u=new Map;let h="";const $=[".message-list",'[class*="message-list"]',".messages-panel"],f=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],M=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'];function q(){const n=[];for(const e of $){const t=document.querySelectorAll(e).length;t&&n.push(`list container: "${e}" (${t} found)`)}for(const e of f){const t=document.querySelectorAll(e).length;t&&n.push(`event row: "${e}" (${t} found)`)}n.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),n.forEach(e=>console.log(e)),console.groupEnd())}function v(n,e=document){for(const t of n){const s=e.querySelector(t);if(s)return s}return null}function C(n,e=document){for(const t of n){const s=Array.from(e.querySelectorAll(t));if(s.length)return s}return[]}function S(n){var e,t;return((t=(e=n.querySelector(".message-list__title span[title]"))==null?void 0:e.getAttribute("title"))==null?void 0:t.trim())??""}function w(n){var e,t;return((t=(e=n.querySelector('.message-list__index, [class*="message-list__index"]'))==null?void 0:e.textContent)==null?void 0:t.trim())??""}function H(){var e;const n=v($);return n||(((e=v(f))==null?void 0:e.parentElement)??null)}function I(n){let e=n.parentElement;for(;e&&e!==document.body;){const{overflowY:t}=getComputedStyle(e);if(t==="auto"||t==="scroll")return e;e=e.parentElement}return n.parentElement??document.body}function y(){return C(f)}function N(n){var o,a;const e=I(n),t=(((o=document.getElementById(p))==null?void 0:o.offsetHeight)??45)+(((a=document.getElementById(d))==null?void 0:a.offsetHeight)??0)+8,s=n.getBoundingClientRect().top,i=e.getBoundingClientRect().top;e.scrollTo({top:e.scrollTop+(s-i)-t,behavior:"smooth"})}function T(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function z(){if(document.getElementById("amd-ta-style"))return;const n=document.createElement("style");n.id="amd-ta-style",n.textContent=`
    .${b} { display: none !important; }

    /* ── Toolbar ── sticky top, brand-tinted so it's clearly "LayerLens" */
    #${p} {
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
      margin-bottom: 6px !important;
      padding-top: 9px !important;
      padding-bottom: 9px !important;
      min-height: 40px !important;
      cursor: pointer !important;
      transition: background .12s !important;
    }
    .amd-ta-clone:last-child { margin-bottom: 0 !important; }
    .amd-ta-clone:hover { background: rgba(229,198,20,.22) !important; }
    /* "jump to" badge visible on hover */
    .amd-ta-clone::after {
      content: '↓ vai all'evento';
      display: none; position: absolute; right: 52px; top: 50%; transform: translateY(-50%);
      font-size: 10px; color: #7a6f1a; background: rgba(229,198,20,.28);
      padding: 2px 8px; border-radius: 8px; white-space: nowrap;
      pointer-events: none; font-family: system-ui, sans-serif;
    }
    .amd-ta-clone:hover::after { display: block; }
    .amd-ta-clone .${l} { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 8px 4px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }
  `,document.head.appendChild(n)}function D(){var s,i,o;if((s=document.getElementById(p))!=null&&s.isConnected)return;(i=document.getElementById(p))==null||i.remove();const n=H();if(!n)return;const e=I(n),t=document.createElement("div");t.id=p,t.innerHTML=`
    <div class="amd-ta-searchbox">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,e.prepend(t),(o=document.getElementById("amd-ta-search-input"))==null||o.addEventListener("input",a=>{h=a.target.value.toLowerCase().trim(),B(y())})}function L(){var t,s,i;if(u.size===0){(t=document.getElementById(d))==null||t.remove();return}if(!((s=document.getElementById(d))!=null&&s.isConnected)){(i=document.getElementById(d))==null||i.remove();const o=document.getElementById(p);if(!(o!=null&&o.isConnected))return;const a=document.createElement("div");a.id=d,o.insertAdjacentElement("afterend",a)}const n=document.getElementById(d);n.innerHTML=`<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${u.size})</span></div>`;const e=y();for(const[o,a]of u){const E=e.find(r=>w(r)===o);if(E){const r=E.cloneNode(!0);r.classList.add("amd-ta-clone"),r.removeAttribute("data-amd-pin-added"),r.querySelectorAll(`.${l}`).forEach(g=>g.remove()),O(r,o),r.addEventListener("click",g=>{if(g.target.closest(`.${l}`))return;g.preventDefault(),g.stopPropagation();const c=y().find(R=>w(R)===o);c&&(N(c),c.style.transition="background .1s",c.style.background="rgba(229,198,20,.45)",setTimeout(()=>{c.style.background="",c.style.transition=""},800),setTimeout(()=>c.click(),120))}),n.appendChild(r)}else{const r=document.createElement("div");r.className="amd-ta-placeholder",r.textContent=`${a} — non in questa pagina`,n.appendChild(r)}}}function O(n,e){const t=document.createElement("button");t.type="button",t.className=`${l} ${m}`,t.title="Rimuovi dai fissati",t.setAttribute("aria-pressed","true"),t.innerHTML=T(),t.addEventListener("click",s=>{s.stopPropagation(),s.preventDefault(),A(e)}),n.appendChild(t)}function A(n){u.delete(n),y().filter(e=>w(e)===n).forEach(e=>{e.classList.remove(x);const t=e.querySelector(`.${l}`);t&&(t.classList.remove(m),t.title="Fissa in cima",t.setAttribute("aria-pressed","false"))}),L()}function B(n){let e=0;for(const i of n){const o=!h||S(i).toLowerCase().includes(h);i.classList.toggle(b,!o),o&&e++}const t=C(M);for(const i of t){if(!h){i.classList.remove(b);continue}let o=i.nextElementSibling,a=!1;for(;o&&o.matches(f[0]);){if(!o.classList.contains(b)){a=!0;break}o=o.nextElementSibling}i.classList.toggle(b,!a)}const s=document.getElementById("amd-ta-count");s&&(h?(s.textContent=`${e} / ${n.length}`,s.style.display=""):s.style.display="none")}function j(n){for(const e of n){if(e.dataset.amdPinAdded)continue;e.dataset.amdPinAdded="1";const t=w(e),s=S(e),i=u.has(t);i&&e.classList.add(x);const o=document.createElement("button");o.type="button",o.className=`${l}${i?` ${m}`:""}`,o.title=i?"Rimuovi dai fissati":"Fissa in cima",o.setAttribute("aria-pressed",String(i)),o.innerHTML=T(),o.addEventListener("click",a=>{if(a.stopPropagation(),a.preventDefault(),!u.has(t))u.set(t,s),e.classList.add(x),o.classList.add(m),o.title="Rimuovi dai fissati",o.setAttribute("aria-pressed","true");else{A(t);return}L()}),e.appendChild(o)}}function P(){if(!v(f))return;z(),D();const n=y();j(n),B(n),requestAnimationFrame(L)}let k=!1,_=!1;const F=new MutationObserver(n=>{n.every(t=>{var i;const s=t.target;return!!((i=s.closest)!=null&&i.call(s,`#${p}, #${d}, #amd-ta-style`))})||k||(k=!0,requestAnimationFrame(()=>{k=!1,!_&&v(f)&&(_=!0,q()),P()}))});F.observe(document.body,{childList:!0,subtree:!0});P();
