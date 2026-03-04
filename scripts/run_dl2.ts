import { execSync } from 'child_process';
import fs from 'fs';

const script = `#!/bin/bash
set -e
echo "Starting VAE and LoRA downloads..."

cd /workspace
python3 -m pip install -U huggingface_hub
python3 -m huggingface_hub.commands.huggingface_cli login --token hf_aJMWdZkEaZgKwUpxcIvOqTvxqMvDqkAab
python3 -m huggingface_hub.commands.huggingface_cli download black-forest-labs/FLUX.1-schnell ae.safetensors --local-dir /workspace/ComfyUI/models/vae

echo "Downloading HMFemme LoRA from CivitAI..."
wget -q --show-progress -O /workspace/ComfyUI/models/loras/HMFemme_Flux.safetensors "https://huggingface.co/mntruell/HMFemme_Flux/resolve/main/HMFemme_Flux.safetensors?download=true"

# Installing ComfyUI custom nodes that Hearmeman might use
echo "Cloning essential Custom Nodes..."
cd /workspace/ComfyUI/custom_nodes
git clone https://github.com/city96/ComfyUI-GGUF.git || echo "already cloned"
git clone https://github.com/cubiq/ComfyUI_essentials.git || echo "already cloned"

echo "Done downloading models."
`;

fs.writeFileSync('dl2.sh', script);
console.log("Uploaded script to runpod...");
execSync('scp -o StrictHostKeyChecking=no -P 10032 dl2.sh root@203.57.40.226:/workspace/dl2.sh', { stdio: 'inherit' });
console.log("Executing script on runpod...");
execSync('ssh -o StrictHostKeyChecking=no root@203.57.40.226 -p 10032 "chmod +x /workspace/dl2.sh && /workspace/dl2.sh"', { stdio: 'inherit' });
