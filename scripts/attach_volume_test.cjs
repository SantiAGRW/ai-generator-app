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
    // Modify Aether-Test-NoVolume to include the user's Network Volume p75lad5y9t
    const epMut = `mutation {
        saveEndpoint(input: {
          id: "2zr8e3awjum94c",
          name: "Aether-Test-VolumeCheck",
          templateId: "ll3czcgcia",
          gpuIds: "AMPERE_16,AMPERE_24,ADA_24,ADA_16",
          networkVolumeId: "p75lad5y9t",
          workersMin: 1,
          workersMax: 1,
          idleTimeout: 5
        }) { id name }
    }`;
    const ep = await reqGql(epMut);
    console.log("Updated Test Endpoint with Volume:", JSON.stringify(ep, null, 2));

})();
