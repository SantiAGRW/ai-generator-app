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
    const createPod = `mutation {
    podFindAndDeployOnDemand(input: {
      name: "Qwen-Downloader",
      imageName: "runpod/pytorch:2.2.1-py3.10-cuda12.1.1-devel-ubuntu22.04",
      gpuCount: 1,
      gpuTypeId: "NVIDIA GeForce RTX 3070",
      cloudType: COMMUNITY,
      networkVolumeId: "p75lad5y9t",
      containerDiskInGb: 20,
      volumeMountPath: "/workspace",
      ports: "22/tcp",
      startSsh: true,
      startJupyter: false,
      supportPublicIp: true
    }) {
      id
      name
      runtime {
        ports {
          ip
          isIpPublic
          privatePort
          publicPort
          type
        }
      }
    }
  }`;

    console.log("Starting CPU model downloader pod...");
    const result = await reqGql(createPod);
    console.log(JSON.stringify(result, null, 2));
})();
