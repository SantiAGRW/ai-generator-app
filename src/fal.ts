import { fal } from "@fal-ai/client";

// ─── Configuration ───────────────────────────────────────────────────────────

export function configureFal(apiKey: string) {
    fal.config({ credentials: apiKey });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerateImageOptions {
    prompt: string;
    imageUrl?: string;
    modelEndpoint: string;
}

export interface GenerateVideoOptions {
    prompt: string;
    imageUrl?: string;
    modelEndpoint: string;
}

export interface GenerationOutput {
    url: string;
    type: "image" | "video";
}

// ─── Image Generation ─────────────────────────────────────────────────────────

export async function generateImage(
    opts: GenerateImageOptions,
    onProgress?: (status: string) => void
): Promise<GenerationOutput> {
    onProgress?.("Enviando petición…");

    const input: Record<string, unknown> = {
        prompt: opts.prompt,
        image_size: "landscape_4_3",
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false,
    };

    if (opts.imageUrl) {
        input.image_url = opts.imageUrl;
        input.strength = 0.75;
    }

    const result = await fal.subscribe(opts.modelEndpoint, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === "IN_QUEUE") onProgress?.("En cola…");
            if (update.status === "IN_PROGRESS") onProgress?.("Generando imagen…");
        },
    });

    const data = result.data as {
        images: Array<{ url: string; content_type: string }>;
    };

    return { url: data.images[0].url, type: "image" };
}

// ─── Video Generation ─────────────────────────────────────────────────────────

export async function generateVideo(
    opts: GenerateVideoOptions,
    onProgress?: (status: string) => void
): Promise<GenerationOutput> {
    onProgress?.("Enviando petición…");

    let endpoint = opts.modelEndpoint;
    let input: Record<string, unknown> = {
        prompt: opts.prompt,
        resolution: "480p",
        aspect_ratio: "16:9",
    };

    if (opts.imageUrl) {
        if (endpoint === "fal-ai/wan-t2v") {
            endpoint = "fal-ai/wan-i2v";
            input = { prompt: opts.prompt, image_url: opts.imageUrl, resolution: "480p" };
        } else {
            input.image_url = opts.imageUrl;
        }
    }

    const result = await fal.subscribe(endpoint, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === "IN_QUEUE") onProgress?.("En cola…");
            if (update.status === "IN_PROGRESS") onProgress?.("Generando vídeo… (1-3 min)");
        },
    });

    const data = result.data as {
        video?: { url: string };
        video_url?: string;
    };

    const videoUrl = data.video?.url ?? data.video_url ?? "";
    return { url: videoUrl, type: "video" };
}

// ─── Upload local blob to fal storage ────────────────────────────────────────

export async function uploadImageToFal(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const file = new File([blob], "input.jpg", { type: blob.type || "image/jpeg" });
    return await fal.storage.upload(file);
}
