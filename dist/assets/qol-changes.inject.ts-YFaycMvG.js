const X={TAGS:["tagService","serverTagService","sTagService"],TRIGGERS:["triggerService","serverTriggerService"],VARIABLES:["variableService","serverVariableService"],CLIENTS:["clientService","serverClientService","sClientService"]},Q={TAGS:"tag",TRIGGERS:"trigger",VARIABLES:"variable",CLIENTS:"client"},oe={c:"Costante",jsm:"JavaScript personalizzato",j:"JavaScript",v:"Variabile livello dati",smm:"Tabella di ricerca",remm:"Tabella di ricerca regex",k:"Cookie primario",aev:"Variabile evento automatico",u:"Componente URL",f:"Referrer HTTP",d:"Elemento DOM",e:"Errore JavaScript",vis:"Visibilità elemento",dbg:"Modalità debug",r:"Numero casuale",ctv:"Versione contenitore",cid:"ID contenitore",gas:"Impostazioni Google Analytics",awec:"Dati forniti dall’utente",cl:"Classi clic",ce:"Elemento clic",cu:"URL clic",ct:"Testo clic",fct:"Variabile modulo",hl:"Frammento cronologia",uv:"Variabile non definita"};function be(t){var n;const e=((n=window.__QOL_VARS__)==null?void 0:n.variableTypeLabels)??{};return e[t]?e[t]:oe[t]?oe[t]:t.startsWith("cvt_")?e.cvt_??"Modello personalizzato":t}const ye={gaaw_client:"GA4 Client",gtm_client:"GTM Client",node_client:"Node.js",preview_client:"Anteprima",flush_client:"Flush",pubsub_client:"Cloud Pub/Sub",sp_client:"Stape"};function he(t){return ye[t]??t}function z(){var t;try{return((t=window.angular)==null?void 0:t.element(document.body).injector())??null}catch{return null}}function K(t){const e=z();if(!e)return null;for(const n of X[t])try{const o=e.get(n);if(o&&(typeof o.getList=="function"||o.$$state!=null))return o}catch{}return console.debug(`[Andromeda] service not found for page=${t}. Tried: ${X[t].join(", ")}. Use window.angular?.element(document.body).injector() in the console to enumerate available services.`),null}function xe(t){var e;try{return(e=window.angular)==null?void 0:e.element(t).scope()}catch{return}}function H(){var t,e,n;try{return((n=(e=(t=z())==null?void 0:t.get("appStateService"))==null?void 0:e.getContext)==null?void 0:n.call(e))??void 0}catch{return}}function T(t){const e=t.querySelector("td:nth-child(2)")??t,n=e.querySelector("a");if(!n)return(e.textContent??"").trim();const o=n.cloneNode(!0);return o.querySelectorAll(".amd-type-icon, .amd-type-initial").forEach(r=>r.remove()),(o.textContent??"").trim()}function $(t){var e,n;try{const o=Q[t];let r=null;if(t==="VARIABLES"&&(r=document.querySelector('.gtm-container-page-content [data-gtm-cloak="variable-list"] > .card.card--table [gtm-table] table')??document.querySelector('.gtm-container-page-content [data-gtm-cloak="variable-list"] [gtm-table]:not([data-table-id="variable-list-built-in"]) table')),r=r??document.querySelector(".gtm-container-page-content [gtm-table]:last-of-type table")??document.querySelector(".gtm-container-page-content [gtm-table] table"),!r)return[];const a=Array.from(r.querySelectorAll("[gtm-table-row]"));if(a.length===0)return[];const i=K(t),c=((n=(e=i!=null&&i.getList?i.getList(H()):i)==null?void 0:e.$$state)==null?void 0:n.value)??[],l=new Map;c.forEach((m,p)=>{var d;const g=((d=m[o])==null?void 0:d.data)??m.data;(g==null?void 0:g.name)!=null&&l.set(String(g.name),g),l.set(`#${p}`,g)});const s=a.map((m,p)=>{var k,E,C,y;const g=T(m),d=l.get(g)??l.get(`#${p}`)??((E=(k=xe(m))==null?void 0:k[o])==null?void 0:E.data),u=(y=(C=d==null?void 0:d.vendorTemplate)==null?void 0:C.key)==null?void 0:y.publicId,f=String((d==null?void 0:d.typeDisplayName)??(t==="VARIABLES"?u??(d==null?void 0:d.type)??"":(d==null?void 0:d.type)??u??""));let b;(d==null?void 0:d.typeDisplayName)!=null?b=String(d.typeDisplayName):t==="VARIABLES"&&f?b=be(f):t==="CLIENTS"&&f?b=he(f):b=f||"Sconosciuto";const x=b,L=d!=null&&f!=="";return{node:m,type:x,code:f,name:g||((d==null?void 0:d.name)==null?"":String(d.name)),displayName:b,resolved:L,brandThumbnailUrl:(d==null?void 0:d.brandThumbnailUrl)??"",rawType:(d==null?void 0:d.type)==null?"":String(d.type),publicId:u??"",paused:(d==null?void 0:d.paused)===!0}});return s.some(m=>m.resolved)?s.filter(m=>m.resolved).map(({resolved:m,...p})=>p):[]}catch{return[]}}function Y(t){try{const e=document.querySelector('div[data-table-id="variable-list-built-in"]');if(!e)return!1;const n=e.querySelector(":scope > table");return t?(e.setAttribute("style","height: 56px !important; overflow: hidden !important;"),n&&(n.style.display="none")):(e.setAttribute("style",""),n&&(n.style.display="table")),!0}catch{return!1}}function ve(){return!!document.querySelector('div[data-table-id="variable-list-built-in"]')}function Z(t,e){if(e)try{let n=function(c){if(!c||typeof c!="object")return!1;const l=c,s=l.data;return typeof(s==null?void 0:s.name)=="string"&&s.name===e||typeof l.name=="string"&&l.name===e},o=function(c,l){if(!c||l>60)return;const s=c[i];if(s!=null&&n(s)){const m=s.key;if(m!=null)return m}const h=o(c.$$childHead,l+1);return h??o(c.$$nextSibling,l)};const r=z();if(!r)return;const a=r.get("$rootScope");if(!a)return;const i=Q[t];return o(a.$$childHead,0)}catch{return}}function we(t,e,n){var a,i,c,l;const o=e.closest("[gtm-table-row]")??e.closest("tr"),r=Q[t];try{if(z()){const h=H(),m=K(t);if(m){let p;try{const g=document.querySelector(".gtm-container-page-content [gtm-table]:last-of-type table")??document.querySelector(".gtm-container-page-content [gtm-table] table"),d=g?(a=window.angular)==null?void 0:a.element(g).scope():void 0,u=d==null?void 0:d.tableCtrl,f=((i=u==null?void 0:u.getItems)==null?void 0:i.call(u))??(u==null?void 0:u.items)??(u==null?void 0:u.internalItems);if(f&&o){const x=(g?Array.from(g.querySelectorAll("[gtm-table-row]")):[]).indexOf(o);x>=0&&f[x]&&(p=f[x].key)}}catch{}if(!p&&o&&(p=Z(t,T(o)),p!=null&&console.debug(`[Andromeda QoL] copy: key resolved via $rootScope traversal for "${T(o)}"`)),!p){const g=o?T(o):"",d=((l=(c=m.getList(h))==null?void 0:c.$$state)==null?void 0:l.value)??[],u=b=>b[r]??b,f=g?d.find(b=>{var x;return((x=u(b).data)==null?void 0:x.name)===g}):void 0;p=f?u(f).key:void 0}if(p)return m.get(p).then(g=>{var b,x;const d=((x=(b=m.getList(h))==null?void 0:b.$$state)==null?void 0:x.value)??[],u=d.length>0?d.map(L=>{var k;return(k=(L[r]??L).data)==null?void 0:k.name}):Array.from(document.querySelectorAll(".gtm-container-page-content [gtm-table-row]")).map(T);let f=g.data.name;for(;u.indexOf(f)>=0;)f+=" - Copy";return g.data.name=f,m.create(h,{data:g.data})}).then(()=>n==null?void 0:n(!0)).catch(g=>{console.warn("[Andromeda QoL] copy: service error",g),n==null||n(!1)}),!0;console.debug(`[Andromeda QoL] copy: service found for page=${t} but could not resolve key for "${o?T(o):"?"}". Falling through to menu fallback.`)}else console.debug(`[Andromeda QoL] copy: no service found for page=${t}. Tried: ${X[t].join(", ")}.`)}else console.debug("[Andromeda QoL] copy: window.angular not available — skipping Angular service path.")}catch(s){console.warn("[Andromeda QoL] copy: Angular path exception",s)}return o&&ke(o,n)?!0:(console.warn(`[Andromeda QoL] copy: could not duplicate "${o?T(o):"?"}" on page ${t}. Neither the Angular service path nor the native menu fallback succeeded. Open the browser console and check window.angular to diagnose.`),n==null||n(!1),!1)}const Se=["copia","copy","duplica","duplicate","clone"];function ke(t,e){try{let n=function(){const i=r[a++];if(i===0){if(ae()){e==null||e(!0);return}n()}else a<=r.length&&setTimeout(()=>{ae()?e==null||e(!0):a<r.length?n():(console.debug("[Andromeda QoL] clickCopyItem: no copy menu item found after all retries."),e==null||e(!1))},i)};const o=t.querySelector("[data-action-menu-toggle]")??t.querySelector('button[aria-label*="zioni"]')??t.querySelector('button[aria-label*="ction"]')??t.querySelector('button[aria-haspopup="menu"]')??t.querySelector('button[aria-haspopup="true"]')??t.querySelector(".icon-btn-more, .more-actions")??t.querySelector('[aria-label*="altro"]')??t.querySelector('[aria-label*="more"]')??t.querySelector('[aria-label*="option"]')??t.querySelector("button.mat-icon-button")??t.querySelector("button.mat-mdc-icon-button")??t.querySelector("td:last-child button");if(!o)return console.debug("[Andromeda QoL] copyViaActionMenu: no menu toggle found in row. Row HTML (first 300 chars):",t.outerHTML.slice(0,300)),!1;o.click();const r=[0,80,200,350];let a=0;return n(),!0}catch(n){return console.debug("[Andromeda QoL] copyViaActionMenu error",n),!1}}function ae(){try{const t=document.querySelector('[role="menu"]:not([hidden])')??document.querySelector(".mat-menu-panel:not([hidden])")??document.querySelector(".mat-mdc-menu-panel:not([hidden])")??document.querySelector('.cdk-overlay-container [role="menu"]')??document.querySelector(".dropdown-menu:not(.ng-hide)")??document.querySelector("[data-action-menu]");if(!t)return!1;const n=Array.from(t.querySelectorAll('[role="menuitem"], [role="option"], .mat-menu-item, .mat-mdc-menu-item, button, a')).find(o=>{const r=(o.textContent??"").trim().toLowerCase();return Se.some(a=>r.includes(a))});return n?(n.click(),!0):!1}catch{return!1}}function Ce(t,e,n,o){var r,a,i,c;try{if(!z())return o==null||o(!1),!1;const s=K(t);if(!s)return o==null||o(!1),!1;const h=Q[t];let m;try{const p=document.querySelector(".gtm-container-page-content [gtm-table]:last-of-type table")??document.querySelector(".gtm-container-page-content [gtm-table] table"),g=p?(r=window.angular)==null?void 0:r.element(p).scope():void 0,d=g==null?void 0:g.tableCtrl,u=((a=d==null?void 0:d.getItems)==null?void 0:a.call(d))??(d==null?void 0:d.items)??(d==null?void 0:d.internalItems);if(u){const b=(p?Array.from(p.querySelectorAll("[gtm-table-row]")):[]).indexOf(e);b>=0&&u[b]&&(m=u[b].key)}}catch{}if(m||(m=Z(t,T(e))),!m){const p=T(e),g=((c=(i=s.getList(H()))==null?void 0:i.$$state)==null?void 0:c.value)??[],d=p?g.find(u=>{var b;return((b=(u[h]??u).data)==null?void 0:b.name)===p}):void 0;d&&(m=(d[h]??d).key)}return m?(s.get(m).then(p=>(p.data.name=n,s.update(p))).then(()=>o==null?void 0:o(!0)).catch(p=>{console.warn("[LayerLens] rename: service error",p),o==null||o(!1)}),!0):(o==null||o(!1),!1)}catch(l){return console.warn("[LayerLens] rename error",l),o==null||o(!1),!1}}function Ee(t,e){var n,o,r,a,i;try{if(!z())return console.debug("[Andromeda QoL] toggleTagPause: angular injector not available"),e==null||e(!1),!1;const l=K("TAGS");if(!l)return console.debug("[Andromeda QoL] toggleTagPause: tagService not found"),e==null||e(!1),!1;let s;try{const m=(n=window.angular)==null?void 0:n.element(t).scope(),p=(m==null?void 0:m.tag)??(m==null?void 0:m.tag);(p==null?void 0:p.key)!=null&&(s=p.key)}catch{}if(!s)try{const m=document.querySelector(".gtm-container-page-content [gtm-table]:last-of-type table")??document.querySelector(".gtm-container-page-content [gtm-table] table"),p=m?(o=window.angular)==null?void 0:o.element(m).scope():void 0,g=p==null?void 0:p.tableCtrl,d=((r=g==null?void 0:g.getItems)==null?void 0:r.call(g))??(g==null?void 0:g.items)??(g==null?void 0:g.internalItems);if(d){const f=(m?Array.from(m.querySelectorAll("[gtm-table-row]")):[]).indexOf(t);f>=0&&d[f]&&(s=d[f].key)}}catch{}if(s||(s=Z("TAGS",T(t))),!s){const m=T(t),p=H(),g=((i=(a=l.getList(p))==null?void 0:a.$$state)==null?void 0:i.value)??[],d=m?g.find(u=>{var b;return((b=(u.tag??u).data)==null?void 0:b.name)===m}):void 0;d&&(s=(d.tag??d).key??void 0)}if(!s)return console.debug("[Andromeda QoL] toggleTagPause: could not resolve key for",T(t)),e==null||e(!1),!1;const h=Object.assign({},s);return l.get(h).then(m=>(m.data.paused?delete m.data.paused:m.data.paused=!0,l.update(m))).then(()=>e==null?void 0:e(!0)).catch(m=>{console.warn("[Andromeda QoL] toggleTagPause: service error",m),e==null||e(!1)}),!0}catch(c){return console.warn("[Andromeda QoL] toggleTagPause error",c),e==null||e(!1),!1}}const Le={pageVariables:['[data-gtm-cloak="variable-list"]'],pageTags:['[data-gtm-cloak="tag-list-page"]'],pageTriggers:['[data-gtm-cloak-notifier] [data-table-id="trigger-list"]'],pageClients:['[data-gtm-cloak="client-list"]','[data-gtm-cloak="client-list-page"]','[data-gtm-cloak-notifier] [data-table-id="client-list"]','[data-table-id="client-list"]'],filterInput:['.card-title-bar [data-ng-model="ctrl.filter"]','[data-ng-model="ctrl.filter"]'],builtInVariableList:['div[data-table-id="variable-list-built-in"]'],debuggerHeader:[".debugger-header"],previewCard:[".preview-card.preview-card"],containerPublicId:["gtm-container-public-id"]};function Ae(t,e=document){for(const n of Le[t]){const o=e.querySelector(n);if(o)return o}return null}function M(t,e=document){return Ae(t,e)!=null}function Te(){return M("pageVariables")?"VARIABLES":M("pageTags")?"TAGS":M("pageTriggers")?"TRIGGERS":M("pageClients")?"CLIENTS":""}function G(){return{selectedTypes:new Set,query:"",pauseFilter:"all"}}function Ne(t){const e=new Map;for(const n of t){const o=e.get(n.type)??{type:n.type,displayName:String(n.displayName??n.type),count:0};o.count+=1,e.set(n.type,o)}return[...e.values()].sort((n,o)=>String(n.displayName).localeCompare(String(o.displayName),void 0,{sensitivity:"base"}))}function qe(t,e){if(e.selectedTypes.size>0&&!e.selectedTypes.has(t.type))return!1;const n=e.query.trim().toLowerCase();return!(n&&!t.name.toLowerCase().includes(n)||e.pauseFilter==="paused"&&!t.paused||e.pauseFilter==="active"&&t.paused)}function _e(t,e){const n=[],o=[];for(const r of t)(qe(r,e)?n:o).push(r);return{show:n,hide:o}}try{const t=document.currentScript,e=(t==null?void 0:t.dataset.qolVars)??document.documentElement.dataset.qolVars;e&&(window.__QOL_VARS__={...window.__QOL_VARS__??{},...JSON.parse(e)})}catch{}const w="andromeda-filters",W="andromeda-row-hidden";var de;const P=typeof((de=window.__QOL_VARS__)==null?void 0:de.imgBase)=="string"?window.__QOL_VARS__.imgBase:"";let S=G(),v="",V=!0,_=!1,F=[];function me(t){return`amd_sel_${t}`}function Ie(){if(v!=="")try{sessionStorage.setItem(me(v),JSON.stringify({types:[...S.selectedTypes],pauseFilter:S.pauseFilter}))}catch{}}function $e(t,e){try{const n=sessionStorage.getItem(me(t));if(!n)return;const o=JSON.parse(n);if(Array.isArray(o))S.selectedTypes=new Set(o.filter(r=>e.has(r)));else if(o&&typeof o=="object"){const r=o;Array.isArray(r.types)&&(S.selectedTypes=new Set(r.types.filter(a=>e.has(a)))),(r.pauseFilter==="paused"||r.pauseFilter==="active")&&(S.pauseFilter=r.pauseFilter)}}catch{}}var se;let I={...((se=window.__QOL_VARS__)==null?void 0:se.variableTypeLabels)??{}};function Be(){window.postMessage({action:"amd_get_var_labels"},"*")}function Ve(t){window.postMessage({action:"amd_set_var_labels",payload:t},"*")}window.addEventListener("message",t=>{if(t.source!==window)return;const e=t.data;if((e==null?void 0:e.action)==="amd_var_labels"&&e.payload){const n=JSON.stringify(e.payload),o=JSON.stringify(I);if(n===o)return;I=e.payload,window.__QOL_VARS__={...window.__QOL_VARS__??{},variableTypeLabels:I},v==="VARIABLES"&&te(!0)}});function ze(){if(document.getElementById("andromeda-filters-style"))return;const t=document.createElement("style");t.id="andromeda-filters-style",t.textContent=`
    .${W} { display: none !important; }
    #${w} {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 10px 14px; margin: 0 0 6px;
      border-bottom: 1px solid rgba(0,0,0,.07);
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: relative;
    }
    /* ── filter trigger button ─────────────────────────────────── */
    #${w} .amd-filter-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 11px; border: 1px solid rgba(0,0,0,.18); border-radius: 9px;
      background: #fff; color: #3c4043; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background .12s, border-color .12s;
      white-space: nowrap;
    }
    #${w} .amd-filter-btn:hover { background: #faf6da; border-color: #e5c614; }
    #${w} .amd-filter-btn.active { background: #e5c614; border-color: #e5c614; color: #2c2c2a; }
    #${w} .amd-filter-btn .amd-filter-badge {
      background: #2c2c2a; color: #fff; border-radius: 999px;
      font-size: 11px; font-weight: 700; padding: 0 5px; min-width: 16px; text-align: center;
    }
    #${w} .amd-filter-btn.active .amd-filter-badge { background: rgba(0,0,0,.25); color: #fff; }
    #${w} .amd-filter-arrow { font-size: 10px; opacity: .6; }
    /* ── active type chips (inline, removable) ──────────────────── */
    #${w} .amd-active-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    #${w} .amd-active-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 9px; border: 1px solid #e5c614; border-radius: 999px;
      background: #fffae6; color: #2c2c2a; font-size: 12px; font-weight: 500;
      white-space: nowrap; cursor: pointer;
      transition: background .1s;
    }
    #${w} .amd-active-chip:hover { background: #fef0b0; }
    #${w} .amd-active-chip .amd-chip-x { opacity: .5; font-size: 11px; margin-left: 1px; }
    /* ── counter + secondary buttons ───────────────────────────── */
    #${w} .amd-visible-count {
      margin-left: auto; font-size: 12px; color: #5f6368; font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    #${w} .amd-visible-count.amd-filtered { color: #2c2c2a; font-weight: 600; }
    #${w} .amd-clear {
      background: none; border: none; color: #5f6368;
      cursor: pointer; font-size: 13px; font-weight: 500; padding: 6px 4px;
    }
    #${w} .amd-clear:hover { color: #c5221f; text-decoration: underline; }
    #${w} .amd-builtin-toggle {
      background: #fff; border: 1px solid rgba(0,0,0,.14); border-radius: 9px;
      padding: 6px 12px; color: #3c4043; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background .12s, border-color .12s;
    }
    #${w} .amd-builtin-toggle:hover { background: #faf6da; border-color: #e5c614; }
    /* ── dropdown panel ─────────────────────────────────────────── */
    #${w} .amd-dropdown {
      position: absolute; top: calc(100% + 2px); left: 14px;
      width: 360px; background: #fff; border: 1px solid rgba(0,0,0,.15);
      border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.13);
      z-index: 9000; overflow: hidden;
      display: none;
    }
    #${w} .amd-dropdown.open { display: block; }
    .amd-dropdown-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px; border-bottom: 1px solid rgba(0,0,0,.07);
      font-weight: 600; font-size: 12px; color: #5f6368; text-transform: uppercase; letter-spacing: .06em;
    }
    .amd-dropdown-close {
      background: none; border: none; cursor: pointer; color: #5f6368;
      font-size: 16px; line-height: 1; padding: 0 2px;
    }
    .amd-dropdown-close:hover { color: #2c2c2a; }
    .amd-dropdown-search {
      width: 100%; padding: 8px 12px; border: none; border-bottom: 1px solid rgba(0,0,0,.07);
      font-size: 13px; outline: none; box-sizing: border-box;
    }
    .amd-dropdown-search:focus { background: #fffdf0; }
    .amd-dropdown-types {
      max-height: 220px; overflow-y: auto;
      padding: 4px 0;
    }
    .amd-dropdown-check {
      display: flex; align-items: center; gap: 9px;
      padding: 6px 12px; cursor: pointer; font-size: 13px; color: #3c4043;
      transition: background .1s;
    }
    .amd-dropdown-check:hover { background: #f8f9fa; }
    .amd-dropdown-check input[type="checkbox"] {
      width: 14px; height: 14px; accent-color: #e5c614; cursor: pointer; flex-shrink: 0;
    }
    .amd-dropdown-check .amd-dc-name { flex: 1; }
    .amd-dropdown-check .amd-dc-count { font-size: 12px; color: #5f6368; }
    .amd-dropdown-sep { border: none; border-top: 1px solid rgba(0,0,0,.07); margin: 4px 0; }
    .amd-dropdown-section-label {
      padding: 6px 12px 3px; font-size: 11px; font-weight: 600;
      color: #5f6368; text-transform: uppercase; letter-spacing: .06em;
    }
    .amd-dropdown-radio {
      display: flex; gap: 6px; padding: 5px 12px 8px;
    }
    .amd-dropdown-radio label {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 13px; color: #3c4043; cursor: pointer; padding: 4px 8px;
      border: 1px solid rgba(0,0,0,.14); border-radius: 9px; background: #fff;
      transition: background .1s, border-color .1s;
    }
    .amd-dropdown-radio label:hover { background: #faf6da; border-color: #e5c614; }
    .amd-dropdown-radio input[type="radio"] { accent-color: #e5c614; cursor: pointer; }
    .amd-dropdown-radio label:has(input:checked) { background: #e5c614; border-color: #e5c614; font-weight: 600; }
    .amd-dropdown-footer {
      padding: 8px 12px; border-top: 1px solid rgba(0,0,0,.07); text-align: right;
    }
    .amd-dropdown-reset {
      background: none; border: none; color: #5f6368; cursor: pointer;
      font-size: 13px; font-weight: 500; padding: 4px 6px;
    }
    .amd-dropdown-reset:hover { color: #c5221f; text-decoration: underline; }
  `,document.head.appendChild(t);const e=document.createElement("style");e.id="andromeda-row-style",e.textContent=`
    :root {
      --amd-copy-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'/%3E%3Cpath d='M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2'/%3E%3C/svg%3E");
      --amd-pause-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Crect x='6' y='4' width='4' height='16' rx='1'/%3E%3Crect x='14' y='4' width='4' height='16' rx='1'/%3E%3C/svg%3E");
      --amd-resume-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E");
    }
    .amd-icon-group {
      display: inline-flex !important; position: relative !important;
      align-items: center !important; gap: 2px !important;
      vertical-align: middle !important; flex-shrink: 0 !important;
      margin-left: 6px !important;
    }
    .amd-copy-element {
      appearance: none; border: none; padding: 0; outline: none;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; vertical-align: middle;
      width: 30px; height: 30px; border-radius: 8px;
      background: transparent; opacity: .25; transition: background .12s, opacity .12s;
    }
    /* show on row hover */
    [gtm-table-row]:hover .amd-copy-element,
    tr:hover .amd-copy-element { opacity: 1; }
    .amd-copy-element::before {
      content: ''; width: 17px; height: 17px; display: block;
      background-color: #5f6368; transition: background-color .12s;
      -webkit-mask: var(--amd-copy-mask) center / contain no-repeat;
      mask: var(--amd-copy-mask) center / contain no-repeat;
    }
    .amd-copy-element:hover { background: #faf6da; opacity: 1; }
    .amd-copy-element:hover::before { background-color: #2c2c2a; }
    .amd-copy-element.amd-copy-ok { background: #e6f4ea !important; opacity: 1; transition: none; }
    .amd-copy-element.amd-copy-ok::before { background-color: #137333 !important; }
    .amd-copy-element.amd-copy-err { background: #fce8e6 !important; opacity: 1; transition: none; }
    .amd-copy-element.amd-copy-err::before { background-color: #c5221f !important; }
    .amd-pause-element {
      appearance: none; border: none; padding: 0; outline: none;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; vertical-align: middle;
      width: 30px; height: 30px; border-radius: 8px;
      background: transparent; opacity: 0; transition: background .12s, opacity .12s;
    }
    /* show on row hover when not paused */
    [gtm-table-row]:hover .amd-pause-element,
    tr:hover .amd-pause-element { opacity: 1; }
    .amd-pause-element::before {
      content: ''; width: 17px; height: 17px; display: block;
      background-color: #5f6368; transition: background-color .12s;
      -webkit-mask: var(--amd-pause-mask) center / contain no-repeat;
      mask: var(--amd-pause-mask) center / contain no-repeat;
    }
    .amd-pause-element:hover { background: #faf6da; opacity: 1; }
    .amd-pause-element:hover::before { background-color: #2c2c2a; }
    /* paused state: always visible, play icon to indicate "click to resume" */
    .amd-pause-element.amd-pause-on { opacity: 1; background: #fef3e0; }
    .amd-pause-element.amd-pause-on::before {
      width: 13px; height: 13px;
      background-color: #f29900;
      -webkit-mask: var(--amd-resume-mask) center / contain no-repeat;
      mask: var(--amd-resume-mask) center / contain no-repeat;
    }
    .amd-pause-element.amd-pause-on:hover { background: #fde8a0; }
    .amd-pause-element.amd-pause-on:hover::before { background-color: #c67a00; }
    .amd-pause-element.amd-pause-ok { background: #e6f4ea !important; opacity: 1; transition: none; }
    .amd-pause-element.amd-pause-ok::before { background-color: #137333 !important; }
    .amd-pause-element.amd-pause-err { background: #fce8e6 !important; opacity: 1; transition: none; }
    .amd-pause-element.amd-pause-err::before { background-color: #c5221f !important; }
    .amd-type-icon {
      width: 20px; height: 20px; object-fit: contain; vertical-align: middle;
      margin-right: 9px; border-radius: 4px; flex-shrink: 0;
    }
    .amd-type-initial {
      display: inline-block; text-align: center; line-height: 20px;
      width: 20px; height: 20px; border-radius: 4px; background: #e5c614; color: #2c2c2a;
      font-size: 11px; font-weight: 700; font-family: system-ui, sans-serif;
      vertical-align: middle; margin-right: 9px;
      background-size: contain; background-repeat: no-repeat; background-position: center;
    }
    .amd-type-initial.amd-has-img { background-color: transparent; }
    .amd-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-modal {
      background: #fff; border-radius: 14px; width: 460px; max-width: 92vw;
      max-height: 80vh; display: flex; flex-direction: column; padding: 20px;
      box-shadow: 0 12px 40px rgba(0,0,0,.28);
    }
    .amd-modal-head { display: flex; justify-content: space-between; align-items: center; }
    .amd-modal-close { border: none; background: none; font-size: 24px; cursor: pointer; line-height: 1; color: #5f6368; border-radius: 8px; width: 32px; height: 32px; }
    .amd-modal-close:hover { background: #f1f3f4; }
    .amd-modal-help { color: #5f6368; margin: 8px 0 14px; font-size: 13px; }
    .amd-modal-rows { overflow-y: auto; display: flex; flex-direction: column; gap: 9px; }
    .amd-modal-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 10px; }
    .amd-modal-row code { background: #f1f3f4; padding: 4px 7px; border-radius: 6px; font-size: 12px; overflow-wrap: anywhere; }
    .amd-modal-row input { padding: 7px 10px; border: 1px solid rgba(0,0,0,.16); border-radius: 8px; font-size: 13px; outline: none; transition: border-color .12s, box-shadow .12s; }
    .amd-modal-row input:focus { border-color: #e5c614; box-shadow: 0 0 0 3px rgba(229,198,20,.25); }
    .amd-modal-actions { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
    .amd-modal-save { padding: 8px 18px; background: #e5c614; color: #2c2c2a; font-weight: 600; border: none; border-radius: 9px; cursor: pointer; font-size: 13px; }
    .amd-modal-save:hover { filter: brightness(.96); }
    .amd-modal-msg { color: #137333; font-size: 13px; }`,document.head.appendChild(e);const n=document.createElement("style");n.id="amd-extra-style",n.textContent=`
    /* ── Bulk rename inputs ─────────────────────── */
    .amd-rename-input {
      display: block; width: calc(100% - 8px); margin: 1px 0;
      padding: 3px 7px; border: 1px solid #e5c614; border-radius: 5px;
      font: inherit; outline: none; box-sizing: border-box;
    }
    .amd-rename-input:focus { border-color: #c9ad07; box-shadow: 0 0 0 2px rgba(229,198,20,.25); }
    #${w} .amd-rename-active {
      background: #e5c614; border-color: #c9ad07; color: #2c2c2a; font-weight: 600;
    }
    /* ── Lookup/RegEx table copy-paste ──────────── */
    #amd-table-actions { display: flex; gap: 8px; padding: 6px 0 10px; }
    #amd-table-actions button {
      padding: 5px 12px; border: 1px solid rgba(0,0,0,.14); border-radius: 8px;
      background: #fff; color: #3c4043; font-size: 13px; cursor: pointer;
      transition: background .12s, border-color .12s;
    }
    #amd-table-actions button:hover { background: #faf6da; border-color: #e5c614; }
    /* ── Toast ──────────────────────────────────── */
    .amd-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #2c2c2a; color: #fff; padding: 8px 20px; border-radius: 8px;
      font: 13px/1.4 system-ui, sans-serif; z-index: 99999; pointer-events: none;
    }
    /* ── Paste confirm modal ────────────────────── */
    .amd-table-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.38); z-index: 99998;
      display: flex; align-items: center; justify-content: center;
    }
    .amd-table-modal {
      background: #fff; border-radius: 12px; padding: 24px; max-width: 380px; width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,.22);
      font: 14px/1.5 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-table-modal h3 { margin: 0 0 8px; font-size: 16px; color: #202124; }
    .amd-table-modal p  { margin: 0 0 20px; color: #5f6368; font-size: 13px; }
    .amd-table-modal-btns { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .amd-table-modal-btns button {
      padding: 7px 16px; border-radius: 8px; cursor: pointer;
      font: 13px/1 inherit; border: 1px solid transparent;
    }
    .amd-btn-cancel  { background: #f1f3f4; border-color: #dadce0 !important; color: #3c4043; }
    .amd-btn-append  { background: #fff; border-color: #dadce0 !important; color: #1967d2; font-weight: 500; }
    .amd-btn-replace { background: #e5c614; border-color: #e5c614 !important; color: #2c2c2a; font-weight: 600; }
    .amd-table-modal-btns button:hover { filter: brightness(.95); }
  `,document.head.appendChild(n)}function Oe(){return document.querySelector('.gtm-container-page-content [data-gtm-cloak="variable-list"] > .card.card--table')??document.querySelector(".gtm-container-page-content .card.card--table")}function pe(t){const{show:e,hide:n}=_e(t,S);for(const o of e)o.node.classList.remove(W);for(const o of n)o.node.classList.add(W);R(t)}function R(t){const e=document.getElementById("amd-visible-count");if(!e)return;const n=t.length,o=t.filter(r=>r.node.offsetParent!==null).length;o===n?(e.textContent=`${n} element${n===1?"o":"i"}`,e.classList.remove("amd-filtered")):(e.textContent=`${o} di ${n} visibili`,e.classList.add("amd-filtered"))}function je(t){if(v!=="")for(const e of t){const n=(e.node.matches("tr")?e.node:e.node.querySelector("tr"))??e.node,o=n.querySelector(":scope > td:nth-child(2)")??n.querySelector("td:nth-child(2)")??n.querySelector("td");if(!o)continue;const r=o.querySelector("a")??o.querySelector(".fill-cell")??o,a=r.querySelector(".amd-type-icon");if(a){if(a.classList.contains("amd-has-img")||a.dataset.amdDisplay===e.displayName)continue;a.remove()}const i=Qe(e);i.dataset.amdDisplay=e.displayName,r.insertBefore(i,r.firstChild);const c=Fe(e);if(c){const l=new Image;l.onload=()=>{i.isConnected&&(i.style.backgroundImage=`url("${c}")`,i.classList.add("amd-has-img"),i.textContent="")},l.src=c}}}const Me=new Set(["1","2","3","4","6","7","8","9","10","12","30","31","32","33"]),Pe=new Set(["0","1","2","3","4","aev","c","cid","ctv","d","dbg","e","ev","f","gas","j","jsm","k","r","remm","smm","u","uv","v","vis"]),De=new Set([]);function Fe(t){return v==="TAGS"&&t.brandThumbnailUrl?t.brandThumbnailUrl:P?v==="TRIGGERS"&&t.rawType&&Me.has(t.rawType)?`${P}trigger/${t.rawType}.png`:v==="VARIABLES"&&t.publicId&&Pe.has(t.publicId)?`${P}variable/${t.publicId}.png`:v==="CLIENTS"&&t.rawType&&De.has(t.rawType)?`${P}client/${t.rawType}.png`:"":""}const Ge={TAGS:"T",TRIGGERS:"T",VARIABLES:"V",CLIENTS:"C"};function Qe(t){const e=document.createElement("span");e.className="amd-type-icon amd-type-initial";const n=(t.displayName||"?").trim().charAt(0).toUpperCase();return e.textContent=/^\d/.test(n)?Ge[v]??"?":n,e.title=t.displayName,e}function Ke(t){if(v!=="")for(const e of t){const n=(e.node.matches("tr")?e.node:e.node.querySelector("tr"))??e.node,o=n.querySelector(":scope > td:last-child")??n.querySelector("td:last-child");if(!o||o.querySelector(".amd-copy-element"))continue;let r=o.querySelector(".amd-icon-group");r||(r=document.createElement("span"),r.className="amd-icon-group",o.appendChild(r));const a=document.createElement("button");a.className="amd-copy-element qol-row-not-clickable",a.title="Duplica",a.type="button",a.addEventListener("click",i=>{i.preventDefault(),i.stopPropagation(),we(v,a,c=>{a.classList.add(c?"amd-copy-ok":"amd-copy-err"),setTimeout(()=>a.classList.remove("amd-copy-ok","amd-copy-err"),1200)})},!0),r.appendChild(a)}}function He(t){if(v==="TAGS")for(const e of t){const n=(e.node.matches("tr")?e.node:e.node.querySelector("tr"))??e.node,o=n.querySelector(":scope > td:last-child")??n.querySelector("td:last-child");if(!o)continue;let r=o.querySelector(".amd-icon-group");r||(r=document.createElement("span"),r.className="amd-icon-group",o.appendChild(r));let a=r.querySelector(".amd-pause-element");a||(a=document.createElement("button"),a.className="amd-pause-element qol-row-not-clickable",a.type="button",a.addEventListener("click",l=>{l.preventDefault(),l.stopPropagation();const s=a.closest("[gtm-table-row]")??a.closest("tr");s&&Ee(s,h=>{a.classList.add(h?"amd-pause-ok":"amd-pause-err"),setTimeout(()=>a.classList.remove("amd-pause-ok","amd-pause-err"),1200)})},!0),r.appendChild(a));const i=e.paused===!0;a.classList.toggle("amd-pause-on",i),a.title=i?"Riprendi":"Metti in pausa";const c=o.querySelector(".pause-circle-filled-icon");c&&(c.style.display=i?"none":"")}}function ee(t){const e=Oe();if(!e)return;let n=document.getElementById(w);(!n||!n.isConnected)&&(n=document.createElement("div"),n.id=w,e.insertAdjacentElement("beforebegin",n)),n.replaceChildren();let o=[];try{o=Ne(t)}catch{}v!==""&&S.selectedTypes.size===0&&S.pauseFilter==="all"&&$e(v,new Set(o.map(u=>u.type)));const r=()=>{Ie(),pe($(v)),g()},a=document.createElement("div");a.className="amd-dropdown";const i=document.createElement("div");i.className="amd-dropdown-head",i.textContent="Filtri";const c=document.createElement("button");c.type="button",c.className="amd-dropdown-close",c.textContent="×",c.addEventListener("click",()=>a.classList.remove("open")),i.appendChild(c),a.appendChild(i);const l=document.createElement("input");l.type="search",l.className="amd-dropdown-search",l.placeholder="Cerca tipo…",a.appendChild(l);const s=document.createElement("div");s.className="amd-dropdown-types",a.appendChild(s);const h=(u="")=>{s.replaceChildren();const f=u.trim().toLowerCase(),b=f?o.filter(x=>x.displayName.toLowerCase().includes(f)):o;for(const x of b){const L=document.createElement("label");L.className="amd-dropdown-check";const k=document.createElement("input");k.type="checkbox",k.checked=S.selectedTypes.has(x.type),k.addEventListener("change",()=>{k.checked?S.selectedTypes.add(x.type):S.selectedTypes.delete(x.type),r()});const E=document.createElement("span");E.className="amd-dc-name",E.textContent=x.displayName;const C=document.createElement("span");C.className="amd-dc-count",C.textContent=`${x.count}`,L.append(k,E,C),s.appendChild(L)}if(!b.length){const x=document.createElement("div");x.style.cssText="padding:10px 12px; color:#5f6368; font-size:13px;",x.textContent="Nessun tipo trovato",s.appendChild(x)}};if(l.addEventListener("input",()=>h(l.value)),h(),v==="TAGS"){const u=document.createElement("hr");u.className="amd-dropdown-sep",a.appendChild(u);const f=document.createElement("div");f.className="amd-dropdown-section-label",f.textContent="Stato",a.appendChild(f);const b=document.createElement("div");b.className="amd-dropdown-radio";const x=[["all","Tutti"],["active","Solo attivi"],["paused","Solo in pausa"]];for(const[L,k]of x){const E=document.createElement("label"),C=document.createElement("input");C.type="radio",C.name="amd-pause-filter",C.value=L,C.checked=S.pauseFilter===L,C.addEventListener("change",()=>{C.checked&&(S.pauseFilter=L,r(),b.querySelectorAll('input[type="radio"]').forEach(y=>{var A;(A=y.closest("label"))==null||A.classList.toggle("checked",y.checked)}))}),E.append(C,k),b.appendChild(E)}a.appendChild(b)}const m=document.createElement("div");m.className="amd-dropdown-footer";const p=document.createElement("button");p.type="button",p.className="amd-dropdown-reset",p.textContent="Azzera tutti i filtri",p.addEventListener("click",()=>{S=G(),a.classList.remove("open"),r(),h(l.value)}),m.appendChild(p),a.appendChild(m);const g=()=>{n.replaceChildren();const u=S.selectedTypes.size+(S.pauseFilter!=="all"?1:0),f=document.createElement("button");f.type="button",f.className="amd-filter-btn"+(u>0?" active":"");const b=document.createElementNS("http://www.w3.org/2000/svg","svg");b.setAttribute("viewBox","0 0 16 16"),b.setAttribute("width","14"),b.setAttribute("height","14"),b.setAttribute("fill","currentColor");const x=document.createElementNS("http://www.w3.org/2000/svg","path");x.setAttribute("d","M1 1.5A.5.5 0 0 1 1.5 1h13a.5.5 0 0 1 .4.8L9.5 9.3V14a.5.5 0 0 1-.7.5l-3-1.5A.5.5 0 0 1 5.5 12.5V9.3L1.1 2.3A.5.5 0 0 1 1 1.5z"),b.appendChild(x),f.appendChild(b);const L=document.createTextNode(" Filtri");if(f.appendChild(L),u>0){const y=document.createElement("span");y.className="amd-filter-badge",y.textContent=String(u),f.appendChild(y)}const k=document.createElement("span");if(k.className="amd-filter-arrow",k.textContent="▾",f.appendChild(k),f.addEventListener("click",y=>{y.stopPropagation(),a.classList.toggle("open")&&(l.value="",h())}),n.appendChild(f),n.appendChild(a),S.selectedTypes.size>0){const y=document.createElement("div");y.className="amd-active-chips";for(const A of S.selectedTypes){const B=o.find(ge=>ge.type===A);if(!B)continue;const N=document.createElement("button");N.type="button",N.className="amd-active-chip",N.title=`Rimuovi filtro: ${B.displayName}`;const ne=document.createElement("span");ne.textContent=B.displayName;const J=document.createElement("span");J.className="amd-chip-x",J.textContent="×",N.append(ne,J),N.addEventListener("click",()=>{S.selectedTypes.delete(A),r()}),y.appendChild(N)}if(S.pauseFilter!=="all"){const A=document.createElement("button");A.type="button",A.className="amd-active-chip";const B=document.createElement("span");B.textContent=S.pauseFilter==="paused"?"Solo in pausa":"Solo attivi";const N=document.createElement("span");N.className="amd-chip-x",N.textContent="×",A.append(B,N),A.addEventListener("click",()=>{S.pauseFilter="all",r()}),y.appendChild(A)}n.appendChild(y)}const E=document.createElement("span");if(E.id="amd-visible-count",E.className="amd-visible-count",n.appendChild(E),u>0){const y=document.createElement("button");y.type="button",y.className="amd-clear",y.textContent="Azzera",y.addEventListener("click",()=>{S=G(),a.classList.remove("open"),r()}),n.appendChild(y)}const C=document.createElement("button");if(C.type="button",C.id="amd-rename-btn",C.className="amd-builtin-toggle"+(_?" amd-rename-active":""),C.textContent=_?"Salva nomi":"Rinomina…",C.addEventListener("click",()=>{_?ue():Xe()}),n.appendChild(C),_){const y=document.createElement("button");y.type="button",y.id="amd-rename-cancel",y.className="amd-builtin-toggle",y.textContent="Annulla",y.addEventListener("click",()=>O()),n.appendChild(y)}if(v==="VARIABLES"&&ve()){const y=document.createElement("button");y.type="button",y.className="amd-builtin-toggle";const A=()=>{y.textContent=V?"Mostra variabili integrate":"Nascondi variabili integrate"};A(),Y(V),y.addEventListener("click",()=>{V=!V,Y(V),A()}),n.appendChild(y)}if(v==="VARIABLES"){const y=document.createElement("button");y.type="button",y.className="amd-builtin-toggle",y.textContent="Etichette tipi…",y.addEventListener("click",()=>Je()),n.appendChild(y)}R($(v))};g(),window.__amdDropdownBound||(window.__amdDropdownBound=!0,document.addEventListener("click",u=>{var b;const f=document.querySelector(`#${w} .amd-dropdown.open`);f&&!((b=f.closest(`#${w}`))!=null&&b.contains(u.target))&&f.classList.remove("open")},!0));const d=re();d&&!d.dataset.amdBound&&(d.dataset.amdBound="1",d.addEventListener("input",()=>{requestAnimationFrame(()=>R($(v)))})),window.__amdSlashBound||(window.__amdSlashBound=!0,document.addEventListener("keydown",u=>{if(u.key!=="/"||u.metaKey||u.ctrlKey||u.altKey)return;const f=u.target;if(f&&(f.tagName==="INPUT"||f.tagName==="TEXTAREA"||f.isContentEditable||f.closest("input, textarea, [contenteditable]")))return;const b=re();b&&(u.preventDefault(),u.stopPropagation(),b.focus())},!0))}function re(){const t=document.querySelector(".gtm-container-page-content")??document;return t.querySelector('input[type="search"]')??t.querySelector('input[aria-label*="erca"]')??t.querySelector('input[placeholder*="erca"]')??t.querySelector('input[aria-label*="earch"]')??t.querySelector('input[placeholder*="earch"]')}function Je(){var c;(c=document.getElementById("amd-label-editor"))==null||c.remove();const t=document.createElement("div");t.id="amd-label-editor",t.className="amd-modal-overlay";const e=document.createElement("div");e.className="amd-modal",e.innerHTML=`
    <div class="amd-modal-head">
      <strong>Etichette tipi di variabili</strong>
      <button type="button" class="amd-modal-close" title="Chiudi">×</button>
    </div>
    <p class="amd-modal-help">Assegna un nome leggibile a ciascun codice tipo. Lascia vuoto per usare il predefinito.</p>
    <div class="amd-modal-rows"></div>
    <div class="amd-modal-actions">
      <button type="button" class="amd-modal-save">Salva</button>
      <span class="amd-modal-msg"></span>
    </div>`,t.appendChild(e),document.body.appendChild(t);const n=e.querySelector(".amd-modal-rows"),o=$("VARIABLES"),r=new Map;for(const l of o)r.has(l.code)||r.set(l.code,l.displayName);for(const l of Object.keys(I))r.has(l)||r.set(l,I[l]);const a=new Map;for(const[l,s]of r){const h=document.createElement("label");h.className="amd-modal-row";const m=document.createElement("code");m.textContent=l;const p=document.createElement("input");p.type="text",p.placeholder=s||"(predefinito)",p.value=I[l]??"",a.set(l,p),h.append(m,p),n.appendChild(h)}const i=()=>t.remove();e.querySelector(".amd-modal-close").addEventListener("click",i),t.addEventListener("click",l=>{l.target===t&&i()}),e.querySelector(".amd-modal-save").addEventListener("click",()=>{const l={...I};for(const[h,m]of a){const p=m.value.trim();p?l[h]=p:delete l[h]}Ve(l);const s=e.querySelector(".amd-modal-msg");s.textContent="Salvato ✓",setTimeout(i,600)})}function Ue(){if(window.__amdBulkBound)return;window.__amdBulkBound=!0;let t=null,e=null;const n="gtm-table-row-checkbox",o="gtm-table-row-checkbox i",r="[gtm-table-row]";function a(c){const l=c.querySelector(o);if(l)return l.getAttribute("aria-checked")==="true";const s=c.querySelector(`${n} input[type="checkbox"]`);return s?s.checked:!1}function i(c){const l=c.querySelector(o);if(l){l.click();return}const s=c.querySelector(n);s&&s.click()}document.addEventListener("click",c=>{if(c.__amdBulk)return;const s=c.target.closest(n);if(!s)return;const h=s.closest(r);if(!h)return;const m=h.closest("table");if(!m)return;if(!c.shiftKey||!t||t.closest("table")!==m){requestAnimationFrame(()=>{e=a(h)}),t=h;return}c.preventDefault(),c.stopPropagation();const p=Array.from(m.querySelectorAll(r)),g=p.indexOf(h),d=p.indexOf(t);if(g<0||d<0)return;const u=e??!0,f=Math.min(d,g),b=Math.max(d,g),x=L=>{const k=Math.min(L+25,b);for(let E=L;E<=k;E++)a(p[E])!==u&&i(p[E]);k<b&&requestAnimationFrame(()=>x(k+1))};x(f),t=h,e=u},!0)}function te(t=!1){var r;const e=Te();if(e===""){(r=document.getElementById(w))==null||r.remove(),v="";return}e!==v&&(v=e,S=G(),_=!1,t=!0);const n=$(e),o=document.getElementById(w);n.length!==0&&((t||!o||!o.isConnected)&&(ze(),ee(n)),e==="VARIABLES"&&V&&Y(!0),pe(n),je(n),Ke(n),He(n),Ue(),Ze())}function Xe(){if(v!==""){_=!0,ee($(v));for(const t of document.querySelectorAll("[gtm-table-row]")){if(t.querySelector(".amd-rename-input"))continue;const e=t.querySelector("td:nth-child(2)");if(!e)continue;const n=e.querySelector("a");if(!n)continue;const o=n.cloneNode(!0);o.querySelectorAll(".amd-type-icon, .amd-type-initial").forEach(i=>i.remove());const r=(o.textContent??"").trim(),a=document.createElement("input");a.type="text",a.className="amd-rename-input",a.value=r,a.dataset.amdOrig=r,a.addEventListener("keydown",i=>{i.key==="Enter"&&(i.preventDefault(),ue()),i.key==="Escape"&&O()}),n.style.display="none",n.insertAdjacentElement("afterend",a)}}}function O(){_=!1;for(const t of document.querySelectorAll(".amd-rename-input")){const e=t.previousElementSibling;(e==null?void 0:e.tagName)==="A"&&(e.style.display=""),t.remove()}ee($(v))}function ue(){if(v==="")return;const t=v,e=Array.from(document.querySelectorAll(".amd-rename-input")).map(c=>({input:c,rowEl:c.closest("[gtm-table-row]"),newName:c.value.trim(),origName:c.dataset.amdOrig??""})).filter(({rowEl:c,newName:l,origName:s})=>!!c&&!!l&&l!==s);if(e.length===0){O();return}const n=document.getElementById("amd-rename-btn");n&&(n.textContent=`Rinominando 0/${e.length}…`,n.disabled=!0);const o=document.getElementById("amd-rename-cancel");o&&(o.disabled=!0);let r=0,a=0;const i=c=>{c?r++:a++;const l=r+a;n&&(n.textContent=`Rinominando ${l}/${e.length}…`),!(l<e.length)&&(a>0?(n&&(n.textContent=`${a} error${a>1?"i":"e"} su ${e.length}`,n.disabled=!1,n.style.color="#c5221f"),setTimeout(()=>O(),2500)):O())};e.forEach(({rowEl:c,newName:l},s)=>{setTimeout(()=>{c?Ce(t,c,l,i):i(!1)},s*1200)})}function j(){return document.querySelector('[data-ng-click="ctrl.addRow()"]')}function ie(t,e=6){let n=t;for(let o=0;o<e&&n;o++){try{const r=n.ctrl??n.$ctrl;if(r&&typeof r=="object"){const a=r.instance,i=a==null?void 0:a.paramMap,c=i==null?void 0:i.map,l=c==null?void 0:c.value,s=l==null?void 0:l.listItem;if(Array.isArray(s))return s}}catch{}n=n.$parent}return null}function Ye(){const t=document.querySelectorAll(".simple-table-row"),e=t[t.length-1];if(!e)return;const n=e.querySelector('[data-ng-click*="deleteRow"]')??e.querySelector("button:last-child");n==null||n.click()}function We(){let t=200;for(;t-- >0;){const e=document.querySelectorAll(".simple-table-row");if(e.length===0)break;const n=e[e.length-1],o=n.querySelector('[data-ng-click*="deleteRow"]')??n.querySelector("button:last-child");if(!o)break;o.click()}}function ce(t){var n,o;const e=j();if(e){for(const[r,a]of t){e.click();const i=fe();if(!i||i.length===0)break;const c=i[i.length-1];((n=c==null?void 0:c.mapValue)==null?void 0:n[0])!=null&&(c.mapValue[0].string=r),((o=c==null?void 0:c.mapValue)==null?void 0:o[1])!=null&&(c.mapValue[1].string=a)}e.click(),Ye()}}function Re(){var e;const t=j();return t?[t,t.parentElement,t.closest(".blg-form-input"),((e=t.closest(".simple-table"))==null?void 0:e.parentElement)??null,t.closest("[data-ng-controller]"),document.querySelector(".gtm-veditor-section"),document.querySelector("[data-ng-form]"),document.querySelector(".blg-sheet-content")].filter(n=>n!=null):[]}function fe(){if(!window.angular)return null;for(const t of Re())try{const e=window.angular.element(t).scope(),n=ie(e);if(n)return n}catch{}try{let t=function(i,c){if(!i||c>80)return;const l=ie(i,1);l&&o.push(l),t(i.$$childHead,c+1),t(i.$$nextSibling,c)};const e=window.angular.element(document.body).injector();if(!e)return null;const n=e.get("$rootScope");if(!n)return null;const o=[];if(t(n.$$childHead,0),o.length===0)return null;if(o.length===1)return o[0];const r=document.querySelectorAll(".simple-table-row").length,a=o.filter(i=>i.length===r);return a.length===1?a[0]:o[o.length-1]}catch{return null}}function Ze(){var a;const t=j();if(!t){(a=document.getElementById("amd-table-actions"))==null||a.remove();return}if(document.getElementById("amd-table-actions"))return;const e=document.createElement("div");e.id="amd-table-actions";const n=document.createElement("button");n.type="button",n.textContent="Copia tabella",n.title="Copia tutte le righe (Ctrl+C)",n.addEventListener("click",()=>le());const o=document.createElement("button");o.type="button",o.textContent="Incolla",o.title="Incolla righe (Ctrl+V)",o.addEventListener("click",()=>{navigator.clipboard.readText().then(i=>D(i)).catch(()=>D(""))}),e.append(n,o);const r=t.closest(".blg-form-input")??t.closest("[diff-field]")??t.parentElement;r?r.insertAdjacentElement("beforebegin",e):t.insertAdjacentElement("beforebegin",e),window.__amdTableKbBound||(window.__amdTableKbBound=!0,document.addEventListener("keydown",i=>{if(!j())return;const c=i.target;c.tagName==="INPUT"||c.tagName==="TEXTAREA"||c.isContentEditable||((i.ctrlKey||i.metaKey)&&i.key==="c"?(i.preventDefault(),le()):(i.ctrlKey||i.metaKey)&&i.key==="v"&&(i.preventDefault(),navigator.clipboard.readText().then(l=>D(l)).catch(()=>D(""))))},!0))}function le(){const t=fe();if(!t){q("Tabella non trovata");return}F=JSON.parse(JSON.stringify(t)),q(`${t.length} rig${t.length===1?"a":"he"} copiata`)}function D(t){const e=F.length>0,n=t.trim()!=="";if(!e&&!n){q("Nessun dato da incollare");return}if(!j()){q("Editor tabella non trovato");return}const o=document.querySelectorAll(".simple-table-row").length,r=a=>{if(a==="replace"&&We(),e){const i=JSON.parse(JSON.stringify(F));F=[],ce(i.map(c=>{var l,s;return[((l=c.mapValue[0])==null?void 0:l.string)??"",((s=c.mapValue[1])==null?void 0:s.string)??""]})),q(`${i.length} rig${i.length===1?"a":"he"} incollata`)}else{const i=[];for(const c of t.split(`
`)){const[l,s=""]=c.split("	"),h=l.trim();h&&i.push([h,s.trim()])}ce(i),q(`${i.length} rig${i.length===1?"a":"he"} incollata`)}};o>0?et().then(a=>{if(a==="cancel"){q("Operazione annullata");return}r(a)}):r("append")}function et(){return new Promise(t=>{const e=document.createElement("div");e.className="amd-table-modal-overlay";const n=document.createElement("div");n.className="amd-table-modal";const o=document.createElement("h3");o.textContent="Righe esistenti";const r=document.createElement("p");r.textContent="La tabella contiene già delle righe. Vuoi sostituirle o aggiungere le nuove in fondo?";const a=document.createElement("div");a.className="amd-table-modal-btns";const i=document.createElement("button");i.className="amd-btn-cancel",i.textContent="Annulla";const c=document.createElement("button");c.className="amd-btn-append",c.textContent="Aggiungi in fondo";const l=document.createElement("button");l.className="amd-btn-replace",l.textContent="Sostituisci tutto",a.append(i,c,l),n.append(o,r,a),e.appendChild(n),document.body.appendChild(e);const s=h=>{e.remove(),t(h)};i.addEventListener("click",()=>s("cancel")),c.addEventListener("click",()=>s("append")),l.addEventListener("click",()=>s("replace")),e.addEventListener("click",h=>{h.target===e&&s("cancel")})})}function q(t){var n;(n=document.querySelector(".amd-toast"))==null||n.remove();const e=document.createElement("div");e.className="amd-toast",e.textContent=t,document.body.appendChild(e),setTimeout(()=>e.remove(),2500)}let U=!1;const tt=new MutationObserver(t=>{t.every(n=>{var r;const o=n.target;return(r=o.closest)==null?void 0:r.call(o,`#${w}, #amd-label-editor, #andromeda-filters-style, #amd-table-actions, .amd-table-modal-overlay, .amd-toast`)})||U||(U=!0,requestAnimationFrame(()=>{U=!1,te()}))});tt.observe(document.body,{childList:!0,subtree:!0});te(!0);Be();window.QOL??(window.QOL={});
