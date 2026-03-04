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
    // Update template with env vars that tell worker-comfyui where to find/put models
    // worker-comfyui 3.0.0 reads COMFYUI_PATH and mounts /runpod-volume
    // We configure it so ComfyUI model directories point to the network volume
    const hfToken = ""; // optional for public models

    const updateTpl = `mutation {
    saveTemplate(input: {
      id: "rx3n0qlw37",
      name: "Qwen-Edit-Serverless-WorkerComfyUI",
      imageName: "runpod/worker-comfyui:3.0.0-base",
      containerDiskInGb: 20,
      volumeInGb: 0,
      dockerArgs: "",
      env: [
        { key: "COMFYUI_EXTRA_MODEL_PATHS_YAML", value: "/runpod-volume/extra_model_paths.yaml" },
        { key: "HF_HUB_ENABLE_HF_TRANSFER", value: "1" },
        { key: "MODELS_DOWNLOAD_ON_STARTUP", value: "diffusion_models/qwen_image_edit_fp8_e4m3fn.safetensors=https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_fp8_e4m3fn.safetensors text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors=https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors vae/qwen_image_vae.safetensors=https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors" }
      ]
    }) { id name imageName }
  }`;

    console.log("Updating Template with env vars for Qwen model auto-download...");
    const tpl = await reqGql(updateTpl);
    console.log(JSON.stringify(tpl, null, 2));
})();
