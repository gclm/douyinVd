import { getVideoUrl, getVideoInfo } from "./douyin.ts";
import { pageHtml } from "./page.ts";

const SHARE_UA =
  "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36";

function asciiFilename(name: string, ext: string): string {
  const base = name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "douyin";
  return `${base}.${ext}`;
}

async function proxyDownload(inputUrl: string, kind: "video" | "image", index: number) {
  const info = await getVideoInfo(inputUrl);
  const target = kind === "image"
    ? info.image_url_list?.[index]
    : info.video_url;
  if (!target) {
    return new Response("未找到可下载内容", { status: 404 });
  }
  const upstream = await fetch(target, {
    headers: { "User-Agent": SHARE_UA },
    redirect: "follow",
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("下载失败", { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ||
    (kind === "image" ? "image/jpeg" : "video/mp4");
  const ext = kind === "image"
    ? (contentType.includes("png") ? "png" : "jpg")
    : "mp4";
  const filename = asciiFilename(info.aweme_id || "douyin", ext);
  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("content-disposition", `attachment; filename="${filename}"`);
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  return new Response(upstream.body, { status: 200, headers });
}

const handler = async (req: Request) => {
    console.log("Method:", req.method);

    const url = new URL(req.url);
    const isDownload = url.pathname === "/download" || url.searchParams.has("download");
    if (url.searchParams.has("url")) {
        const inputUrl = url.searchParams.get("url")!;
        console.log("inputUrl:", inputUrl);
        if (isDownload) {
            const kind = url.searchParams.get("type") === "image" ? "image" : "video";
            const index = Number(url.searchParams.get("i") || "0");
            return await proxyDownload(inputUrl, kind, Number.isFinite(index) ? index : 0);
        }
        // 返回完成json数据
        if (url.searchParams.has("data")) {
            const videoInfo = await getVideoInfo(inputUrl);
            return new Response(JSON.stringify(videoInfo));
        }
        const videoUrl = await getVideoUrl(inputUrl);
        return new Response(videoUrl);
    } else {
        return new Response(pageHtml, {
            headers: { "content-type": "text/html; charset=utf-8" },
        });
    }
}

export {handler}
