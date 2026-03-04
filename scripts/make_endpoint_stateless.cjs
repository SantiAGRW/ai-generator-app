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
    // 1. Template con auto-descarga de modelos en disco efímero
    const tplMut = `mutation {
        saveTemplate(input: {
          id: "rx3n0qlw37",
          name: "Qwen-Edit-Clean-Serverless",
          imageName: "runpod/worker-comfyui:3.0.0-base",
          containerDiskInGb: 40,
          volumeInGb: 0,
          dockerArgs: "",
          env: [
            { key: "HF_HUB_ENABLE_HF_TRANSFER", value: "1" },
            { key: "MODELS_DOWNLOAD_ON_STARTUP", value: "diffusion_models/qwen_image_edit_fp8_e4m3fn.safetensors=https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_fp8_e4m3fn.safetensors text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors=https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors vae/qwen_image_vae.safetensors=https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors" }
          ]
        }) { id name }
      }`;

    // 2. Aplicarlo al Endpoint 7h69xdf3ejmo3m y quitar el networkVolumeId
    const epMut = `mutation {
        saveEndpoint(input: {
          id: "7h69xdf3ejmo3m",
          name: "Aether-Qwen-Serverless",
          templateId: "rx3n0qlw37",
          gpuIds: "AMPERE_16,AMPERE_24,ADA_24,ADA_16",
          networkVolumeId: null,
          workersMin: 0,
          workersMax: 1,
          idleTimeout: 15,
          scalerType: "QUEUE_DELAY",
          scalerValue: 1
        }) { id name }
    }`;

    console.log("Re-configuring Template completely stateless...");
    const tpl = await reqGql(tplMut);
    console.log(JSON.stringify(tpl, null, 2));

    console.log("\\nRemoving conflicting Network Volume from Endpoint...");
    const ep = await reqGql(epMut);
    console.log(JSON.stringify(ep, null, 2));
})();
