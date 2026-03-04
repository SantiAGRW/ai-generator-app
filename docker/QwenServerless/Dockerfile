FROM runpod/worker-comfyui:5.7.1-base

# Descargar nodos custom si los hubiera (para Qwen Edit básico no necesitamos nodos extra fuera de los core)
# RUN comfy-node-install comfyui-kjnodes

# Usar el CLI de ComfyUI incluido en la imagen de Runpod para descargar los modelos al construir
# 1. Modelo de Difusión (Qwen 2.5VL Edit)
RUN comfy model download \
    --url https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_fp8_e4m3fn.safetensors \
    --relative-path models/diffusion_models \
    --filename qwen_image_edit_fp8_e4m3fn.safetensors

# 2. Text Encoder / Vision Language Model Combinado
RUN comfy model download \
    --url https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors \
    --relative-path models/text_encoders \
    --filename qwen_2.5_vl_7b_fp8_scaled.safetensors

# 3. VAE de Qwen
RUN comfy model download \
    --url https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors \
    --relative-path models/vae \
    --filename qwen_image_vae.safetensors

# Opcional: Podríamos copiar el workflow de la app directamente en un directorio `input` interno si usáramos 
# procesamiento síncrono quemado en imagen, pero Aether pasará el workflow JSON por API.
