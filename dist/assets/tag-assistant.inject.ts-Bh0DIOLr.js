const f="amd-ta-root",m="amd-ta-pinned",u="amd-ta-hidden",r="amd-ta-pin-btn",c="amd-ta-pin-on",y="amd-ta-hl",d=new Set;let p="";function g(e){var n,t;return((t=(n=e.querySelector(".message-list__title span[title]"))==null?void 0:n.getAttribute("title"))==null?void 0:t.trim())??""}function v(){var e;return((e=document.querySelector(".message-list__row"))==null?void 0:e.parentElement)??null}function b(){return Array.from(document.querySelectorAll(".message-list__row--indented"))}function L(){return'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>'}function $(){if(document.getElementById("amd-ta-style"))return;const e=document.createElement("style");e.id="amd-ta-style",e.textContent=`
    /* ── utility ── */
    .${u} { display: none !important; }

    /* ── search toolbar ── */
    #${f} {
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

    /* ── pin button on each event row ── */
    .message-list__row--indented { position: relative; }

    .${r} {
      display: none;
      position: absolute; right: 30px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; color: #9aa0a6; line-height: 0;
      transition: color .12s, background .12s;
    }
    /* show on row hover or when active */
    .message-list__row--indented:hover .${r},
    .${r}.${c} { display: inline-flex; }

    .${r}:hover { color: #202124; background: rgba(0,0,0,.07); }
    .${r}.${c} { color: #e5c614; }

    /* subtle yellow left-bar on pinned rows in the main list */
    .${y} { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── pinned section ── */
    #${m} {
      border-bottom: 1px solid rgba(0,0,0,.1);
      background: #fff;
    }
    .amd-ta-pin-sep {
      padding: 4px 10px 2px; font-size: 10px; font-weight: 700;
      color: #9aa0a6; text-transform: uppercase; letter-spacing: .06em;
      font-family: system-ui, sans-serif;
    }
    /* cloned rows inside the pinned section */
    .amd-ta-clone {
      background: rgba(229,198,20,.07) !important;
      box-shadow: inset 3px 0 0 #e5c614 !important;
    }
    .amd-ta-clone .${r} {
      display: inline-flex !important; color: #e5c614;
    }
    .amd-ta-placeholder {
      padding: 7px 10px; font-size: 13px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }
  `,document.head.appendChild(e)}function _(){var t;if(document.getElementById(f))return;const e=v();if(!e)return;const n=document.createElement("div");n.id=f,n.innerHTML=`
    <div class="amd-ta-searchbox">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`,e.insertAdjacentElement("beforebegin",n),(t=document.getElementById("amd-ta-search-input"))==null||t.addEventListener("input",a=>{p=a.target.value.toLowerCase().trim(),E(b())})}function w(){var t,a;if(d.size===0){(t=document.getElementById(m))==null||t.remove();return}let e=document.getElementById(m);if(!e){e=document.createElement("div"),e.id=m;const i=document.getElementById(f);i?i.insertAdjacentElement("afterend",e):(a=v())==null||a.insertAdjacentElement("beforebegin",e)}if(!e.isConnected)return;e.innerHTML='<div class="amd-ta-pin-sep">Fissati</div>';const n=b();for(const i of d){const s=[...n].reverse().find(o=>g(o).toLowerCase()===i);if(s){const o=s.cloneNode(!0);o.classList.add("amd-ta-clone"),o.removeAttribute("data-amd-pin-added"),o.querySelectorAll(`.${r}`).forEach(l=>l.remove()),C(o,i),e.appendChild(o)}else{const o=document.createElement("div");o.className="amd-ta-placeholder",o.textContent=`${i} (non in questa pagina)`,e.appendChild(o)}}}function C(e,n){const t=document.createElement("button");t.type="button",t.className=`${r} ${c}`,t.title="Rimuovi dai fissati",t.setAttribute("aria-pressed","true"),t.innerHTML=L(),t.addEventListener("click",a=>{a.stopPropagation(),a.preventDefault(),A(n)}),e.appendChild(t)}function A(e){d.delete(e),b().filter(n=>g(n).toLowerCase()===e).forEach(n=>{n.classList.remove(y);const t=n.querySelector(`.${r}`);t&&(t.classList.remove(c),t.title="Fissa in cima",t.setAttribute("aria-pressed","false"))}),w()}function E(e){let n=0;for(const i of e){const s=!p||g(i).toLowerCase().includes(p);i.classList.toggle(u,!s),s&&n++}const t=v();if(t){const i=Array.from(t.querySelectorAll(".message-list__row:not(.message-list__row--indented)"));for(const s of i){if(!p){s.classList.remove(u);continue}let o=s.nextElementSibling,l=!1;for(;o&&o.classList.contains("message-list__row--indented");){if(!o.classList.contains(u)){l=!0;break}o=o.nextElementSibling}s.classList.toggle(u,!l)}}const a=document.getElementById("amd-ta-count");a&&(p?(a.textContent=`${n} / ${e.length}`,a.style.display=""):a.style.display="none")}function S(e){for(const n of e){if(n.dataset.amdPinAdded)continue;n.dataset.amdPinAdded="1";const t=g(n).toLowerCase(),a=d.has(t);a&&n.classList.add(y);const i=document.createElement("button");i.type="button",i.className=`${r}${a?` ${c}`:""}`,i.title=a?"Rimuovi dai fissati":"Fissa in cima",i.setAttribute("aria-pressed",String(a)),i.innerHTML=L(),i.addEventListener("click",s=>{s.stopPropagation(),s.preventDefault();const o=!d.has(t);o?d.add(t):d.delete(t),b().filter(l=>g(l).toLowerCase()===t).forEach(l=>{l.classList.toggle(y,o);const h=l.querySelector(`.${r}`);h&&(h.classList.toggle(c,o),h.title=o?"Rimuovi dai fissati":"Fissa in cima",h.setAttribute("aria-pressed",String(o)))}),w()}),n.appendChild(i)}}function k(){if(!document.querySelector(".message-list__row"))return;$(),_();const e=b();e.length!==0&&(S(e),E(e),requestAnimationFrame(w))}let x=!1;const I=new MutationObserver(e=>{e.every(t=>{var i;const a=t.target;return!!((i=a.closest)!=null&&i.call(a,`#${f}, #${m}, #amd-ta-style`))})||x||(x=!0,requestAnimationFrame(()=>{x=!1,k()}))});I.observe(document.body,{childList:!0,subtree:!0});k();
