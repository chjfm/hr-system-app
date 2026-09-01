/** 프로필 사진 (B3) — 사진이 없으면 이름 첫 글자. 대장 썸네일(24px)과 인사카드(56px)가 함께 쓴다 */
export default function Avatar({
  src,
  name,
  size = 24,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- data URI·스토리지 URL 혼용, 최적화 대상 아님
    return <img className="avatar" src={src} alt="" width={size} height={size} style={style} />;
  }
  return (
    <span className="avatar avatar-fallback" style={style} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
