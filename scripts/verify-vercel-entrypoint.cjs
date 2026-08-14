/*
 * Loads the exact CommonJS function Vercel invokes, then exercises the health
 * route without starting the standalone server. This catches module-loader and
 * missing-runtime-dependency failures that a TypeScript build cannot detect.
 */
const http = require('node:http');

process.env.VERCEL = '1';

const app = require('../api/index.js');
if (typeof app !== 'function') {
  throw new Error('api/index.js did not export an Express application.');
}

const server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const body = await response.json();
    if (![200, 503].includes(response.status) || typeof body.success !== 'boolean') {
      throw new Error(`Unexpected health response: ${response.status}`);
    }
    console.log(`VERCEL_ENTRYPOINT_OK health=${response.status} database=${body.data?.dependencies?.database ?? 'UNKNOWN'}`);
  } finally {
    server.close();
  }
});
