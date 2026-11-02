/**
 * Embedded Backend Aggregator
 * Re-exports the modular router from ./ipcIndex.js
 */

const { setupEmbeddedBackendIpcHandlers } = require('./ipcIndex');

module.exports = {
  setupEmbeddedBackendIpcHandlers
};
