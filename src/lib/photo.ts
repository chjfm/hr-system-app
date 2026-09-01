import { supabase } from "./supabase";

export const PHOTO_BUCKET = "employee-photos";
const MAX_SIDE = 320;

/**
 * 브라우저에서 정사각 축소 후 JPEG로 — 원본(수 MB)을 그대로 올리면 대장 썸네일 158장이 무겁다.
 * 중앙 크롭 · 긴 변 320px · 품질 0.86. 원본은 보관하지 않는다 (인사원장은 식별용 사진이면 충분).
 */
export async function shrinkToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const out = Math.min(MAX_SIDE, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없습니다.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", 0.86);
  });
}

/** 업로드 → 공개 URL. 같은 사번은 덮어쓴다(upsert). 캐시 무효화를 위해 쿼리에 시각을 붙인다 */
export async function uploadPhoto(employeeNo: string, file: File): Promise<string> {
  const blob = await shrinkToSquare(file);
  const path = `${employeeNo}.jpg`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
