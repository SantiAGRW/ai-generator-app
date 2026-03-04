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
    const updateEp = `mutation {
    saveEndpoint(input: {
      id: "7h69xdf3ejmo3m",
      name: "Aether-Qwen-Serverless",
      templateId: "rx3n0qlw37",
      gpuIds: "AMPERE_24,ADA_24,ADA_16,AMPERE_16",
      networkVolumeId: "p75lad5y9t",
      workersMin: 0,
      workersMax: 1,
      idleTimeout: 15,
      scalerType: "QUEUE_DELAY",
      scalerValue: 1
    }) { id name }
  }`;

    console.log("Expanding GPU options on Endpoint...");
    const ep = await reqGql(updateEp);
    console.log(JSON.stringify(ep, null, 2));
})();
