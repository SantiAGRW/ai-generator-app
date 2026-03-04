const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf-8');
const match = env.match(/RUNPOD_API_KEY=(.+)/);
if (!match) throw new Error("No API KEY");
const key = match[1].trim();

const mutation = `
mutation {
  endpointSave(input: {
    name: "Aether-Flux-I2I-Serverless",
    gpuIds: "AMPERE_24",
    networkVolumeId: "p75lad5y9t",
    idleTimeout: 10,
    scalerType: "QUEUE_DELAY",
    scalerValue: 1,
    workersMin: 0,
    workersMax: 1,
    templateId: "r2k67t34l7"
  }) {
    id
    name
  }
}
`;

// "r2k67t34l7" is runpod/worker-comfyui template id (public)
// Or we might need to create a custom template if the public doesn't link directly.
// Wait, Serverless requires a registered template. Let's list the user templates first.
const data = JSON.stringify({ query: mutation });
const options = {
    hostname: 'api.runpod.io',
    port: 443,
    path: '/graphql',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }
};

const req = https.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log(body));
});
req.write(data);
req.end();
