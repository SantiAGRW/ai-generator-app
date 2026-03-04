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
    try {
        console.log("Creating Serverless Template...");
        const tplMut = `mutation {
      saveTemplate(input: {
        name: "Qwen-Edit-Hearmeman-Serverless",
        imageName: "hearmeman/comfyui-qwen-template:v5",
        containerDiskInGb: 50,
        volumeInGb: 0,
        dockerArgs: "",
        env: []
      }) { id name }
    }`;
        const tpl = await reqGql(tplMut);
        console.log("Template Result:", JSON.stringify(tpl, null, 2));

        if (!tpl.data || !tpl.data.saveTemplate) {
            console.error("Failed to create template.");
            return;
        }

        const tplId = tpl.data.saveTemplate.id;

        console.log("Creating Serverless Endpoint...");
        const epMut = `mutation {
      saveEndpoint(input: {
        name: "Aether-Qwen-Serverless",
        templateId: "${tplId}",
        gpuIds: "AMPERE_24",
        networkVolumeId: "p75lad5y9t",
        workersMin: 0,
        workersMax: 1,
        idleTimeout: 15,
        scalerType: "QUEUE_DELAY",
        scalerValue: 1
      }) { id name }
    }`;
        const ep = await reqGql(epMut);
        console.log("Endpoint Result:", JSON.stringify(ep, null, 2));

    } catch (e) {
        console.error(e);
    }
})();
