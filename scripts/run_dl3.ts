import { execSync } from 'child_process';
import fs from 'fs';

const script = `#!/usr/bin/env python3
from huggingface_hub import hf_hub_download
import urllib.request
import os

print("Downloading Flux VAE...")
hf_hub_download(
    repo_id="black-forest-labs/FLUX.1-schnell",
    filename="ae.safetensors",
    local_dir="/workspace/ComfyUI/models/vae",
    token="hf_aJMWdZkEaZgKwUpxcIvOqTvxqMvDqkAab"
)

print("Downloading HMFemme LoRA...")
os.makedirs("/workspace/ComfyUI/models/loras", exist_ok=True)
import ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request("https://huggingface.co/mntruell/HMFemme_Flux/resolve/main/HMFemme_Flux.safetensors?download=true")
with urllib.request.urlopen(req, context=ctx) as r, open("/workspace/ComfyUI/models/loras/HMFemme_Flux.safetensors", "wb") as f:
    f.write(r.read())

print("Downloads finished.")
`;

fs.writeFileSync('dl3.py', script);
console.log("Uploaded script to runpod...");
execSync('scp -o StrictHostKeyChecking=no -P 10032 dl3.py root@203.57.40.226:/workspace/dl3.py', { stdio: 'inherit' });
console.log("Executing script on runpod...");
execSync('ssh -o StrictHostKeyChecking=no root@203.57.40.226 -p 10032 "python3 /workspace/dl3.py"', { stdio: 'inherit' });

// We also need some custom nodes
execSync('ssh -o StrictHostKeyChecking=no root@203.57.40.226 -p 10032 "cd /workspace/ComfyUI/custom_nodes && git clone https://github.com/cubiq/ComfyUI_essentials.git || true"', { stdio: 'inherit' });
