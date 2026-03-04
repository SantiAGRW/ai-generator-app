const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.match(/RUNPOD_API_KEY=(.+)/)[1].trim();
const endpointId = '7h69xdf3ejmo3m';

// Tiny 1x1 red pixel png in base64
const testImageB64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVIP/2Q==';

function reqRp(path, method, body) {
    return new Promise(resolve => {
        const opts = {
            hostname: 'api.runpod.ai',
            port: 443,
            path: `/v2/${endpointId}${path}`,
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }
        };
        const r = https.request(opts, res => {
            let b = '';
            res.on('data', d => b += d);
            res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
        });
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
    // Minimal workflow to test connectivity
    const workflow = {
        "1": {
            "inputs": { "unet_name": "qwen_image_edit_fp8_e4m3fn.safetensors", "weight_dtype": "fp8_e4m3fn" },
            "class_type": "UNETLoader"
        },
        "2": {
            "inputs": { "vae_name": "qwen_image_vae.safetensors" },
            "class_type": "VAELoader"
        },
        "3": {
            "inputs": { "image": testImageB64 },
            "class_type": "ETN_LoadImageBase64"
        },
        "4": {
            "inputs": {
                "text": "make her smile",
                "clip": ["1", 0]
            },
            "class_type": "CLIPTextEncode"
        },
        "5": {
            "inputs": {
                "model": ["1", 0],
                "vae": ["2", 0],
                "positive": ["4", 0],
                "image": ["3", 0],
                "noise_seed": 42,
                "steps": 4,
                "cfg": 2,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 0.5
            },
            "class_type": "KSamplerSelect"
        },
        "6": {
            "inputs": { "samples": ["5", 0], "vae": ["2", 0] },
            "class_type": "VAEDecode"
        },
        "7": {
            "inputs": { "images": ["6", 0], "filename_prefix": "test" },
            "class_type": "SaveImage"
        }
    };

    console.log("Submitting test job...");
    const jobRes = await reqRp('/run', 'POST', { input: { workflow } });
    console.log("Submit response:", JSON.stringify(jobRes, null, 2));

    if (!jobRes.id) {
        console.error("No job ID returned. Endpoint may be broken.");
        return;
    }

    const jobId = jobRes.id;
    console.log("Job ID:", jobId, "- Polling status...");

    for (let i = 0; i < 30; i++) {
        await sleep(10000);
        const status = await reqRp(`/status/${jobId}`, 'GET');
        console.log(`[${i + 1}/30]`, status.status, status.error || '');
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            console.log("Final:", JSON.stringify(status, null, 2));
            break;
        }
    }
})();
