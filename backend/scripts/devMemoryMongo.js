/**
 * devMemoryMongo — keep an EPHEMERAL in-memory MongoDB running for local,
 * API-level verification (e.g. pointing a dev backend at it).
 *
 * SAFETY: this binary-in-memory server is completely isolated. It is NOT the
 * configured MONGODB_URI and no production/Atlas cluster is ever contacted.
 *
 * Usage:  node scripts/devMemoryMongo.js   (Ctrl+C to stop)
 * Prints: MEMORY_MONGO_URI=mongodb://127.0.0.1:<port>/<db>
 */
async function main() {
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    console.error('mongodb-memory-server is not installed. Run: npm install --no-save mongodb-memory-server');
    process.exit(2);
  }
  const mem = await MongoMemoryServer.create();
  console.log(`MEMORY_MONGO_URI=${mem.getUri('aether_api_e2e')}`);
  console.log('Press Ctrl+C to stop.');
  const shutdown = async () => {
    await mem.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // Keep the event loop alive.
  setInterval(() => {}, 1 << 30);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
