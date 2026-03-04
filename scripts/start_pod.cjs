const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.match(/RUNPOD_API_KEY=(.+)/)[1].trim();

const data = JSON.stringify({
    query: `mutation { podResume(input: { podId: "txz15yxtbqcztq", gpuCount: 1 }) { id desiredStatus } }`
});

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
    res.on('end', () => console.log(JSON.stringify(JSON.parse(body), null, 2)));
});
req.write(data);
req.end();
