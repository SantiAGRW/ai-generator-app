import fs from 'fs';

const COMFY_URL = "https://txz15yxtbqcztq-8188.proxy.runpod.net";

async function checkComfyStatus() {
    console.log("Checking ComfyUI Status at", COMFY_URL);
    try {
        const res = await fetch(`${COMFY_URL}/system_stats`);
        if (!res.ok) throw new Error(\`HTTP \${res.status} \${res.statusText}\`);
        const stats = await res.json();
        console.log("ComfyUI is UP!", "System Stats:", stats.system);
    } catch (e) {
        console.error("Failed to connect to ComfyUI:", e.message);
    }
}

checkComfyStatus();
