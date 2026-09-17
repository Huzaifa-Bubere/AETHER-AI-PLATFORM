/**
 * AETHER — Atlas DNS fix preload for networks whose local DNS resolver
 * (e.g. campus routers) refuses SRV lookups for mongodb+srv:// clusters.
 *
 * Direct queries to public resolvers (8.8.8.8 / 1.1.1.1) work where the
 * system default resolver fails, so this preload points Node's default
 * DNS resolver at them. It changes nothing else.
 *
 * Usage:
 *   node -r ./scripts/atlas-dns-fix.cjs -r ts-node/register src/scripts/seedDefaultQuestions.ts
 *
 * The running server may need the same treatment on such networks:
 *   node -r ./scripts/atlas-dns-fix.cjs dist/server.js
 */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
