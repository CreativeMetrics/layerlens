const F={TAGS:["tagService","serverTagService","sTagService"],TRIGGERS:["triggerService","serverTriggerService"],VARIABLES:["variableService","serverVariableService"],CLIENTS:["clientService","serverClientService","sClientService"]},Q={TAGS:"tag",TRIGGERS:"trigger",VARIABLES:"variable",CLIENTS:"client"},J={c:"Costante",jsm:"JavaScript personalizzato",j:"JavaScript",v:"Variabile livello dati",smm:"Tabella di ricerca",remm:"Tabella di ricerca regex",k:"Cookie primario",aev:"Variabile evento automatico",u:"Componente URL",f:"Referrer HTTP",d:"Elemento DOM",e:"Errore JavaScript",vis:"Visibilità elemento",dbg:"Modalità debug",r:"Numero casuale",ctv:"Versione contenitore",cid:"ID contenitore",gas:"Impostazioni Google Analytics",awec:"Dati forniti dall’utente",cl:"Classi clic",ce:"Elemento clic",cu:"URL clic",ct:"Testo clic",fct:"Variabile modulo",hl:"Frammento cronologia",uv:"Variabile non definita"};function oe(e){var n;const t=((n=window.__QOL_VARS__)==null?void 0:n.variableTypeLabels)??{};return t[e]?t[e]:J[e]?J[e]:e.startsWith("cvt_")?t.cvt_??"Modello personalizzato":e}const ae={gaaw_client:"GA4 Client",gtm_client:"GTM Client",node_client:"Node.js",preview_client:"Anteprima",flush_client:"Flush",pubsub_client:"Cloud Pub/Sub",sp_client:"Stape"};function re(e){return ae[e]??e}function $(){var e;try{return((e=window.angular)==null?void 0:e.element(document.body).injector())??null}catch{return null}}function D(e){const t=$();if(!t)return null;for(const n of F[e])try{const o=t.get(n);if(o&&(typeof o.getList=="function"||o.$$state!=null))return o}catch{}return console.debug(`[Andromeda] service not found for page=${e}. Tried: ${F[e].join(", ")}. Use window.angular?.element(document.body).injector() in the console to enumerate available services.`),null}function ie(e){var t;try{return(t=window.angular)==null?void 0:t.element(e).scope()}catch{return}}function K(){var e,t,n;try{return((n=(t=(e=$())==null?void 0:e.get("appStateService"))==null?void 0:t.getContext)==null?void 0:n.call(t))??void 0}catch{return}}function T(e){const t=e.querySelector("td:nth-child(2)")??e,n=t.querySelector("a");if(!n)return(t.textContent??"").trim();const o=n.cloneNode(!0);return o.querySelectorAll(".amd-type-icon, .amd-type-initial").forEach(a=>a.remove()),(o.textContent??"").trim()}function I(e){var t,n;try{const o=Q[e];let a=null;if(e==="VARIABLES"&&(a=document.querySelector('.gtm-container-page-content [data-gtm-cloak="variable-list"] > .card.card--table [gtm-table] table')??document.querySelector('.gtm-container-page-content [data-gtm-cloak="variable-list"] [gtm-table]:not([data-table-id="variable-list-built-in"]) table')),a=a??document.querySelector(".gtm-container-page-content [gtm-table]:last-of-type table")??document.querySelector(".gtm-container-page-content [gtm-table] table"),!a)return[];const r=Array.from(a.querySelectorAll("[gtm-table-row]"));if(r.length===0)return[];const y=D(e),p=((n=(t=y!=null&&y.getList?y.getList(K()):y)==null?void 0:t.$$state)==null?void 0:n.value)??[],i=new Map;p.forEach((d,m)=>{var c;const f=((c=d[o])==null?void 0:c.data)??d.data;(f==null?void 0:f.name)!=null&&i.set(String(f.name),f),i.set(`#${m}`,f)});const u=r.map((d,m)=>{var k,C,g,E;const f=T(d),c=i.get(f)??i.get(`#${m}`)??((C=(k=ie(d))==null?void 0:k[o])==null?void 0:C.data),s=(E=(g=c==null?void 0:c.vendorTemplate)==null?void 0:g.key)==null?void 0:E.publicId,l=String((c==null?void 0:c.typeDisplayName)??(e==="VARIABLES"?s??(c==null?void 0:c.type)??"":(c==null?void 0:c.type)??s??""));let b;(c==null?void 0:c.typeDisplayName)!=null?b=String(c.typeDisplayName):e==="VARIABLES"&&l?b=oe(l):e==="CLIENTS"&&l?b=re(l):b=l||"Sconosciuto";const h=b,L=c!=null&&l!=="";return{node:d,type:h,code:l,name:f||((c==null?void 0:c.name)==null?"":String(c.name)),displayName:b,resolved:L,brandThumbnailUrl:(c==null?void 0:c.brandThumbnailUrl)??"",rawType:(c==null?void 0:c.type)==null?"":String(c.type),publicId:s??"",paused:(c==null?void 0:c.paused)===!0}});return u.some(d=>d.resolved)?u.filter(d=>d.resolved).map(({resolved:d,...m})=>m):[]}catch{return[]}}function M(e){try{const t=document.querySelector('div[data-table-id="variable-list-built-in"]');if(!t)return!1;const n=t.querySelector(":scope > table");return e?(t.setAttribute("style","height: 56px !important; overflow: hidden !important;"),n&&(n.style.display="none")):(t.setAttribute("style",""),n&&(n.style.display="table")),!0}catch{return!1}}function ce(){return!!document.querySelector('div[data-table-id="variable-list-built-in"]')}function Z(e,t){if(t)try{let n=function(p){if(!p||typeof p!="object")return!1;const i=p,u=i.data;return typeof(u==null?void 0:u.name)=="string"&&u.name===t||typeof i.name=="string"&&i.name===t},o=function(p,i){if(!p||i>60)return;const u=p[y];if(u!=null&&n(u)){const d=u.key;if(d!=null)return d}const v=o(p.$$childHead,i+1);return v??o(p.$$nextSibling,i)};const a=$();if(!a)return;const r=a.get("$rootScope");if(!r)return;const y=Q[e];return o(r.$$childHead,0)}catch{return}}function de(e,t,n){var r,y,p,i;const o=t.closest("[gtm-table-row]")??t.closest("tr"),a=Q[e];try{if($()){const v=K(),d=D(e);if(d){let m;try{const f=document.querySelector(".gtm-container-page-content [gtm-table]:last-of-type table")??document.querySelector(".gtm-container-page-content [gtm-table] table"),c=f?(r=window.angular)==null?void 0:r.element(f).scope():void 0,s=c==null?void 0:c.tableCtrl,l=((y=s==null?void 0:s.getItems)==null?void 0:y.call(s))??(s==null?void 0:s.items)??(s==null?void 0:s.internalItems);if(l&&o){const h=(f?Array.from(f.querySelectorAll("[gtm-table-row]")):[]).indexOf(o);h>=0&&l[h]&&(m=l[h].key)}}catch{}if(!m&&o&&(m=Z(e,T(o)),m!=null&&console.debug(`[Andromeda QoL] copy: key resolved via $rootScope traversal for "${T(o)}"`)),!m){const f=o?T(o):"",c=((i=(p=d.getList(v))==null?void 0:p.$$state)==null?void 0:i.value)??[],s=b=>b[a]??b,l=f?c.find(b=>{var h;return((h=s(b).data)==null?void 0:h.name)===f}):void 0;m=l?s(l).key:void 0}if(m)return d.get(m).then(f=>{var b,h;const c=((h=(b=d.getList(v))==null?void 0:b.$$state)==null?void 0:h.value)??[],s=c.length>0?c.map(L=>{var k;return(k=(L[a]??L).data)==null?void 0:k.name}):Array.from(document.querySelectorAll(".gtm-container-page-content [gtm-table-row]")).map(T);let l=f.data.name;for(;s.indexOf(l)>=0;)l+=" - Copy";return f.data.name=l,d.create(v,{data:f.data})}).then(()=>n==null?void 0:n(!0)).catch(f=>{console.warn("[Andromeda QoL] copy: service error",f),n==null||n(!1)}),!0;console.debug(`[Andromeda QoL] copy: service found for page=${e} but could not resolve key for "${o?T(o):"?"}". Falling through to menu fallback.`)}else console.debug(`[Andromeda QoL] copy: no service found for page=${e}. Tried: ${F[e].join(", ")}.`)}else console.debug("[Andromeda QoL] copy: window.angular not available — skipping Angular service path.")}catch(u){console.warn("[Andromeda QoL] copy: Angular path exception",u)}return o&&se(o,n)?!0:(console.warn(`[Andromeda QoL] copy: could not duplicate "${o?T(o):"?"}" on page ${e}. Neither the Angular service path nor the native menu fallback succeeded. Open the browser console and check window.angular to diagnose.`),n==null||n(!1),!1)}const le=["copia","copy","duplica","duplicate","clone"];function se(e,t){try{let n=function(){const y=a[r++];if(y===0){if(Y()){t==null||t(!0);return}n()}else r<=a.length&&setTimeout(()=>{Y()?t==null||t(!0):r<a.length?n():(console.debug("[Andromeda QoL] clickCopyItem: no copy menu item found after all retries."),t==null||t(!1))},y)};const o=e.querySelector("[data-action-menu-toggle]")??e.querySelector('button[aria-label*="zioni"]')??e.querySelector('button[aria-label*="ction"]')??e.querySelector('button[aria-haspopup="menu"]')??e.querySelector('button[aria-haspopup="true"]')??e.querySelector(".icon-btn-more, .more-actions")??e.querySelector('[aria-label*="altro"]')??e.querySelector('[aria-label*="more"]')??e.querySelector('[aria-label*="option"]')??e.querySelector("button.mat-icon-button")??e.querySelector("button.mat-mdc-icon-button")??e.querySelector("td:last-child button");if(!o)return console.debug("[Andromeda QoL] copyViaActionMenu: no menu toggle found in row. Row HTML (first 300 chars):",e.outerHTML.slice(0,300)),!1;o.click();const a=[0,80,200,350];let r=0;return n(),!0}catch(n){return console.debug("[Andromeda QoL] copyViaActionMenu error",n),!1}}function Y(){try{const e=document.querySelector('[role="menu"]:not([hidden])')??document.querySelector(".mat-menu-panel:not([hidden])")??document.querySelector(".mat-mdc-menu-panel:not([hidden])")??document.querySelector('.cdk-overlay-container [role="menu"]')??document.querySelector(".dropdown-menu:not(.ng-hide)")??document.querySelector("[data-action-menu]");if(!e)return!1;const n=Array.from(e.querySelectorAll('[role="menuitem"], [role="option"], .mat-menu-item, .mat-mdc-menu-item, button, a')).find(o=>{const a=(o.textContent??"").trim().toLowerCase();return le.some(r=>a.includes(r))});return n?(n.click(),!0):!1}catch{return!1}}function pe(e,t){var n,o,a,r,y;try{if(!$())return console.debug("[Andromeda QoL] toggleTagPause: angular injector not available"),t==null||t(!1),!1;const i=D("TAGS");if(!i)return console.debug("[Andromeda QoL] toggleTagPause: tagService not found"),t==null||t(!1),!1;let u;try{const d=(n=window.angular)==null?void 0:n.element(e).scope(),m=(d==null?void 0:d.tag)??(d==null?void 0:d.tag);(m==null?void 0:m.key)!=null&&(u=m.key)}catch{}if(!u)try{const d=document.querySelector(".gtm-container-page-content [gtm-table]:last-of-type table")??document.querySelector(".gtm-container-page-content [gtm-table] table"),m=d?(o=window.angular)==null?void 0:o.element(d).scope():void 0,f=m==null?void 0:m.tableCtrl,c=((a=f==null?void 0:f.getItems)==null?void 0:a.call(f))??(f==null?void 0:f.items)??(f==null?void 0:f.internalItems);if(c){const l=(d?Array.from(d.querySelectorAll("[gtm-table-row]")):[]).indexOf(e);l>=0&&c[l]&&(u=c[l].key)}}catch{}if(u||(u=Z("TAGS",T(e))),!u){const d=T(e),m=K(),f=((y=(r=i.getList(m))==null?void 0:r.$$state)==null?void 0:y.value)??[],c=d?f.find(s=>{var b;return((b=(s.tag??s).data)==null?void 0:b.name)===d}):void 0;c&&(u=(c.tag??c).key??void 0)}if(!u)return console.debug("[Andromeda QoL] toggleTagPause: could not resolve key for",T(e)),t==null||t(!1),!1;const v=Object.assign({},u);return i.get(v).then(d=>(d.data.paused?delete d.data.paused:d.data.paused=!0,i.update(d))).then(()=>t==null?void 0:t(!0)).catch(d=>{console.warn("[Andromeda QoL] toggleTagPause: service error",d),t==null||t(!1)}),!0}catch(p){return console.warn("[Andromeda QoL] toggleTagPause error",p),t==null||t(!1),!1}}const ue={pageVariables:['[data-gtm-cloak="variable-list"]'],pageTags:['[data-gtm-cloak="tag-list-page"]'],pageTriggers:['[data-gtm-cloak-notifier] [data-table-id="trigger-list"]'],pageClients:['[data-gtm-cloak="client-list"]','[data-gtm-cloak="client-list-page"]','[data-gtm-cloak-notifier] [data-table-id="client-list"]','[data-table-id="client-list"]'],filterInput:['.card-title-bar [data-ng-model="ctrl.filter"]','[data-ng-model="ctrl.filter"]'],builtInVariableList:['div[data-table-id="variable-list-built-in"]'],debuggerHeader:[".debugger-header"],previewCard:[".preview-card.preview-card"],containerPublicId:["gtm-container-public-id"]};function me(e,t=document){for(const n of ue[e]){const o=t.querySelector(n);if(o)return o}return null}function B(e,t=document){return me(e,t)!=null}function fe(){return B("pageVariables")?"VARIABLES":B("pageTags")?"TAGS":B("pageTriggers")?"TRIGGERS":B("pageClients")?"CLIENTS":""}function z(){return{selectedTypes:new Set,query:"",pauseFilter:"all"}}function ge(e){const t=new Map;for(const n of e){const o=t.get(n.type)??{type:n.type,displayName:String(n.displayName??n.type),count:0};o.count+=1,t.set(n.type,o)}return[...t.values()].sort((n,o)=>String(n.displayName).localeCompare(String(o.displayName),void 0,{sensitivity:"base"}))}function be(e,t){if(t.selectedTypes.size>0&&!t.selectedTypes.has(e.type))return!1;const n=t.query.trim().toLowerCase();return!(n&&!e.name.toLowerCase().includes(n)||t.pauseFilter==="paused"&&!e.paused||t.pauseFilter==="active"&&e.paused)}function ye(e,t){const n=[],o=[];for(const a of e)(be(a,t)?n:o).push(a);return{show:n,hide:o}}try{const e=document.currentScript,t=(e==null?void 0:e.dataset.qolVars)??document.documentElement.dataset.qolVars;t&&(window.__QOL_VARS__={...window.__QOL_VARS__??{},...JSON.parse(t)})}catch{}const x="andromeda-filters",G="andromeda-row-hidden";var W;const V=typeof((W=window.__QOL_VARS__)==null?void 0:W.imgBase)=="string"?window.__QOL_VARS__.imgBase:"";let w=z(),S="",q=!0;function ee(e){return`amd_sel_${e}`}function he(){if(S!=="")try{sessionStorage.setItem(ee(S),JSON.stringify({types:[...w.selectedTypes],pauseFilter:w.pauseFilter}))}catch{}}function ve(e,t){try{const n=sessionStorage.getItem(ee(e));if(!n)return;const o=JSON.parse(n);if(Array.isArray(o))w.selectedTypes=new Set(o.filter(a=>t.has(a)));else if(o&&typeof o=="object"){const a=o;Array.isArray(a.types)&&(w.selectedTypes=new Set(a.types.filter(r=>t.has(r)))),(a.pauseFilter==="paused"||a.pauseFilter==="active")&&(w.pauseFilter=a.pauseFilter)}}catch{}}var X;let N={...((X=window.__QOL_VARS__)==null?void 0:X.variableTypeLabels)??{}};function xe(){window.postMessage({action:"amd_get_var_labels"},"*")}function we(e){window.postMessage({action:"amd_set_var_labels",payload:e},"*")}window.addEventListener("message",e=>{if(e.source!==window)return;const t=e.data;if((t==null?void 0:t.action)==="amd_var_labels"&&t.payload){const n=JSON.stringify(t.payload),o=JSON.stringify(N);if(n===o)return;N=t.payload,window.__QOL_VARS__={...window.__QOL_VARS__??{},variableTypeLabels:N},S==="VARIABLES"&&U(!0)}});function Se(){if(document.getElementById("andromeda-filters-style"))return;const e=document.createElement("style");e.id="andromeda-filters-style",e.textContent=`
    .${G} { display: none !important; }
    #${x} {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 10px 14px; margin: 0 0 6px;
      border-bottom: 1px solid rgba(0,0,0,.07);
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: relative;
    }
    /* ── filter trigger button ─────────────────────────────────── */
    #${x} .amd-filter-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 11px; border: 1px solid rgba(0,0,0,.18); border-radius: 9px;
      background: #fff; color: #3c4043; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background .12s, border-color .12s;
      white-space: nowrap;
    }
    #${x} .amd-filter-btn:hover { background: #faf6da; border-color: #e5c614; }
    #${x} .amd-filter-btn.active { background: #e5c614; border-color: #e5c614; color: #2c2c2a; }
    #${x} .amd-filter-btn .amd-filter-badge {
      background: #2c2c2a; color: #fff; border-radius: 999px;
      font-size: 11px; font-weight: 700; padding: 0 5px; min-width: 16px; text-align: center;
    }
    #${x} .amd-filter-btn.active .amd-filter-badge { background: rgba(0,0,0,.25); color: #fff; }
    #${x} .amd-filter-arrow { font-size: 10px; opacity: .6; }
    /* ── active type chips (inline, removable) ──────────────────── */
    #${x} .amd-active-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    #${x} .amd-active-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 9px; border: 1px solid #e5c614; border-radius: 999px;
      background: #fffae6; color: #2c2c2a; font-size: 12px; font-weight: 500;
      white-space: nowrap; cursor: pointer;
      transition: background .1s;
    }
    #${x} .amd-active-chip:hover { background: #fef0b0; }
    #${x} .amd-active-chip .amd-chip-x { opacity: .5; font-size: 11px; margin-left: 1px; }
    /* ── counter + secondary buttons ───────────────────────────── */
    #${x} .amd-visible-count {
      margin-left: auto; font-size: 12px; color: #5f6368; font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    #${x} .amd-visible-count.amd-filtered { color: #2c2c2a; font-weight: 600; }
    #${x} .amd-clear {
      background: none; border: none; color: #5f6368;
      cursor: pointer; font-size: 13px; font-weight: 500; padding: 6px 4px;
    }
    #${x} .amd-clear:hover { color: #c5221f; text-decoration: underline; }
    #${x} .amd-builtin-toggle {
      background: #fff; border: 1px solid rgba(0,0,0,.14); border-radius: 9px;
      padding: 6px 12px; color: #3c4043; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background .12s, border-color .12s;
    }
    #${x} .amd-builtin-toggle:hover { background: #faf6da; border-color: #e5c614; }
    /* ── dropdown panel ─────────────────────────────────────────── */
    #${x} .amd-dropdown {
      position: absolute; top: calc(100% + 2px); left: 14px;
      width: 360px; background: #fff; border: 1px solid rgba(0,0,0,.15);
      border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.13);
      z-index: 9000; overflow: hidden;
      display: none;
    }
    #${x} .amd-dropdown.open { display: block; }
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
  `,document.head.appendChild(e);const t=document.createElement("style");t.id="andromeda-row-style",t.textContent=`
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
    .amd-modal-msg { color: #137333; font-size: 13px; }`,document.head.appendChild(t)}function ke(){return document.querySelector('.gtm-container-page-content [data-gtm-cloak="variable-list"] > .card.card--table')??document.querySelector(".gtm-container-page-content .card.card--table")}function te(e){const{show:t,hide:n}=ye(e,w);for(const o of t)o.node.classList.remove(G);for(const o of n)o.node.classList.add(G);P(e)}function P(e){const t=document.getElementById("amd-visible-count");if(!t)return;const n=e.length,o=e.filter(a=>a.node.offsetParent!==null).length;o===n?(t.textContent=`${n} element${n===1?"o":"i"}`,t.classList.remove("amd-filtered")):(t.textContent=`${o} di ${n} visibili`,t.classList.add("amd-filtered"))}function Ce(e){if(S!=="")for(const t of e){const n=(t.node.matches("tr")?t.node:t.node.querySelector("tr"))??t.node,o=n.querySelector(":scope > td:nth-child(2)")??n.querySelector("td:nth-child(2)")??n.querySelector("td");if(!o)continue;const a=o.querySelector("a")??o.querySelector(".fill-cell")??o,r=a.querySelector(".amd-type-icon");if(r){if(r.classList.contains("amd-has-img")||r.dataset.amdDisplay===t.displayName)continue;r.remove()}const y=Ne(t);y.dataset.amdDisplay=t.displayName,a.insertBefore(y,a.firstChild);const p=Te(t);if(p){const i=new Image;i.onload=()=>{y.isConnected&&(y.style.backgroundImage=`url("${p}")`,y.classList.add("amd-has-img"),y.textContent="")},i.src=p}}}const Ee=new Set(["1","2","3","4","6","7","8","9","10","12","30","31","32","33"]),Le=new Set(["0","1","2","3","4","aev","c","cid","ctv","d","dbg","e","ev","f","gas","j","jsm","k","r","remm","smm","u","uv","v","vis"]),Ae=new Set([]);function Te(e){return S==="TAGS"&&e.brandThumbnailUrl?e.brandThumbnailUrl:V?S==="TRIGGERS"&&e.rawType&&Ee.has(e.rawType)?`${V}trigger/${e.rawType}.png`:S==="VARIABLES"&&e.publicId&&Le.has(e.publicId)?`${V}variable/${e.publicId}.png`:S==="CLIENTS"&&e.rawType&&Ae.has(e.rawType)?`${V}client/${e.rawType}.png`:"":""}const _e={TAGS:"T",TRIGGERS:"T",VARIABLES:"V",CLIENTS:"C"};function Ne(e){const t=document.createElement("span");t.className="amd-type-icon amd-type-initial";const n=(e.displayName||"?").trim().charAt(0).toUpperCase();return t.textContent=/^\d/.test(n)?_e[S]??"?":n,t.title=e.displayName,t}function qe(e){if(S!=="")for(const t of e){const n=(t.node.matches("tr")?t.node:t.node.querySelector("tr"))??t.node,o=n.querySelector(":scope > td:last-child")??n.querySelector("td:last-child");if(!o||o.querySelector(".amd-copy-element"))continue;let a=o.querySelector(".amd-icon-group");a||(a=document.createElement("span"),a.className="amd-icon-group",o.appendChild(a));const r=document.createElement("button");r.className="amd-copy-element qol-row-not-clickable",r.title="Duplica",r.type="button",r.addEventListener("click",y=>{y.preventDefault(),y.stopPropagation(),de(S,r,p=>{r.classList.add(p?"amd-copy-ok":"amd-copy-err"),setTimeout(()=>r.classList.remove("amd-copy-ok","amd-copy-err"),1200)})},!0),a.appendChild(r)}}function Ie(e){if(S==="TAGS")for(const t of e){const n=(t.node.matches("tr")?t.node:t.node.querySelector("tr"))??t.node,o=n.querySelector(":scope > td:last-child")??n.querySelector("td:last-child");if(!o)continue;let a=o.querySelector(".amd-icon-group");a||(a=document.createElement("span"),a.className="amd-icon-group",o.appendChild(a));let r=a.querySelector(".amd-pause-element");r||(r=document.createElement("button"),r.className="amd-pause-element qol-row-not-clickable",r.type="button",r.addEventListener("click",i=>{i.preventDefault(),i.stopPropagation();const u=r.closest("[gtm-table-row]")??r.closest("tr");u&&pe(u,v=>{r.classList.add(v?"amd-pause-ok":"amd-pause-err"),setTimeout(()=>r.classList.remove("amd-pause-ok","amd-pause-err"),1200)})},!0),a.appendChild(r));const y=t.paused===!0;r.classList.toggle("amd-pause-on",y),r.title=y?"Riprendi":"Metti in pausa";const p=o.querySelector(".pause-circle-filled-icon");p&&(p.style.display=y?"none":"")}}function $e(e){const t=ke();if(!t)return;let n=document.getElementById(x);(!n||!n.isConnected)&&(n=document.createElement("div"),n.id=x,t.insertAdjacentElement("beforebegin",n)),n.replaceChildren();let o=[];try{o=ge(e)}catch{}S!==""&&w.selectedTypes.size===0&&w.pauseFilter==="all"&&ve(S,new Set(o.map(s=>s.type)));const a=()=>{he(),te(I(S)),f()},r=document.createElement("div");r.className="amd-dropdown";const y=document.createElement("div");y.className="amd-dropdown-head",y.textContent="Filtri";const p=document.createElement("button");p.type="button",p.className="amd-dropdown-close",p.textContent="×",p.addEventListener("click",()=>r.classList.remove("open")),y.appendChild(p),r.appendChild(y);const i=document.createElement("input");i.type="search",i.className="amd-dropdown-search",i.placeholder="Cerca tipo…",r.appendChild(i);const u=document.createElement("div");u.className="amd-dropdown-types",r.appendChild(u);const v=(s="")=>{u.replaceChildren();const l=s.trim().toLowerCase(),b=l?o.filter(h=>h.displayName.toLowerCase().includes(l)):o;for(const h of b){const L=document.createElement("label");L.className="amd-dropdown-check";const k=document.createElement("input");k.type="checkbox",k.checked=w.selectedTypes.has(h.type),k.addEventListener("change",()=>{k.checked?w.selectedTypes.add(h.type):w.selectedTypes.delete(h.type),a()});const C=document.createElement("span");C.className="amd-dc-name",C.textContent=h.displayName;const g=document.createElement("span");g.className="amd-dc-count",g.textContent=`${h.count}`,L.append(k,C,g),u.appendChild(L)}if(!b.length){const h=document.createElement("div");h.style.cssText="padding:10px 12px; color:#5f6368; font-size:13px;",h.textContent="Nessun tipo trovato",u.appendChild(h)}};if(i.addEventListener("input",()=>v(i.value)),v(),S==="TAGS"){const s=document.createElement("hr");s.className="amd-dropdown-sep",r.appendChild(s);const l=document.createElement("div");l.className="amd-dropdown-section-label",l.textContent="Stato",r.appendChild(l);const b=document.createElement("div");b.className="amd-dropdown-radio";const h=[["all","Tutti"],["active","Solo attivi"],["paused","Solo in pausa"]];for(const[L,k]of h){const C=document.createElement("label"),g=document.createElement("input");g.type="radio",g.name="amd-pause-filter",g.value=L,g.checked=w.pauseFilter===L,g.addEventListener("change",()=>{g.checked&&(w.pauseFilter=L,a(),b.querySelectorAll('input[type="radio"]').forEach(E=>{var _;(_=E.closest("label"))==null||_.classList.toggle("checked",E.checked)}))}),C.append(g,k),b.appendChild(C)}r.appendChild(b)}const d=document.createElement("div");d.className="amd-dropdown-footer";const m=document.createElement("button");m.type="button",m.className="amd-dropdown-reset",m.textContent="Azzera tutti i filtri",m.addEventListener("click",()=>{w=z(),r.classList.remove("open"),a(),v(i.value)}),d.appendChild(m),r.appendChild(d);const f=()=>{n.replaceChildren();const s=w.selectedTypes.size+(w.pauseFilter!=="all"?1:0),l=document.createElement("button");l.type="button",l.className="amd-filter-btn"+(s>0?" active":"");const b=document.createElementNS("http://www.w3.org/2000/svg","svg");b.setAttribute("viewBox","0 0 16 16"),b.setAttribute("width","14"),b.setAttribute("height","14"),b.setAttribute("fill","currentColor");const h=document.createElementNS("http://www.w3.org/2000/svg","path");h.setAttribute("d","M1 1.5A.5.5 0 0 1 1.5 1h13a.5.5 0 0 1 .4.8L9.5 9.3V14a.5.5 0 0 1-.7.5l-3-1.5A.5.5 0 0 1 5.5 12.5V9.3L1.1 2.3A.5.5 0 0 1 1 1.5z"),b.appendChild(h),l.appendChild(b);const L=document.createTextNode(" Filtri");if(l.appendChild(L),s>0){const g=document.createElement("span");g.className="amd-filter-badge",g.textContent=String(s),l.appendChild(g)}const k=document.createElement("span");if(k.className="amd-filter-arrow",k.textContent="▾",l.appendChild(k),l.addEventListener("click",g=>{g.stopPropagation(),r.classList.toggle("open")&&(i.value="",v())}),n.appendChild(l),n.appendChild(r),w.selectedTypes.size>0){const g=document.createElement("div");g.className="amd-active-chips";for(const E of w.selectedTypes){const _=o.find(ne=>ne.type===E);if(!_)continue;const A=document.createElement("button");A.type="button",A.className="amd-active-chip",A.title=`Rimuovi filtro: ${_.displayName}`;const H=document.createElement("span");H.textContent=_.displayName;const O=document.createElement("span");O.className="amd-chip-x",O.textContent="×",A.append(H,O),A.addEventListener("click",()=>{w.selectedTypes.delete(E),a()}),g.appendChild(A)}if(w.pauseFilter!=="all"){const E=document.createElement("button");E.type="button",E.className="amd-active-chip";const _=document.createElement("span");_.textContent=w.pauseFilter==="paused"?"Solo in pausa":"Solo attivi";const A=document.createElement("span");A.className="amd-chip-x",A.textContent="×",E.append(_,A),E.addEventListener("click",()=>{w.pauseFilter="all",a()}),g.appendChild(E)}n.appendChild(g)}const C=document.createElement("span");if(C.id="amd-visible-count",C.className="amd-visible-count",n.appendChild(C),s>0){const g=document.createElement("button");g.type="button",g.className="amd-clear",g.textContent="Azzera",g.addEventListener("click",()=>{w=z(),r.classList.remove("open"),a()}),n.appendChild(g)}if(S==="VARIABLES"&&ce()){const g=document.createElement("button");g.type="button",g.className="amd-builtin-toggle";const E=()=>{g.textContent=q?"Mostra variabili integrate":"Nascondi variabili integrate"};E(),M(q),g.addEventListener("click",()=>{q=!q,M(q),E()}),n.appendChild(g)}if(S==="VARIABLES"){const g=document.createElement("button");g.type="button",g.className="amd-builtin-toggle",g.textContent="Etichette tipi…",g.addEventListener("click",()=>Be()),n.appendChild(g)}P(I(S))};f(),window.__amdDropdownBound||(window.__amdDropdownBound=!0,document.addEventListener("click",s=>{var b;const l=document.querySelector(`#${x} .amd-dropdown.open`);l&&!((b=l.closest(`#${x}`))!=null&&b.contains(s.target))&&l.classList.remove("open")},!0));const c=R();c&&!c.dataset.amdBound&&(c.dataset.amdBound="1",c.addEventListener("input",()=>{requestAnimationFrame(()=>P(I(S)))})),window.__amdSlashBound||(window.__amdSlashBound=!0,document.addEventListener("keydown",s=>{if(s.key!=="/"||s.metaKey||s.ctrlKey||s.altKey)return;const l=s.target;if(l&&(l.tagName==="INPUT"||l.tagName==="TEXTAREA"||l.isContentEditable||l.closest("input, textarea, [contenteditable]")))return;const b=R();b&&(s.preventDefault(),s.stopPropagation(),b.focus())},!0))}function R(){const e=document.querySelector(".gtm-container-page-content")??document;return e.querySelector('input[type="search"]')??e.querySelector('input[aria-label*="erca"]')??e.querySelector('input[placeholder*="erca"]')??e.querySelector('input[aria-label*="earch"]')??e.querySelector('input[placeholder*="earch"]')}function Be(){var p;(p=document.getElementById("amd-label-editor"))==null||p.remove();const e=document.createElement("div");e.id="amd-label-editor",e.className="amd-modal-overlay";const t=document.createElement("div");t.className="amd-modal",t.innerHTML=`
    <div class="amd-modal-head">
      <strong>Etichette tipi di variabili</strong>
      <button type="button" class="amd-modal-close" title="Chiudi">×</button>
    </div>
    <p class="amd-modal-help">Assegna un nome leggibile a ciascun codice tipo. Lascia vuoto per usare il predefinito.</p>
    <div class="amd-modal-rows"></div>
    <div class="amd-modal-actions">
      <button type="button" class="amd-modal-save">Salva</button>
      <span class="amd-modal-msg"></span>
    </div>`,e.appendChild(t),document.body.appendChild(e);const n=t.querySelector(".amd-modal-rows"),o=I("VARIABLES"),a=new Map;for(const i of o)a.has(i.code)||a.set(i.code,i.displayName);for(const i of Object.keys(N))a.has(i)||a.set(i,N[i]);const r=new Map;for(const[i,u]of a){const v=document.createElement("label");v.className="amd-modal-row";const d=document.createElement("code");d.textContent=i;const m=document.createElement("input");m.type="text",m.placeholder=u||"(predefinito)",m.value=N[i]??"",r.set(i,m),v.append(d,m),n.appendChild(v)}const y=()=>e.remove();t.querySelector(".amd-modal-close").addEventListener("click",y),e.addEventListener("click",i=>{i.target===e&&y()}),t.querySelector(".amd-modal-save").addEventListener("click",()=>{const i={...N};for(const[v,d]of r){const m=d.value.trim();m?i[v]=m:delete i[v]}we(i);const u=t.querySelector(".amd-modal-msg");u.textContent="Salvato ✓",setTimeout(y,600)})}function Ve(){if(window.__amdBulkBound)return;window.__amdBulkBound=!0;let e=null,t=null;const n="gtm-table-row-checkbox",o="gtm-table-row-checkbox i",a="[gtm-table-row]";function r(p){const i=p.querySelector(o);if(i)return i.getAttribute("aria-checked")==="true";const u=p.querySelector(`${n} input[type="checkbox"]`);return u?u.checked:!1}function y(p){const i=p.querySelector(o);if(i){i.click();return}const u=p.querySelector(n);u&&u.click()}document.addEventListener("click",p=>{if(p.__amdBulk)return;const u=p.target.closest(n);if(!u)return;const v=u.closest(a);if(!v)return;const d=v.closest("table");if(!d)return;if(!p.shiftKey||!e||e.closest("table")!==d){requestAnimationFrame(()=>{t=r(v)}),e=v;return}p.preventDefault(),p.stopPropagation();const m=Array.from(d.querySelectorAll(a)),f=m.indexOf(v),c=m.indexOf(e);if(f<0||c<0)return;const s=t??!0,l=Math.min(c,f),b=Math.max(c,f),h=L=>{const k=Math.min(L+25,b);for(let C=L;C<=k;C++)r(m[C])!==s&&y(m[C]);k<b&&requestAnimationFrame(()=>h(k+1))};h(l),e=v,t=s},!0)}function U(e=!1){var a;const t=fe();if(t===""){(a=document.getElementById(x))==null||a.remove(),S="";return}t!==S&&(S=t,w=z(),e=!0);const n=I(t),o=document.getElementById(x);n.length!==0&&((e||!o||!o.isConnected)&&(Se(),$e(n)),t==="VARIABLES"&&q&&M(!0),te(n),Ce(n),qe(n),Ie(n),Ve())}let j=!1;const ze=new MutationObserver(e=>{e.every(n=>{var a;const o=n.target;return(a=o.closest)==null?void 0:a.call(o,`#${x}, #amd-label-editor, #andromeda-filters-style`)})||j||(j=!0,requestAnimationFrame(()=>{j=!1,U()}))});ze.observe(document.body,{childList:!0,subtree:!0});U(!0);xe();window.QOL??(window.QOL={});
