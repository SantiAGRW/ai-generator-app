import { execSync } from 'child_process';
import fs from 'fs';

const script = `#!/bin/bash
set -e
echo "Starting downloads..."
cd /workspace/ComfyUI/models/unet
echo "Downloading Flux FP8 from Kijai..."
wget -q --show-progress -O flux1-dev-fp8.safetensors "https://huggingface.co/Kijai/flux-fp8/resolve/main/flux1-dev-fp8.safetensors?download=true" || echo "Failed"

cd /workspace/ComfyUI/models/clip
echo "Downloading t5xxl_fp8..."
wget -q --show-progress -O t5xxl_fp8_e4m3fn.safetensors "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors?download=true"
echo "Downloading clip_l..."
wget -q --show-progress -O clip_l.safetensors "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors?download=true"

cd /workspace/ComfyUI/models/vae
echo "Downloading ae..."
wget -q --show-progress -O ae.safetensors "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors?download=true"

mkdir -p /workspace/ComfyUI/models/loras
cd /workspace/ComfyUI/models/loras
echo "Downloading HMFemme LoRA from CivitAI..."
wget -q --show-progress --header="Authorization: Bearer 306b3a992bb1aeb513d7890ef783b9c0" -O HMFemme_Flux.safetensors "https://civitai.com/api/download/models/788982"

echo "Done downloading models."
`;

fs.writeFileSync('download_models.sh', script);

console.log("Uploaded script to runpod...");
execSync('scp -o StrictHostKeyChecking=no -P 10032 download_models.sh root@203.57.40.226:/workspace/download_models.sh', { stdio: 'inherit' });

console.log("Executing script on runpod...");
execSync('ssh -o StrictHostKeyChecking=no root@203.57.40.226 -p 10032 "chmod +x /workspace/download_models.sh && /workspace/download_models.sh"', { stdio: 'inherit' });
