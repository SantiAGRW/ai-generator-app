/**
 * runpod.ts — RunPod Serverless Service
 *
 * Soporta dos modos:
 *
 * 1. PUBLIC ENDPOINTS (RunPod Hub) — sin configuración, costoso.
 *    Precio: hasta 10-20x más que el endpoint propio.
 *
 * 2. CUSTOM ENDPOINT "Wan2.2 with LoRA" — nuestro endpoint serverless propio.
 *    Hub: wlsdml1114/generate_video  (generate_video_ksampler_v1.1)
 *    Endpoint ID: 3hqdyqnb6rppcw
 *    GPU: 24GB Pro (RTX 4090) | Precio: ~$0.00031/seg → ~$0.055/vídeo 5s
 *    API: { input: { prompt, negative_prompt?, seed?, cfg?, width?, height?, length?, steps?, image_base64?, lora_pairs? } }
 *    Output: { output: { video_base64: string } }
 *
 * Uso:
 *   configureRunPod(apiKey)                     → modo público
 *   configureRunPod(apiKey, '3hqdyqnb6rppcw')   → modo custom (Wan 2.2)
 */

const BASE = 'https://api.runpod.ai/v2';

// ─── Config ─────────────────────────────────────────────────────────────────

let _apiKey: string | null = null;
let _customEndpointId: string | null = null;

// This maps friendly IDs to actual RunPod Hub endpoint IDs
export const PUBLIC_ENDPOINT_ID_MAP: Record<string, string> = {
    'flux-schnell': '8y128un1om2h00',
    'flux-dev': 'v16t70ovtdfyyk',
    'stable-diffusion-xl': 'j1x4p061z68tds',
    'cogvideox': '98wpytld02z7p3'
};

// ==========================================
// NUESTRO WORKER COMUNITARIO DE COMFYUI PARA I2I
// ==========================================
// Endpoint Serverless de Qwen Image Edit 2511 (Aether-Qwen-Serverless)
export const QWEN_SERVERLESS_ID: string =
    import.meta.env.VITE_RUNPOD_QWEN_ID || "7h69xdf3ejmo3m";

/**
 * Configure credentials. Typically called at app startup.
 */
export function configureRunPod(apiKey: string, customVideoEndpointId?: string) {
    _apiKey = apiKey;
    if (customVideoEndpointId) {
        _customEndpointId = customVideoEndpointId;
    }
}

