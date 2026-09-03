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

// serve.ts
var handler = async (req) => {
  console.log("Method:", req.method);
  const url = new URL(req.url);
  if (url.searchParams.has("url")) {
    const inputUrl = url.searchParams.get("url");
    console.log("inputUrl:", inputUrl);
    if (url.searchParams.has("data")) {
      const videoInfo = await getVideoInfo(inputUrl);
      return new Response(JSON.stringify(videoInfo));
    }
    const videoUrl = await getVideoUrl(inputUrl);
    return new Response(videoUrl);
  } else {
    return new Response("\u8BF7\u63D0\u4F9Burl\u53C2\u6570");
  }
};

// cfworker.ts
var cfworker_default = {
  fetch: handler
};
export {
  cfworker_default as default
};
