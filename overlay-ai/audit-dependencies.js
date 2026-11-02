const fs = require('fs');
const path = require('path');

function scanDir(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      results.push(...scanDir(full));
    } else if (f.name.endsWith('.jsx') || f.name.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      
      const ipcCalls = [];
      const ipcRegex = /ipcRenderer\.(?:invoke|send|on)\(\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = ipcRegex.exec(content)) !== null) {
        ipcCalls.push(m[1]);
      }

      const httpCalls = [];
      const fetchRegex = /fetch\(\s*(?:`\$\{API_BASE\}([^`]+)`|`\$\{BASE_URL\}([^`]+)`|['"]([^'"]+)['"])/g;
      while ((m = fetchRegex.exec(content)) !== null) {
        httpCalls.push(m[1] || m[2] || m[3]);
      }

      const axiosRegex = /axios\.(?:get|post|put|delete)\(\s*(?:`\$\{API_BASE\}([^`]+)`|`\$\{BASE_URL\}([^`]+)`|['"]([^'"]+)['"])/g;
      while ((m = axiosRegex.exec(content)) !== null) {
        httpCalls.push(m[1] || m[2] || m[3]);
      }

      const apiFetchRegex = /apiFetch\(\s*(?:['"]([^'"]+)['"]|`([^`]+)`)/g;
      while ((m = apiFetchRegex.exec(content)) !== null) {
        httpCalls.push(m[1] || m[2]);
      }

      const uniqueIpc = [...new Set(ipcCalls)];
      const uniqueHttp = [...new Set(httpCalls)].filter(Boolean);

      if (uniqueIpc.length > 0 || uniqueHttp.length > 0) {
        results.push({
          file: path.relative('c:/Users/user/Downloads/AppKairos(@2)/Kairos-Frontend/src', full).replace(/\\/g, '/'),
          ipc: uniqueIpc,
          http: uniqueHttp
        });
      }
    }
  }
  return results;
}

const report = scanDir('c:/Users/user/Downloads/AppKairos(@2)/Kairos-Frontend/src');

console.log('=== FRONTEND AUDIT: IPC VS HTTP DEPENDENCIES ===\n');
for (const item of report) {
  console.log(`[FILE] ${item.file}`);
  if (item.ipc.length > 0) {
    console.log(`  - IPC Channels (${item.ipc.length}):`, item.ipc.join(', '));
  } else {
    console.log(`  - IPC Channels: (None) -> 100% relies on HTTP`);
  }
  if (item.http.length > 0) {
    console.log(`  - HTTP Endpoints (${item.http.length}):`, item.http.join(', '));
  } else {
    console.log(`  - HTTP Endpoints: (None) -> 100% Native IPC`);
  }
  console.log('');
}
