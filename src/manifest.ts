import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'

// Manifest as a typed source-of-truth. crxjs resolves the entry paths
// (background / popup / content scripts) and emits the final manifest.json.
export default defineManifest({
  manifest_version: 3,
  name: 'LayerLens',
  version: pkg.version.replace(/-.*$/, ''), // numeric only (strip "-dev")
  description: 'Vedi dentro il tuo GTM: filtri e strumenti per Tag Manager + inspector del dataLayer.',

  icons: {
    '16': 'img/icon-16.png',
    '32': 'img/icon-32.png',
    '48': 'img/icon-48.png',
    '128': 'img/icon-128.png',
  },

  action: { default_popup: 'src/popup/index.html' },

  // + "cookies": exit_preview removes gtm_preview/gtm_debug/gtm_auth and
  //   silently failed before because the permission was missing.
  // - dropped the redundant googletagmanager host_permission (<all_urls> covers it).
  permissions: [
    'tabs',
    'storage',
    'declarativeNetRequest',
    'declarativeNetRequestWithHostAccess',
    'alarms',
    'cookies',
    'webNavigation',
    'scripting',
  ],
  host_permissions: ['<all_urls>'],

  background: { service_worker: 'src/background/background.ts', type: 'module' },

  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: [
        'src/content/block-page-change.content.ts',
        'src/content/datalayer-checker.content.ts',
        'src/content/qol-changes.content.ts',
      ],
    },
    {
      // Injects the Shopify pixel sandbox wrapper into every sub-frame.
      // The injected script self-exits immediately on non-Shopify frames.
      matches: ['<all_urls>'],
      all_frames: true,
      run_at: 'document_start',
      js: ['src/content/shopify-sandbox.content.ts'],
    },
  ],

  // Narrowed: we no longer expose modules/* and vendors/* wholesale.
  // Page-injected scripts are added automatically by crxjs via the
  // `?script&module` imports in the content scripts.
  web_accessible_resources: [
    { resources: ['img/*', 'img/tag/*', 'img/trigger/*', 'img/variable/*'], matches: ['<all_urls>'] },
  ],
})
