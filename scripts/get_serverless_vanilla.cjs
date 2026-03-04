const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf-8');
const match = env.match(/RUNPOD_API_KEY=(.+)/);
if (!match) throw new Error("No API KEY");
const key = match[1].trim();

const data = JSON.stringify({
    query: 'query { myself { networkVolumes { id name dataCenterId } endpoints { id name networkVolumeId } } }'
});

const options = {
    hostname: 'api.runpod.io',
    port: 443,
    path: '/graphql',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
    }
};

const req = https.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log(body));
});

req.write(data);
req.end();
