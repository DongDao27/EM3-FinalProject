import catalogImages from "./catalog-images.json";

export function imageSrc(url: string) {
  try {
    const parsed = new URL(url, "http://localhost");
    const imported = parsed.pathname.match(
      /\/storage\/products\/imports\/ae2ca77c6543732131739c830b5595c207c28f5398a9eb9a8131a30ee5fb0deb\/(?:basename-)?(TT-[A-Z]+-\d+)\.(?:jpg|png|webp)$/i,
    );
    const images = catalogImages as Record<string, { src: string }>;
    if (imported && images[imported[1]]) return images[imported[1]].src;
    return parsed.pathname.startsWith("/storage/") ? parsed.pathname : "";
  } catch {
    return "";
  }
}
