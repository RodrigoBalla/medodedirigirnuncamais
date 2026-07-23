// ─── imageCompress ───────────────────────────────────────────────────────────
// Comprime a imagem NO NAVEGADOR antes de subir pro Supabase Storage.
// Sem isso, uma foto de celular (3-5 MB) estouraria o plano em ~250 fotos;
// comprimida (~200 KB) cabem ~5.000. Reduz pro lado maior = maxSize, converte
// pra WebP (fallback JPEG) e, se ainda ficar grande, baixa a qualidade até
// caber no teto. Tudo client-side: não custa banda nem CPU do servidor.
// =============================================================================

export interface CompressOptions {
  /** Maior dimensão em px (default 1080 — suficiente pra feed/story). */
  maxSize?: number;
  /** Qualidade inicial 0-1 (default 0.82). */
  quality?: number;
  /** Teto de bytes do arquivo final (default 400 KB). */
  maxBytes?: number;
}

export interface CompressResult {
  blob: Blob;
  ext: "webp" | "jpg";
  width: number;
  height: number;
  /** Tamanho original em bytes (pra log/feedback). */
  originalBytes: number;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<CompressResult> {
  const maxSize = opts.maxSize ?? 1080;
  const maxBytes = opts.maxBytes ?? 400 * 1024;
  let quality = opts.quality ?? 0.82;

  if (!file.type.startsWith("image/")) {
    throw new Error("Esse arquivo não é uma imagem.");
  }

  // createImageBitmap respeita orientação EXIF (foto de celular não vira de lado)
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    bitmap = await createImageBitmap(file);
  }

  let { width, height } = bitmap;
  if (width > maxSize || height > maxSize) {
    const scale = Math.min(maxSize / width, maxSize / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Navegador não suportou o processamento da imagem.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // WebP quando disponível (bem menor); senão JPEG.
  let type = "image/webp";
  let blob = await canvasToBlob(canvas, type, quality);
  if (!blob || blob.type !== "image/webp") {
    type = "image/jpeg";
    blob = await canvasToBlob(canvas, type, quality);
  }
  if (!blob) throw new Error("Não consegui processar essa imagem.");

  // Ainda pesada? baixa a qualidade progressivamente (até 0.5).
  while (blob.size > maxBytes && quality > 0.5) {
    quality -= 0.12;
    const next = await canvasToBlob(canvas, type, quality);
    if (!next) break;
    blob = next;
  }

  return {
    blob,
    ext: type === "image/webp" ? "webp" : "jpg",
    width,
    height,
    originalBytes: file.size,
  };
}

/** "2,4 MB" / "312 KB" — pra mostrar o quanto economizou. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
