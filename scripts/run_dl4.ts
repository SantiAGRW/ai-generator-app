import { execSync } from "child_process";
import fs from "fs";

const script = `#!/usr/bin/env python3
import urllib.request
import ssl
import sys

# We skip the Civitai 401 Unauthorized API by using huggingface mirror
url_lora = "https://huggingface.co/mntruell/HMFemme_Flux/resolve/main/HMFemme_Flux.safetensors"
dest_lora = "/workspace/ComfyUI/models/loras/HMFemme_Flux.safetensors"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    print(f"Downloading {url_lora}...")
    req = urllib.request.Request(url_lora, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx) as r, open(dest_lora, "wb") as f:
        f.write(r.read())
    print("LoRA Downloaded!")
except Exception as e:
    print(f"Error dl Lora: {e}")

`;

fs.writeFileSync('dl4.py', script);
console.log("Uploaded script to runpod...");
execSync('scp -o StrictHostKeyChecking=no -P 10032 dl4.py root@203.57.40.226:/workspace/dl4.py', { stdio: 'inherit' });
console.log("Executing script on runpod...");
execSync('ssh -o StrictHostKeyChecking=no root@203.57.40.226 -p 10032 "python3 /workspace/dl4.py"', { stdio: 'inherit' });
