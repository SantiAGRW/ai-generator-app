import { configureRunPod, runpodGenerate } from './src/runpod.ts';
configureRunPod('3Q4TNJB2S0A4LDFB0TZZK28UXMIVC8XY7L0179A2', '3hqdyqnb6rppcw');

async function test() {
    console.log('Sending fast test to Flux...');
    try {
        const res = await runpodGenerate({
            endpointId: 'flux-schnell',
            prompt: 'a tiny blue square, solid color, 8x8 pixels',
            onProgress: (m) => console.log('progress:', m)
        });
        console.log('Final Result keys:', Object.keys(res));
        console.log('URL length:', res.url?.length);
    } catch (err) {
        console.error('RunPod Error details:', err);
    }
}

test();
