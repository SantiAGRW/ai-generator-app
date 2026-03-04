const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.match(/RUNPOD_API_KEY=(.+)/)[1].trim();
const endpointId = '7h69xdf3ejmo3m';

async function req(path, method = 'GET', body = null) {
    return new Promise(resolve => {
        const opts = {
            hostname: 'api.runpod.ai', port: 443, path: `/v2/${endpointId}${path}`,
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }
        };
        const r = https.request(opts, res => {
            let b = ''; res.on('data', d => b += d); res.on('end', () => {
                try { resolve(JSON.parse(b)); } catch { resolve(b); }
            });
        });
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

(async () => {
    console.log("Health check:");
    const h = await req('/health');
    console.log(JSON.stringify(h, null, 2));
})();
