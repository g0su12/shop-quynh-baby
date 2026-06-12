export const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SOURCE_IMAGE_BYTES = 30 * 1024 * 1024;

const TARGET_IMAGE_BYTES = Math.floor(4.5 * 1024 * 1024);
const MAX_IMAGE_EDGE = 1800;
const MIN_IMAGE_EDGE = 720;
const WEBP_QUALITIES = [0.84, 0.74, 0.64, 0.54];

type OptimizedImage = {
  file: File;
  wasOptimized: boolean;
  originalSize: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

export async function optimizeImageForUpload(
  file: File,
): Promise<OptimizedImage> {
  if (file.size <= MAX_UPLOAD_IMAGE_BYTES) {
    return {
      file,
      wasOptimized: false,
      originalSize: file.size,
    };
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error(`${file.name} lớn hơn giới hạn xử lý 30 MB.`);
  }

  const image = await decodeImage(file);

  try {
    let { width, height } = fitInside(
      image.width,
      image.height,
      MAX_IMAGE_EDGE,
    );

    while (Math.max(width, height) >= MIN_IMAGE_EDGE) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Trình duyệt không thể xử lý ảnh này.");
      }

      context.drawImage(image.source, 0, 0, width, height);

      for (const quality of WEBP_QUALITIES) {
        const blob = await canvasToBlob(canvas, quality);

        if (blob.size <= TARGET_IMAGE_BYTES) {
          return {
            file: new File([blob], createWebpName(file.name), {
              type: "image/webp",
              lastModified: Date.now(),
            }),
            wasOptimized: true,
            originalSize: file.size,
          };
        }
      }

      width = Math.round(width * 0.82);
      height = Math.round(height * 0.82);
    }
  } finally {
    image.cleanup();
  }

  throw new Error(`Không thể giảm ${file.name} xuống dưới 5 MB.`);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`Không thể đọc ảnh ${file.name}.`);
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

function fitInside(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(new Error("Trình duyệt không hỗ trợ tối ưu ảnh WebP."));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

function createWebpName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").slice(0, 120) || "product";

  return `${baseName}.webp`;
}