function headers(): HeadersInit {
    if (!_apiKey) throw new Error('RunPod no configurado. Llama configureRunPod() primero.');
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${_apiKey}`,
    };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type MediaType = 'image' | 'video';
export type JobStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';

export interface GenerateOpts {
    endpointId: string;
    prompt: string;
    negativePrompt?: string;
    inputImageUrl?: string;   // base64 o data URL (para I2V)
    imageWidth?: number;      // dimensiones originales de la imagen
    imageHeight?: number;
    loraName?: string;
    loraStrength?: number;
    steps?: number;
    cfgScale?: number;
    seed?: number;
    resolution?: '512x512' | '768x512' | '1024x576' | '1024x1024' | '1280x720';
    nsfw?: boolean;
    duration?: number;
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
    startImage?: string; // Added for I2I
    denoise?: number;    // Added for I2I
}

export interface GenerationResult {
    url: string;
    id?: string;
    status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT';
    progress?: number;
}

// ─── Model Catalogue ─────────────────────────────────────────────────────────

export interface AnyModelDef {
    id: string;
    name: string;
    provider: string; // e.g. "RunPod", "Alibaba (propio)"
    mediaType: 'video' | 'image';
    badge?: string;   // e.g. "Img→Video", "Rápido"
    credits: number;
}

// Endpoint público (RunPod Hub) — para cuando no hay endpoint custom
interface PublicEndpointDef extends AnyModelDef {
    buildInput: (opts: GenerateOpts) => Record<string, unknown>;
    parseOutput: (data: unknown) => string;
}

// Modelos del endpoint custom Wan2.2 with LoRA
interface CustomModelDef extends AnyModelDef {
    buildInput: (opts: GenerateOpts) => Record<string, unknown>;
    parseOutput: (data: unknown) => string;
}

// ─── Public Endpoints (RunPod Hub) ──────────────────────────────────────────

export const PUBLIC_MODELS: PublicEndpointDef[] = [
    {
        id: 'black-forest-labs-flux-1-schnell',
        name: 'FLUX.1 Schnell',
        provider: 'Black Forest Labs',
        mediaType: 'image',
        badge: 'Rápido',
        credits: 3,
        buildInput: ({ prompt, negativePrompt, steps, cfgScale, seed, resolution }) => {
            const [w, h] = resolutionToWH(resolution ?? '1024x576');
            return { prompt, negative_prompt: negativePrompt ?? '', width: w, height: h, num_inference_steps: steps ?? 4, guidance_scale: cfgScale ?? 0, seed: seed ?? -1 };
        },
        parseOutput: (data) => {
            const d = data as { images?: Array<{ url?: string; base64?: string }> };
            const img = d.images?.[0];
            if (img?.url) return img.url;
            if (img?.base64) return `data:image/jpeg;base64,${img.base64}`;
            throw new Error('Respuesta inesperada de FLUX.1 Schnell');
        },
    },
    {
        id: 'black-forest-labs-flux-1-dev',
        name: 'FLUX.1 Dev',
        provider: 'Black Forest Labs',
        mediaType: 'image',
        badge: 'Calidad',
        credits: 10,
        buildInput: ({ prompt, negativePrompt, steps, cfgScale, seed, resolution }) => {
            const [w, h] = resolutionToWH(resolution ?? '1024x576');
            return { prompt, negative_prompt: negativePrompt ?? '', width: w, height: h, num_inference_steps: steps ?? 20, guidance_scale: cfgScale ?? 3.5, seed: seed ?? -1 };
        },
        parseOutput: (data) => {
            const d = data as { images?: Array<{ url?: string; base64?: string }> };
            const img = d.images?.[0];
            if (img?.url) return img.url;
            if (img?.base64) return `data:image/jpeg;base64,${img.base64}`;
            throw new Error('Respuesta inesperada de FLUX.1 Dev');
        },
    },
];

// Compatible con código antiguo
export const ENDPOINTS = PUBLIC_MODELS;
export type EndpointDef = PublicEndpointDef;

// ─── Custom Endpoint Models (Wan2.2 with LoRA) ───────────────────────────────
//
// API format: POST /run  →  { input: { prompt, negative_prompt?, seed?, cfg?,
//   width?, height?, length?, steps?, image_base64?, lora_pairs? } }
//
// Output: { output: { video_base64: string } }
//   video_base64 es el vídeo MP4 en base64
//
// Defaults: width=480, height=832, length=81 (≈5s@16fps), steps=10, cfg=2.0

const CUSTOM_MODELS: CustomModelDef[] = [
    // ── Flux.1 Schnell (Text to Image / Image to Image) ────────────────────────
    {
        id: 'flux-schnell',
        name: 'Flux.1 Schnell',
        provider: 'Black Forest Labs',
        mediaType: 'image',
        badge: 'T2I Ultra Rápido',
        credits: 5,
        buildInput: ({ prompt, imageWidth, imageHeight }) => {
            const [w, h] = wan22Dimensions(imageWidth, imageHeight);
            return {
                prompt,
                width: w, height: h,
                num_inference_steps: 4,
                output_format: "jpeg"
            };
        },
        parseOutput: parseFluxOutput,
    },

    // ── Wan 2.2 T2V ───────────────────────────────────────────────────────────
    {
        id: 'wan22-t2v',
        name: 'Wan 2.2 T2V',
        provider: 'Alibaba (propio)',
        mediaType: 'video',
        badge: '🔥 Mejor',
        credits: 20,
        buildInput: ({ prompt, negativePrompt, steps, cfgScale, seed, duration, imageWidth, imageHeight, loraName, loraStrength }) => {
            const [w, h] = wan22Dimensions(imageWidth, imageHeight);
            return {
                prompt,
                negative_prompt: negativePrompt || 'worst quality, ugly, blurry, watermark',
                seed: (seed != null && seed >= 0) ? seed : Math.floor(Math.random() * 2 ** 31),
                cfg: cfgScale ?? 1.2,
                width: w, height: h,
                length: durationToFrames(duration ?? 5),
                steps: steps ?? 12,
                ...(loraName ? {
                    lora_pairs: [{ high: loraName, low: loraName, high_weight: loraStrength ?? 1.0, low_weight: loraStrength ?? 1.0 }]
                } : {}),
            };
        },
        parseOutput: parseWan22Output,
    },

    // ── Wan 2.2 I2V ───────────────────────────────────────────────────────────
    {
        id: 'wan22-i2v',
        name: 'Wan 2.2 I2V',
        provider: 'Alibaba (propio)',
        mediaType: 'video',
        badge: 'Img→Video',
        credits: 25,
        buildInput: ({ prompt, negativePrompt, steps, cfgScale, seed, duration, inputImageUrl, imageWidth, imageHeight, loraName, loraStrength }) => {
            const imageB64 = inputImageUrl
                ? (inputImageUrl.includes(',') ? inputImageUrl.split(',')[1] : inputImageUrl)
                : undefined;
            const [w, h] = wan22Dimensions(imageWidth, imageHeight);
            return {
                prompt,
                negative_prompt: negativePrompt || 'worst quality, ugly, blurry, watermark',
                seed: (seed != null && seed >= 0) ? seed : Math.floor(Math.random() * 2 ** 31),
                cfg: cfgScale ?? 1.2,
                width: w, height: h,
                length: durationToFrames(duration ?? 5),
                steps: steps ?? 12,
                ...(imageB64 ? { image_base64: imageB64 } : {}),
                ...(loraName ? {
                    lora_pairs: [{ high: loraName, low: loraName, high_weight: loraStrength ?? 1.0, low_weight: loraStrength ?? 1.0 }]
                } : {}),
            };
        },
        parseOutput: parseWan22Output,
    },
];

function parseWan22Output(data: unknown): string {
    // El endpoint Wan2.2 with LoRA devuelve:
    //   { video: "AAAAIGZ0eXBpc29t..." }  ← campo real confirmado
    // (también acepta video_base64 por si cambia en futuras versiones)
    const d = data as { video?: string; video_base64?: string; output?: { video?: string; video_base64?: string } };
    const b64 = d.video ?? d.video_base64 ?? d.output?.video ?? d.output?.video_base64;
    if (b64) return `data:video/mp4;base64,${b64}`;
    throw new Error(`No se recibió vídeo en la respuesta. Claves disponibles: ${Object.keys(d as object).join(', ')}`);
}

function parseFluxOutput(data: unknown): string {
    // Standard RunPod serverless format for Image generation
    const d = data as { image_url?: string; image?: string; image_base64?: string; output?: { image_url?: string; image_base64?: string } };
    const b64 = d.image_base64 ?? d.image ?? d.output?.image_base64;
    if (b64) return `data:image/jpeg;base64,${b64}`;

    // Si devuelve url en su lugar
    const url = d.image_url ?? d.output?.image_url;
    if (url) return url;

    throw new Error(`No se recibió imagen en la respuesta (Formato Flux). Claves: ${Object.keys(d as object).join(', ')}`);
}

// ─── Dynamic catalogue ────────────────────────────────────────────────────────

export const ALL_MODELS = [...CUSTOM_MODELS, ...PUBLIC_MODELS];

/** Devuelve los modelos disponibles según el modo configurado */
export function getEndpoints(): AnyModelDef[] {
    return _customEndpointId ? CUSTOM_MODELS : PUBLIC_MODELS;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolutionToWH(r: string): [number, number] {
    const map: Record<string, [number, number]> = {
        '512x512': [512, 512], '768x512': [768, 512],
        '1024x576': [1024, 576], '1024x1024': [1024, 1024], '1280x720': [1280, 720],
    };
    return map[r] ?? [1024, 576];
}

/**
 * Calcula width/height compatibles con Wan 2.2 preservando el aspect ratio original.
 * - Múltiplo de 16 (requisito del modelo)
 * - Lado largo máximo: 832px
 * - Lado corto mínimo: 480px
 * Ejemplos: 9:16 portrait → 480×832, 16:9 → 832×480, 4:3 → 624×480, 1:1 → 624×624
 */
function wan22Dimensions(w?: number, h?: number): [number, number] {
    // Sin info de dimensiones → portrait por defecto (útil para NSFW)
    if (!w || !h) return [480, 832];

    const MAX = 832;
    const MIN = 480;
    const STEP = 16;

    const ratio = w / h;

    let outW: number, outH: number;
    if (w >= h) {
        // Landscape o cuadrado
        outW = MAX;
        outH = Math.round(MAX / ratio);
    } else {
        // Portrait
        outH = MAX;
        outW = Math.round(MAX * ratio);
    }

    // Redondear al múltiplo de 16 más cercano
    outW = Math.round(outW / STEP) * STEP;
    outH = Math.round(outH / STEP) * STEP;

    // Asegurar mínimo MIN en cada lado
    outW = Math.max(outW, MIN);
    outH = Math.max(outH, MIN);

    return [outW, outH];
}


function durationToFrames(seconds: number): number {
    // Wan 2.2 @ 16 FPS: 49 ≈ 3s, 81 ≈ 5s, 129 ≈ 8s
    if (seconds <= 3) return 49;
    if (seconds <= 5) return 81;
    return 129;
}

// ─── Core Job Flow ───────────────────────────────────────────────────────────

async function submitJob(endpointId: string, body: Record<string, unknown>): Promise<string> {
    const res = await fetch(`${BASE}/${endpointId}/run`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`RunPod error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { id: string };
    return data.id;
}

