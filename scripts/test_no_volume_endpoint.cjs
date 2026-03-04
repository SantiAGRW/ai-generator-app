const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.match(/RUNPOD_API_KEY=(.+)/)[1].trim();

const options = {
    hostname: 'api.runpod.io', port: 443, path: '/graphql', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }
};

async function reqGql(query) {
    return new Promise(resolve => {
        const r = https.request(options, res => {
            let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(JSON.parse(b)));
        });
        r.write(JSON.stringify({ query })); r.end();
    });
}

(async () => {
    const tplMut = `mutation {
        saveTemplate(input: {
          name: "Qwen-Test-No-Volume",
          imageName: "runpod/worker-comfyui:3.0.0-base",
          containerDiskInGb: 20,
          volumeInGb: 0,
          dockerArgs: "",
          env: []
        }) { id name }
      }`;
    const tpl = await reqGql(tplMut);
    console.log("Template:", JSON.stringify(tpl, null, 2));

    if (tpl.data && tpl.data.saveTemplate) {
        const epMut = `mutation {
            saveEndpoint(input: {
              name: "Aether-Test-NoVolume",
              templateId: "${tpl.data.saveTemplate.id}",
              gpuIds: "AMPERE_16,AMPERE_24,ADA_24,ADA_16",
              workersMin: 1,
              workersMax: 1,
              idleTimeout: 5
            }) { id name }
        }`;
        const ep = await reqGql(epMut);
        console.log("Test Endpoint:", JSON.stringify(ep, null, 2));
    }

})();
