import { BaseTool } from '../BaseTool.js';
import { readFile } from 'fs/promises';
import path from 'path';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188';

export class ImageGenerationTool extends BaseTool {
  constructor() {
    super({
      name: 'generate_image',
      description: 'Generate an image from a text prompt using AI image generation. Returns the image as a base64 data URL.',
      parameters: {
        properties: {
          prompt: { type: 'string', description: 'Detailed description of the image to generate' },
          negative_prompt: { type: 'string', description: 'What to avoid in the image' },
          width: { type: 'number', description: 'Image width (default 1024)' },
          height: { type: 'number', description: 'Image height (default 1024)' },
        },
        required: ['prompt'],
      },
    });
    this.timeout = 120000;
  }

  async execute(input) {
    const { prompt, negative_prompt = '', width = 1024, height = 1024 } = input;
    
    const workflow = {
      "3": {
        "class_type": "KSampler",
        "inputs": {
          "seed": Math.floor(Math.random() * 2**32),
          "steps": 20,
          "cfg": 7,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        }
      },
      "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": { "ckpt_name": "sd_xl_base_1.0.safetensors" }
      },
      "5": {
        "class_type": "EmptyLatentImage",
        "inputs": { "width": width, "height": height, "batch_size": 1 }
      },
      "6": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": prompt, "clip": ["4", 1] }
      },
      "7": {
        "class_type": "CLIPTextEncode",
        "inputs": { "text": negative_prompt, "clip": ["4", 1] }
      },
      "8": {
        "class_type": "VAEDecode",
        "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
      },
      "9": {
        "class_type": "SaveImage",
        "inputs": { "filename_prefix": "alfie_agent", "images": ["8", 0] }
      }
    };

    const queueRes = await fetch(`${COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });
    
    if (!queueRes.ok) {
      const err = await queueRes.text();
      throw new Error(`ComfyUI queue failed: ${err}`);
    }
    
    const { prompt_id } = await queueRes.json();
    
    const startTime = Date.now();
    while (Date.now() - startTime < this.timeout) {
      await new Promise(r => setTimeout(r, 2000));
      
      const historyRes = await fetch(`${COMFYUI_URL}/history/${prompt_id}`);
      if (!historyRes.ok) continue;
      
      const history = await historyRes.json();
      const entry = history[prompt_id];
      if (!entry) continue;
      
      if (entry.status?.completed) {
        const outputs = entry.outputs?.["9"]?.images;
        if (outputs?.length) {
          const img = outputs[0];
          const imageRes = await fetch(`${COMFYUI_URL}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type || 'output'}`);
          if (imageRes.ok) {
            const buffer = Buffer.from(await imageRes.arrayBuffer());
            return { 
              image: `data:image/png;base64,${buffer.toString('base64')}`,
              prompt,
              width,
              height,
            };
          }
        }
        throw new Error('Image generated but could not be retrieved');
      }
      
      if (entry.status?.status_str === 'error') {
        throw new Error('Image generation failed');
      }
    }
    
    throw new Error('Image generation timed out');
  }
}
