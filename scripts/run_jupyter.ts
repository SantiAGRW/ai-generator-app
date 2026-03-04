// Script to execute bash commands on Jupyter Server REST API
import fetch from 'node-fetch';

const JUPYTER_BASE = "https://txz15yxtbqcztq-8888.proxy.runpod.net";
const API_TOKEN = "6p9qyav6cutzsib8ufnx";

async function runCommand(command: string) {
    console.log(`Executing: ${command}`);

    // 1. Create a terminal session
    const termRes = await fetch(`${JUPYTER_BASE}/api/terminals?token=${API_TOKEN}`, {
        method: 'POST'
    });

    if (!termRes.ok) {
        throw new Error(`Failed to create terminal: ${await termRes.text()}`);
    }
    const term = await termRes.json();
    const termName = term.name;

    // 2. We can't easily wait for websocket output in a simple script without a WS library, 
    // so we'll run the command in background and redirect output to a file that we can read via standard REST.
    const bashScript = `
    cat << 'EOF' > /workspace/run_setup.sh
#!/bin/bash
${command}
echo "DONE" > /workspace/setup_status.txt
EOF
    chmod +x /workspace/run_setup.sh
    nohup /workspace/run_setup.sh > /workspace/setup_log.txt 2>&1 &
    `;

    // 3. To run it, we actually need WebSocket... Let's just use the /api/sessions or /api/contents?
    // Actually, Jupyter has a neat trick for simple code execution: Creating a temporary notebook and running it or just using standard contents API to upload a bash script and we can execute it if we had a kernel.
}

runCommand('ls -la /workspace');
