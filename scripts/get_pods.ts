import { execSync } from 'child_process';

const apiKey = process.env.VITE_RUNPOD_API_KEY;

async function getPods() {
    const res = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api_key': apiKey as string
        },
        body: JSON.stringify({
            query: `
                query {
                    myself {
                        pods {
                            id
                            name
                            runtime {
                                ports {
                                    ip
                                    isIpPublic
                                    privatePort
                                    publicPort
                                    type
                                }
                            }
                        }
                    }
                }
            `
        })
    });

    const data = await res.json();
    console.dir(data.data.myself.pods, { depth: null });
}

getPods();
