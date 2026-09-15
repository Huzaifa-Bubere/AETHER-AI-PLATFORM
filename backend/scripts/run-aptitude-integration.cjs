const { spawnSync } = require('child_process');
const path = require('path');
const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand', 'aptitude-integration'], {
  cwd: path.resolve(__dirname, '..'), stdio: 'inherit', env: { ...process.env, APTITUDE_INTEGRATION: '1' }
});
process.exit(result.status ?? 1);