async function pollStatus(endpointId: string, jobId: string): Promise<{ status: JobStatus; output?: unknown; error?: string }> {
    const res = await fetch(`${BASE}/${endpointId}/status/${jobId}`, { headers: headers() });
    if (!res.ok) throw new Error(`Poll error ${res.status}`);
    return res.json() as Promise<{ status: JobStatus; output?: unknown; error?: string }>;
}

async function cancelJob(endpointId: string, jobId: string) {
    await fetch(`${BASE}/${endpointId}/cancel/${jobId}`, { method: 'POST', headers: headers() }).catch(() => { });
}

// ─── Main Generate ──────────────────────────────────────────────────────────

export async function runpodGenerate(opts: GenerateOpts): Promise<GenerationResult> {

    // =========================================================================
    // DEDICATED SERVERLESS ENDPOINT: Qwen Image Edit 2511 (Uncensored I2I)
    // =========================================================================
    const isQwenI2I = (opts.endpointId === 'flux-schnell' || opts.endpointId === 'flux-dev') && opts.startImage;

    if (isQwenI2I) {
        console.log("Enrutando I2I a Qwen Image Edit Serverless...");
        try {
            // Import the Qwen-specific workflow
            const workflow = await import('./workflow_qwen_i2i.json').then(m => m.default);
            const promptCopy = JSON.parse(JSON.stringify(workflow)) as Record<string, any>;
            const seed = Math.floor(Math.random() * 10000000);

            // Update Qwen workflow nodes
            // Node "5" = CLIPTextEncode (prompt)
            promptCopy["5"].inputs.text = opts.prompt;
            // Node "4" = ETN_LoadImageBase64 (input image)
            // The image may come as data:image/jpeg;base64,XXX or just the base64 string
            promptCopy["4"].inputs.image = opts.startImage?.split(',')[1] || opts.startImage;
            // Node "6" = KSampler (seed + denoise)
            promptCopy["6"].inputs.noise_seed = seed;
            promptCopy["6"].inputs.denoise = opts.denoise ?? 0.85;

            opts.onProgress?.('Enviando a Qwen Edit Serverless…');
            const jobId = await submitJob(QWEN_SERVERLESS_ID, {
                input: {
                    workflow: promptCopy
                }
            });

            return await pollLoop(QWEN_SERVERLESS_ID, jobId, opts, (rawOutput: any) => {
                // worker-comfyui returns images as base64 strings or URLs in output.images[]
                let finalImage = "";
                if (typeof rawOutput === 'string') finalImage = rawOutput;
                else if (rawOutput?.message) finalImage = rawOutput.message;
                else if (rawOutput?.images?.[0]) finalImage = rawOutput.images[0];
                else finalImage = JSON.stringify(rawOutput); // debug fallback

                return {
                    id: jobId,
                    status: 'COMPLETED',
                    url: finalImage.startsWith('http') || finalImage.startsWith('data:')
                        ? finalImage
                        : `data:image/jpeg;base64,${finalImage}`,
                };
            });
        } catch (e) {
            console.error("Qwen I2I Serverless Error:", e);
            throw e;
        }
    }



    // =========================================================================
    // STANDARD RUNPOD SERVERLESS POOL
    // =========================================================================

    // If a custom endpoint is defined AND the requested model belongs to the custom pool (Wan)
    const isCustomModel = CUSTOM_MODELS.some(m => m.id === opts.endpointId) && opts.endpointId !== 'flux-schnell';

    if (_customEndpointId && isCustomModel) {
        const model = CUSTOM_MODELS.find(m => m.id === opts.endpointId);
        if (!model) throw new Error(`Modelo custom desconocido: ${opts.endpointId}`);
        const input = model.buildInput(opts);
        opts.onProgress?.('Enviando a Wan 2.2…');
        const jobId = await submitJob(_customEndpointId, { input });
        return pollLoop(_customEndpointId, jobId, opts, (output) => ({
            url: model.parseOutput(output),
            id: jobId,
            status: 'COMPLETED',
        }));
    } else {
        // Use Global Public Endpoints (like Flux Serverless)
        // Check if the model is registered as a custom model definition first (we moved flux to CUSTOM_MODELS in earlier drafts, let's allow finding it there or in PUBLIC)
        let endpoint = CUSTOM_MODELS.find(e => e.id === opts.endpointId) || PUBLIC_MODELS.find(e => e.id === opts.endpointId);
        if (!endpoint) throw new Error(`Endpoint desconocido: ${opts.endpointId}`);

        const input = endpoint.buildInput(opts);
        opts.onProgress?.(`Enviando a ${endpoint.name}…`);

        // For public serverless, map friendly IDs to actual backend endpoint IDs
        let runpodEndpoint = opts.endpointId;
        if (runpodEndpoint === 'flux-schnell') {
            runpodEndpoint = 'black-forest-labs-flux-1-schnell';
        }

        const jobId = await submitJob(runpodEndpoint, { input });
        return pollLoop(runpodEndpoint, jobId, opts, (output) => ({
            url: endpoint.parseOutput(output),
            id: jobId,
            status: 'COMPLETED'
        }));
    }
}

