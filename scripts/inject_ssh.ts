import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import WebSocket from "ws";

const JUPYTER_BASE = "https://txz15yxtbqcztq-8888.proxy.runpod.net";
const WS_BASE = "wss://txz15yxtbqcztq-8888.proxy.runpod.net";
const TOKEN = "6p9qyav6cutzsib8ufnx";

async function runHack() {
    // 1. Generate SSH Key locally if not exists
    const sshDir = path.join(os.homedir(), ".ssh");
    const keyPath = path.join(sshDir, "id_rsa");
    if (!fs.existsSync(keyPath)) {
        execSync(`ssh-keygen -t rsa -b 4096 -N "" -f "${keyPath}"`);
    }
    const pubKey = fs.readFileSync(`${keyPath}.pub`, "utf-8").trim();
    console.log("Local Public Key:", pubKey.substring(0, 30) + "...");

    // 2. Create Terminal on Jupyter
    console.log("Creating Jupyter Terminal...");
    const res = await fetch(`${JUPYTER_BASE}/api/terminals?token=${TOKEN}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    const term = await res.json();
    console.log("Terminal Name:", term.name);

    // 3. Connect via WebSocket and inject Key
    const ws = new WebSocket(`${WS_BASE}/terminals/websocket/${term.name}?token=${TOKEN}`);

    ws.on('open', () => {
        console.log("Connected to Shell!");
        // send public key insertion command
        const cmd = `mkdir -p ~/.ssh && echo "${pubKey}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys\r`;
        ws.send(JSON.stringify(["stdin", cmd]));

        setTimeout(() => {
            console.log("Key injected.");
            ws.close();
        }, 3000);
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'stdout') {
            process.stdout.write(msg[1]);
        }
    });

}

import path from "path";
runHack().catch(console.error);
