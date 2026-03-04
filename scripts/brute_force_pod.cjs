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

const gpus = [
    "NVIDIA RTX A4000", "NVIDIA RTX 3090", "NVIDIA L4",
    "NVIDIA RTX A5000", "NVIDIA RTX 4090", "NVIDIA GeForce RTX 3070",
    "NVIDIA RTX 6000 Ada Generation", "NVIDIA A100 80GB PCIe", "NVIDIA H100 80GB HBM3",
    "NVIDIA A10G", "NVIDIA L40S", "NVIDIA RTX 5000 Ada Generation",
    "NVIDIA RTX 4000 SFF Ada", "NVIDIA GeForce RTX 4070 Ti", "NVIDIA GeForce RTX 4080",
    "NVIDIA A40", "NVIDIA A30", "NVIDIA T4", "NVIDIA V100", "NVIDIA Tesla V100",
    "NVIDIA RTX A6000"
];
const types = ["COMMUNITY", "SECURE"];

(async () => {
    for (const cloud of types) {
        for (const gpu of gpus) {
            console.log(`Trying ${gpu} on ${cloud}...`);
            const createPod = `mutation {
                podFindAndDeployOnDemand(input: {
                name: "Aether-Downloader",
                imageName: "runpod/pytorch:2.2.1-py3.10-cuda12.1.1-devel-ubuntu22.04",
                gpuCount: 1,
                gpuTypeId: "${gpu}",
                cloudType: ${cloud},
                networkVolumeId: "p75lad5y9t",
                containerDiskInGb: 20,
                volumeMountPath: "/workspace",
                ports: "22/tcp",
                startSsh: true,
                startJupyter: false,
                supportPublicIp: true
                }) {
                id name runtime { ports { ip isIpPublic privatePort publicPort type } }
                }
            }`;
            const result = await reqGql(createPod);
            if (!result.errors && result.data && result.data.podFindAndDeployOnDemand) {
                console.log("SUCCESS!", JSON.stringify(result.data.podFindAndDeployOnDemand, null, 2));
                return;
            }
        }
    }
    console.log("Failed all options.");
})();
