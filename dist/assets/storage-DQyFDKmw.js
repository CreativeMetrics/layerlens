async function o(t){const a=!Array.isArray(t),r=await chrome.storage.local.get(a?[t]:t);return a?r[t]:r}async function s(t){await chrome.storage.local.set(t)}export{o as g,s};