async function pollLoop(
    endpointId: string,
    jobId: string,
    opts: GenerateOpts,
    parseResult: (output: unknown) => GenerationResult
): Promise<GenerationResult> {
    opts.onProgress?.('En cola…');
    while (true) {
        if (opts.signal?.aborted) {
            await cancelJob(endpointId, jobId);
            throw new Error('Generación cancelada');
        }
        await sleep(3000);
        const job = await pollStatus(endpointId, jobId);
        if (job.status === 'IN_QUEUE') opts.onProgress?.('En cola…');
        if (job.status === 'IN_PROGRESS') opts.onProgress?.('Generando vídeo en GPU…');
        if (job.status === 'COMPLETED') return parseResult(job.output);
        if (job.status === 'FAILED' || job.status === 'TIMED_OUT') {
            throw new Error(job.error ?? `Job ${job.status}`);
        }
    }
}

// ─── Upload image blob → base64 (with auto-resize + JPEG conversion) ────────
// Acepta cualquier formato (PNG, WEBP, BMP, etc.), redimensiona a máx 1280px
// en el lado largo y exporta como JPEG@90%. Evita payloads enormes y problemas
// de compatibilidad de formato con el worker de RunPod.

const MAX_SIDE = 1280;

export async function uploadImageBlob(blobUrl: string, onProgress?: (m: string) => void): Promise<string> {
    onProgress?.('Preparando imagen…');
    const response = await fetch(blobUrl);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { naturalWidth: w, naturalHeight: h } = img;

            // Redimensionar si supera MAX_SIDE
            if (w > MAX_SIDE || h > MAX_SIDE) {
                if (w >= h) { h = Math.round(h * MAX_SIDE / w); w = MAX_SIDE; }
                else { w = Math.round(w * MAX_SIDE / h); h = MAX_SIDE; }
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            // Fondo blanco (por si la imagen tiene transparencia / canal alpha)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            // Exportar como JPEG data URL (compatibilidad máxima con RunPod)
            resolve(canvas.toDataURL('image/jpeg', 0.92));
            URL.revokeObjectURL(img.src);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
