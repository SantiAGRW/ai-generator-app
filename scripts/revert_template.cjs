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
    const updateTpl = `mutation {
    saveTemplate(input: {
      id: "rx3n0qlw37",
      name: "Qwen-Edit-Serverless-WorkerComfyUI",
      imageName: "runpod/worker-comfyui:3.0.0-base",
      containerDiskInGb: 20,
      volumeInGb: 0,
      dockerArgs: "",
      env: []
    }) { id name }
  }`;

    console.log("Reverting Template vars...");
    const tpl = await reqGql(updateTpl);
    console.log(JSON.stringify(tpl, null, 2));

    // Resume the endpoint (it usually picks up template changes automatically on new workers)
})();
