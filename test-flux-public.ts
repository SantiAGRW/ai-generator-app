import { configureRunPod } from './src/runpod.ts';

const API_KEY = process.env.VITE_RUNPOD_API_KEY || 'N/A'; // Need to get valid key
console.log('API KEY loaded:', API_KEY.substring(0, 5) + '...');

async function testPublicFlux() {
    const url = 'https://api.runpod.ai/v2/black-forest-labs-flux-1-schnell/run';
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({
            input: {
                prompt: 'a simple box',
                image_url: 'https://images.unsplash.com/photo-1575936123452-b67c3203c357?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aW1hZ2V8ZW58MHx8MHx8fDA%3D&w=1000&q=80',
                width: 512,
                height: 512,
                num_inference_steps: 4
            }
        })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
    if (data.id) {
        console.log('Polling...', data.id);
        let status = 'IN_QUEUE';
        while (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
            await new Promise(r => setTimeout(r, 2000));
            const poll = await fetch(`https://api.runpod.ai/v2/black-forest-labs-flux-1-schnell/status/${data.id}`, { headers: { 'Authorization': `Bearer ${API_KEY}` } });
            const pData = await poll.json();
            status = pData.status;
            console.log('Poll Status:', status, pData.error);
            if (status === 'COMPLETED') console.log('Keys:', Object.keys(pData.output || {}));
        }
    }
}

testPublicFlux();
