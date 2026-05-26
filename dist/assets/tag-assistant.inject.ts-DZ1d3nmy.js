const p="amd-ta-root",c="amd-ta-pinned",g="amd-ta-hidden",l="amd-ta-pin-btn",m="amd-ta-pin-on",x="amd-ta-hl",d=new Set;let h="";const C=[".message-list",'[class*="message-list"]',".messages-panel"],f=[".message-list__row--indented",'[class*="message-list__row"][class*="indented"]','[class*="message-list__row--indented"]'],A=[".message-list__row:not(.message-list__row--indented)",'[class*="message-list__row"]:not([class*="indented"])'];function I(){const n=[];for(const e of C){const t=document.querySelectorAll(e).length;t&&n.push(`list container: "${e}" (${t} found)`)}for(const e of f){const t=document.querySelectorAll(e).length;t&&n.push(`event row: "${e}" (${t} found)`)}n.length&&(console.groupCollapsed("[LayerLens] Tag Assistant selector discovery"),n.forEach(e=>console.log(e)),console.groupEnd())}function v(n,e=document){for(const t of n){const o=e.querySelector(t);if(o)return o}return null}function $(n,e=document){for(const t of n){const o=Array.from(e.querySelectorAll(t));if(o.length)return o}return[]}function b(n){var e,t;return((t=(e=n.querySelector(".message-list__title span[title]"))==null?void 0:e.getAttribute("title"))==null?void 0:t.trim())??""}function B(){var e;const n=v(C);return n||(((e=v(f))==null?void 0:e.parentElement)??null)}function N(n){let e=n.parentElement;for(;e&&e!==document.body;){const{overflowY:t}=getComputedStyle(e);if(t==="auto"||t==="scroll")return e;e=e.parentElement}return n.parentElement??document.body}function y(){return $(f)}function k(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function T(){if(document.getElementById("amd-ta-style"))return;const n=document.createElement("style");n.id="amd-ta-style",n.textContent=`
    .${g} { display: none !important; }

    /* toolbar: sticky top inside the scroll container */
    #${p} {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px;
      background: #fff; border-bottom: 1px solid rgba(0,0,0,.1);
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-ta-searchbox {
      display: flex; align-items: center; gap: 7px; flex: 1;
      background: #f1f3f4; border-radius: 8px; padding: 6px 10px;
    }
    .amd-ta-searchbox svg { flex-shrink: 0; color: #9aa0a6; }
    .amd-ta-searchbox input {
      flex: 1; border: none; background: none; outline: none;
      font: inherit; color: #202124;
    }
    .amd-ta-searchbox input::-webkit-search-cancel-button { -webkit-appearance: none; }
    #amd-ta-count { font-size: 11px; color: #5f6368; flex-shrink: 0; white-space: nowrap; }

    /* pin button on each event row */
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
    .${l}.${m} { color: #e5c614; }
    .${x} { box-shadow: inset 3px 0 0 #e5c614; }

    /* pinned section — sticky below toolbar */
    #${c} {
      position: sticky; top: 45px; z-index: 99;
      background: #fff; border-bottom: 1px solid rgba(0,0,0,.1);
    }
    .amd-ta-pin-sep {
      padding: 4px 10px 2px; font-size: 10px; font-weight: 700;
      color: #9aa0a6; text-transform: uppercase; letter-spacing: .06em;
      font-family: system-ui, sans-serif;
    }
    .amd-ta-clone {
      background: rgba(229,198,20,.07) !important;
      box-shadow: inset 3px 0 0 #e5c614 !important;
    }
    .amd-ta-clone .${l} { display: inline-flex !important; color: #e5c614; }
    .amd-ta-placeholder {
      padding: 7px 10px; font-size: 13px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }
  `,document.head.appendChild(n)}function q(){var o,s,i;if((o=document.getElementById(p))!=null&&o.isConnected)return;(s=document.getElementById(p))==null||s.remove();const n=B();if(!n)return;const e=N(n),t=document.createElement("div");t.id=p,t.innerHTML=`
    <div class="amd-ta-searchbox">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,e.prepend(t),(i=document.getElementById("amd-ta-search-input"))==null||i.addEventListener("input",a=>{h=a.target.value.toLowerCase().trim(),S(y())})}function w(){var t,o,s;if(d.size===0){(t=document.getElementById(c))==null||t.remove();return}if(!((o=document.getElementById(c))!=null&&o.isConnected)){(s=document.getElementById(c))==null||s.remove();const i=document.getElementById(p);if(!(i!=null&&i.isConnected))return;const a=document.createElement("div");a.id=c,i.insertAdjacentElement("afterend",a)}const n=document.getElementById(c);n.innerHTML='<div class="amd-ta-pin-sep">Fissati</div>';const e=y();for(const i of d){const a=[...e].reverse().find(r=>b(r).toLowerCase()===i);if(a){const r=a.cloneNode(!0);r.classList.add("amd-ta-clone"),r.removeAttribute("data-amd-pin-added"),r.querySelectorAll(`.${l}`).forEach(u=>u.remove()),M(r,i),n.appendChild(r)}else{const r=document.createElement("div");r.className="amd-ta-placeholder",r.textContent=`${i} — non in questa pagina`,n.appendChild(r)}}}function M(n,e){const t=document.createElement("button");t.type="button",t.className=`${l} ${m}`,t.title="Rimuovi dai fissati",t.setAttribute("aria-pressed","true"),t.innerHTML=k(),t.addEventListener("click",o=>{o.stopPropagation(),o.preventDefault(),P(e)}),n.appendChild(t)}function P(n){d.delete(n),y().filter(e=>b(e).toLowerCase()===n).forEach(e=>{e.classList.remove(x);const t=e.querySelector(`.${l}`);t&&(t.classList.remove(m),t.title="Fissa in cima",t.setAttribute("aria-pressed","false"))}),w()}function S(n){let e=0;for(const s of n){const i=!h||b(s).toLowerCase().includes(h);s.classList.toggle(g,!i),i&&e++}const t=$(A);for(const s of t){if(!h){s.classList.remove(g);continue}let i=s.nextElementSibling,a=!1;for(;i&&i.matches(f[0]);){if(!i.classList.contains(g)){a=!0;break}i=i.nextElementSibling}s.classList.toggle(g,!a)}const o=document.getElementById("amd-ta-count");o&&(h?(o.textContent=`${e} / ${n.length}`,o.style.display=""):o.style.display="none")}function R(n){for(const e of n){if(e.dataset.amdPinAdded)continue;e.dataset.amdPinAdded="1";const t=b(e).toLowerCase(),o=d.has(t);o&&e.classList.add(x);const s=document.createElement("button");s.type="button",s.className=`${l}${o?` ${m}`:""}`,s.title=o?"Rimuovi dai fissati":"Fissa in cima",s.setAttribute("aria-pressed",String(o)),s.innerHTML=k(),s.addEventListener("click",i=>{i.stopPropagation(),i.preventDefault();const a=!d.has(t);a?d.add(t):d.delete(t),y().filter(r=>b(r).toLowerCase()===t).forEach(r=>{r.classList.toggle(x,a);const u=r.querySelector(`.${l}`);u&&(u.classList.toggle(m,a),u.title=a?"Rimuovi dai fissati":"Fissa in cima",u.setAttribute("aria-pressed",String(a)))}),w()}),e.appendChild(s)}}function _(){if(!v(f))return;T(),q();const n=y();R(n),S(n),requestAnimationFrame(w)}let E=!1,L=!1;const H=new MutationObserver(n=>{n.every(t=>{var s;const o=t.target;return!!((s=o.closest)!=null&&s.call(o,`#${p}, #${c}, #amd-ta-style`))})||E||(E=!0,requestAnimationFrame(()=>{E=!1,!L&&v(f)&&(L=!0,I()),_()}))});H.observe(document.body,{childList:!0,subtree:!0});_();
