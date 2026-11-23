export class PortraitError extends Error {
  code: "image_required" | "image_dimensions" | "image_too_large";

  constructor(code: "image_required" | "image_dimensions" | "image_too_large") {
    super(code);
    this.name = "PortraitError";
    this.code = code;
  }
}

export type PreparedPortrait = {
  dataUrl: string;
  width: number;
  height: number;
};

const MAX_EDGE = 1920;
const MAX_BYTES = 10 * 1024 * 1024;

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) {
        reject(new PortraitError("image_required"));
        return;
      }
      resolve(value);
    };
    reader.onerror = () => reject(new PortraitError("image_required"));
    reader.readAsDataURL(file);
  });
}

type Drawable = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new PortraitError("image_required"));
      element.src = url;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Check MiniMax's still-image limits, then shrink a large photo before upload.
 * The free preview never calls this. Paid HD does.
 */
export async function preparePortrait(file: File): Promise<PreparedPortrait> {
  if (!file.type.startsWith("image/")) throw new PortraitError("image_required");
  if (file.size > MAX_BYTES) throw new PortraitError("image_too_large");
  const drawable = await loadDrawable(file);
  try {
    const { width, height } = drawable;
    if (
      width < 256 ||
      height < 256 ||
      width > 5760 ||
      height > 5760 ||
      width / height < 0.4 ||
      width / height > 2.5
    ) {
      throw new PortraitError("image_dimensions");
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const recompress =
      scale < 1 || file.size > 4 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type);
    if (!recompress) {
      return { dataUrl: await fileToDataUrl(file), width, height };
    }
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { dataUrl: await fileToDataUrl(file), width, height };
    drawable.draw(ctx, targetW, targetH);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size > MAX_BYTES) throw new PortraitError("image_too_large");
    return {
      dataUrl: await fileToDataUrl(blob),
      width: targetW,
      height: targetH,
    };
  } finally {
    drawable.close();
  }
}
