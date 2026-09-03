// douyin.ts
var cVUrl = "https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0";
var DETAIL_UA = "Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)";
var SHARE_UA = "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36";
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
async function doGet(url, ua = SHARE_UA) {
  const headers = new Headers();
  headers.set("User-Agent", ua);
  if (ua === DETAIL_UA) {
    headers.set("Referer", "https://www.douyin.com/");
  }
  return await fetch(url, {
    method: "GET",
    headers
  });
}
function extractAwemeIdFromText(text) {
  const patterns = [
    /\/(?:share\/)?(?:video|note)\/(\d{8,})/,
    /\/modal_id=(\d{8,})/,
    /"itemId"\s*:\s*"(\d+)"/,
    /itemId["']?\s*:\s*["']?(\d{8,})/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}
async function resolveAwemeId(url) {
  const fromUrl = extractAwemeIdFromText(url);
  if (fromUrl) return fromUrl;
  const resp = await doGet(url);
  const location = resp.url || "";
  const fromLocation = extractAwemeIdFromText(location);
  if (fromLocation) return fromLocation;
  const body = await resp.text();
  const fromBody = extractAwemeIdFromText(body);
  if (fromBody) return fromBody;
  throw new Error("Video ID not found in URL");
}
function parseImgListFromDetail(images) {
  if (!images?.length) return [];
  const urls = [];
  for (const image of images) {
    const list = image.download_url_list?.length ? image.download_url_list : image.url_list || [];
    const chosen = list.find((u) => !u.includes("/obj/")) ?? list[0];
    if (chosen) urls.push(chosen);
  }
  return urls.filter((url) => !url.includes("/obj/"));
}
async function fetchAwemeDetail(awemeId) {
  const detailUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${awemeId}&aid=6383&device_platform=webapp`;
  let lastError = "No video or image content found in the response.";
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await doGet(detailUrl, DETAIL_UA);
    const text = await resp.text();
    try {
      const payload = JSON.parse(text);
      if (payload.aweme_detail) return payload.aweme_detail;
      lastError = "No video or image content found in the response.";
    } catch {
      lastError = "No video or image content found in the response.";
    }
  }
  throw new Error(lastError);
}
function toVideoInfo(detail) {
  const playUri = detail.video?.play_addr?.uri || "";
  const image_url_list = parseImgListFromDetail(detail.images);
  const type = playUri ? "video" : "img";
  const video_url = playUri ? cVUrl.replace("%s", playUri) : "";
  if (!video_url && image_url_list.length === 0) {
    throw new Error("No video or image content found in the response.");
  }
  const stats = detail.statistics;
  const createTime = detail.create_time ? formatDate(new Date(detail.create_time * 1e3)) : null;
  const douyinVideoInfo = {
    aweme_id: detail.aweme_id || stats?.aweme_id || null,
    comment_count: stats?.comment_count ?? null,
    digg_count: stats?.digg_count ?? null,
    share_count: stats?.share_count ?? null,
    collect_count: stats?.collect_count ?? null,
    nickname: detail.author?.nickname ?? null,
    signature: detail.author?.signature ?? null,
    desc: detail.desc ?? null,
    create_time: createTime,
    video_url,
    type,
    image_url_list
  };
  console.log(douyinVideoInfo);
  return douyinVideoInfo;
}
async function getVideoInfo(url) {
  const awemeId = await resolveAwemeId(url);
  const detail = await fetchAwemeDetail(awemeId);
  return toVideoInfo(detail);
}
async function getVideoUrl(url) {
  const info = await getVideoInfo(url);
  if (!info.video_url) throw new Error("Video ID not found in URL");
  return info.video_url;
}

// page.ts
var pageHtml = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <meta name="referrer" content="no-referrer" />\n  <title>\u6296\u97F3\u65E0\u6C34\u5370\u89E3\u6790</title>\n  <style>\n    :root {\n      color-scheme: light dark;\n      --bg: #f4f1ea;\n      --fg: #1c1917;\n      --muted: #57534e;\n      --card: #fffdf8;\n      --line: #e7e0d4;\n      --accent: #c2410c;\n      --accent-fg: #fff7ed;\n    }\n    @media (prefers-color-scheme: dark) {\n      :root {\n        --bg: #1c1917;\n        --fg: #f5f0e8;\n        --muted: #a8a29e;\n        --card: #292524;\n        --line: #44403c;\n        --accent: #fb923c;\n        --accent-fg: #1c1917;\n      }\n    }\n    * { box-sizing: border-box; }\n    body {\n      margin: 0;\n      min-height: 100vh;\n      font: 16px/1.5 ui-sans-serif, system-ui, sans-serif;\n      background: var(--bg);\n      color: var(--fg);\n    }\n    main {\n      max-width: 760px;\n      margin: 0 auto;\n      padding: 32px 20px 64px;\n    }\n    h1 { font-size: 1.6rem; margin: 0 0 8px; }\n    .lead { color: var(--muted); margin: 0 0 24px; }\n    form {\n      display: flex;\n      gap: 8px;\n      flex-wrap: wrap;\n      margin-bottom: 20px;\n    }\n    input[type="url"], input[type="text"] {\n      flex: 1 1 280px;\n      padding: 12px 14px;\n      border: 1px solid var(--line);\n      border-radius: 10px;\n      background: var(--card);\n      color: var(--fg);\n      font: inherit;\n    }\n    button, .btn {\n      appearance: none;\n      border: 0;\n      border-radius: 10px;\n      padding: 12px 18px;\n      background: var(--accent);\n      color: var(--accent-fg);\n      font: inherit;\n      font-weight: 600;\n      cursor: pointer;\n      text-decoration: none;\n      display: inline-block;\n    }\n    button:disabled { opacity: 0.6; cursor: wait; }\n    .card {\n      background: var(--card);\n      border: 1px solid var(--line);\n      border-radius: 16px;\n      padding: 20px;\n    }\n    video, img {\n      width: 100%;\n      max-height: 70vh;\n      border-radius: 12px;\n      background: #000;\n      object-fit: contain;\n    }\n    .gallery {\n      display: grid;\n      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));\n      gap: 10px;\n      margin-bottom: 16px;\n    }\n    .gallery img { max-height: 240px; }\n    .meta { margin: 16px 0; }\n    .meta h2 { font-size: 1.1rem; margin: 0 0 6px; }\n    .meta p { margin: 0; color: var(--muted); }\n    .stats {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 12px 18px;\n      margin: 12px 0 16px;\n      color: var(--muted);\n      font-size: 0.95rem;\n    }\n    .actions { display: flex; flex-wrap: wrap; gap: 8px; }\n    .error { color: #b91c1c; }\n    @media (prefers-color-scheme: dark) {\n      .error { color: #fca5a5; }\n    }\n    [hidden] { display: none !important; }\n  </style>\n</head>\n<body>\n  <main>\n    <h1>\u6296\u97F3\u65E0\u6C34\u5370\u89E3\u6790</h1>\n    <p class="lead">\u7C98\u8D34\u5206\u4EAB\u94FE\u63A5\uFF0C\u89E3\u6790\u89C6\u9891\u6216\u56FE\u6587\uFF0C\u5E76\u4E0B\u8F7D\u65E0\u6C34\u5370\u5185\u5BB9\u3002</p>\n    <form id="form">\n      <input id="url" type="text" name="url" required placeholder="https://v.douyin.com/xxxx/" autocomplete="off" />\n      <button type="submit" id="submit">\u89E3\u6790</button>\n    </form>\n    <p id="status" hidden></p>\n    <section id="result" class="card" hidden></section>\n  </main>\n  <script>\n    const form = document.getElementById("form");\n    const input = document.getElementById("url");\n    const submit = document.getElementById("submit");\n    const statusEl = document.getElementById("status");\n    const result = document.getElementById("result");\n\n    function setStatus(text, isError) {\n      statusEl.hidden = !text;\n      statusEl.textContent = text;\n      statusEl.className = isError ? "error" : "";\n    }\n\n    function escapeHtml(s) {\n      return String(s ?? "").replace(/[&<>"\']/g, (c) => ({\n        "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;", "\'": "&#39;"\n      }[c]));\n    }\n\n    function formatCount(n) {\n      if (n == null) return "-";\n      if (n >= 10000) return (n / 10000).toFixed(1).replace(/\\.0$/, "") + "\u4E07";\n      return String(n);\n    }\n\n    form.addEventListener("submit", async (e) => {\n      e.preventDefault();\n      const url = input.value.trim();\n      if (!url) return;\n      submit.disabled = true;\n      result.hidden = true;\n      result.innerHTML = "";\n      setStatus("\u89E3\u6790\u4E2D\u2026");\n      try {\n        const api = "/?data&url=" + encodeURIComponent(url);\n        const resp = await fetch(api);\n        const text = await resp.text();\n        let data;\n        try { data = JSON.parse(text); }\n        catch { throw new Error(text || "\u89E3\u6790\u5931\u8D25"); }\n        if (!data || (!data.video_url && !(data.image_url_list && data.image_url_list.length))) {\n          throw new Error(data && data.message ? data.message : "\u672A\u627E\u5230\u89C6\u9891\u6216\u56FE\u7247");\n        }\n        setStatus("");\n        const isVideo = data.type !== "img" && data.video_url;\n        const images = data.image_url_list || [];\n        let media = "";\n        if (isVideo) {\n          media = `<video controls playsinline referrerpolicy="no-referrer" src="${escapeHtml(data.video_url)}"></video>`;\n        } else {\n          media = `<div class="gallery">${images.map((src) =>\n            `<img src="${escapeHtml(src)}" alt="\u56FE\u6587" referrerpolicy="no-referrer" />`\n          ).join("")}</div>`;\n        }\n        const shareUrl = encodeURIComponent(url);\n        const downloadBtns = isVideo\n          ? `<a class="btn" href="/download?url=${shareUrl}" download>\u4E0B\u8F7D\u89C6\u9891</a>`\n          : images.map((_src, i) =>\n              `<a class="btn" href="/download?url=${shareUrl}&type=image&i=${i}" download>\u4E0B\u8F7D\u56FE\u7247 ${i + 1}</a>`\n            ).join("");\n        result.innerHTML = `\n          ${media}\n          <div class="meta">\n            <h2>${escapeHtml(data.desc || "\u65E0\u6807\u9898")}</h2>\n            <p>${escapeHtml(data.nickname || "\u672A\u77E5\u4F5C\u8005")}${data.signature ? " \xB7 " + escapeHtml(data.signature) : ""}</p>\n          </div>\n          <div class="stats">\n            <span>\u70B9\u8D5E ${formatCount(data.digg_count)}</span>\n            <span>\u8BC4\u8BBA ${formatCount(data.comment_count)}</span>\n            <span>\u6536\u85CF ${formatCount(data.collect_count)}</span>\n            <span>\u5206\u4EAB ${formatCount(data.share_count)}</span>\n            ${data.create_time ? `<span>${escapeHtml(data.create_time)}</span>` : ""}\n          </div>\n          <div class="actions">${downloadBtns}</div>\n        `;\n        result.hidden = false;\n      } catch (err) {\n        setStatus(err && err.message ? err.message : "\u89E3\u6790\u5931\u8D25", true);\n      } finally {\n        submit.disabled = false;\n      }\n    });\n  <\/script>\n</body>\n</html>\n';

// serve.ts
var SHARE_UA2 = "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36";
function asciiFilename(name, ext) {
  const base = name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "douyin";
  return `${base}.${ext}`;
}
async function proxyDownload(inputUrl, kind, index) {
  const info = await getVideoInfo(inputUrl);
  const target = kind === "image" ? info.image_url_list?.[index] : info.video_url;
  if (!target) {
    return new Response("\u672A\u627E\u5230\u53EF\u4E0B\u8F7D\u5185\u5BB9", {
      status: 404
    });
  }
  const upstream = await fetch(target, {
    headers: {
      "User-Agent": SHARE_UA2
    },
    redirect: "follow"
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("\u4E0B\u8F7D\u5931\u8D25", {
      status: 502
    });
  }
  const contentType = upstream.headers.get("content-type") || (kind === "image" ? "image/jpeg" : "video/mp4");
  const ext = kind === "image" ? contentType.includes("png") ? "png" : "jpg" : "mp4";
  const filename = asciiFilename(info.aweme_id || "douyin", ext);
  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("content-disposition", `attachment; filename="${filename}"`);
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  return new Response(upstream.body, {
    status: 200,
    headers
  });
}
var handler = async (req) => {
  console.log("Method:", req.method);
  const url = new URL(req.url);
  const isDownload = url.pathname === "/download" || url.searchParams.has("download");
  if (url.searchParams.has("url")) {
    const inputUrl = url.searchParams.get("url");
    console.log("inputUrl:", inputUrl);
    if (isDownload) {
      const kind = url.searchParams.get("type") === "image" ? "image" : "video";
      const index = Number(url.searchParams.get("i") || "0");
      return await proxyDownload(inputUrl, kind, Number.isFinite(index) ? index : 0);
    }
    if (url.searchParams.has("data")) {
      const videoInfo = await getVideoInfo(inputUrl);
      return new Response(JSON.stringify(videoInfo));
    }
    const videoUrl = await getVideoUrl(inputUrl);
    return new Response(videoUrl);
  } else {
    return new Response(pageHtml, {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  }
};

// cfworker.ts
var cfworker_default = {
  fetch: handler
};
export {
  cfworker_default as default
};
