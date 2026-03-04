import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
if (!RUNPOD_API_KEY) throw new Error('No RUNPOD_API_KEY inside .env.local');

async function runGql(query: string, variables = {}) {
    const res = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RUNPOD_API_KEY}`
        },
        body: JSON.stringify({ query, variables })
    });
    return await res.json();
}

async function main() {
    // Query users network volumes to get the ID
    const volQuery = `
    query {
      myself {
        networkVolumes {
          id
          name
          dataCenterId
        }
      }
    }
  `;
    const vols = await runGql(volQuery);
    console.log("Vols:", JSON.stringify(vols, null, 2));

    // Query serverless endpoints
    const epsQuery = `
    query {
      myself {
        endpoints {
          id
          name
          gpuIds
          networkVolumeId
          templateId
        }
      }
    }
  `;
    const eps = await runGql(epsQuery);
    console.log("Endpoints:", JSON.stringify(eps, null, 2));

}

main().catch(console.error);
