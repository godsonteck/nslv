// Vercel's Node runtime loads this CommonJS entrypoint. The application itself
// is compiled by the project build and exports the Express app as its default.
module.exports = require('../packages/server/dist/index.js').default;
