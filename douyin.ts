const cVUrl =
  "https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0";

const DETAIL_UA =
  "Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)";
const SHARE_UA =
  "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36";

interface DouyinVideoInfo {
  // ID
  aweme_id: string | null;
  // 评论数
  comment_count: number | null;
  // 点赞数
  digg_count: number | null;
  // 分享数
  share_count: number | null;
  // 收藏数
  collect_count: number | null;
  // 作者昵称
  nickname: string | null;
  // 作者签名
  signature: string | null;
  // 标题
  desc: string | null;
  // 创建时间
  create_time: string | null;
  // 视频链接
  video_url: string | null;
  // 类型
  type: string | null;
  // 图片链接列表
  image_url_list: string[] | null;
}

interface AwemeDetail {
  aweme_id?: string;
  desc?: string;
  create_time?: number;
  aweme_type?: number;
  author?: { nickname?: string; signature?: string };
  statistics?: {
    aweme_id?: string;
    comment_count?: number;
    digg_count?: number;
    share_count?: number;
    collect_count?: number;
  };
  video?: { play_addr?: { uri?: string; url_list?: string[] } };
  images?: Array<{ url_list?: string[]; download_url_list?: string[] }>;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function doGet(url: string, ua = SHARE_UA): Promise<Response> {
  const headers = new Headers();
  headers.set("User-Agent", ua);
  if (ua === DETAIL_UA) {
    headers.set("Referer", "https://www.douyin.com/");
  }
  return await fetch(url, { method: "GET", headers });
}

function extractAwemeIdFromText(text: string): string | null {
  const patterns = [
    /\/(?:share\/)?(?:video|note)\/(\d{8,})/,
    /\/modal_id=(\d{8,})/,
    /"itemId"\s*:\s*"(\d+)"/,
    /itemId["']?\s*:\s*["']?(\d{8,})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function resolveAwemeId(url: string): Promise<string> {
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

function parseImgListFromDetail(images: AwemeDetail["images"]): string[] {
  if (!images?.length) return [];
  const urls: string[] = [];
  for (const image of images) {
    const list = image.download_url_list?.length
      ? image.download_url_list
      : image.url_list || [];
    const chosen = list.find((u) => !u.includes("/obj/")) ?? list[0];
    if (chosen) urls.push(chosen);
  }
  return urls.filter((url) => !url.includes("/obj/"));
}

async function fetchAwemeDetail(awemeId: string): Promise<AwemeDetail> {
  const detailUrl =
    `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${awemeId}&aid=6383&device_platform=webapp`;
  let lastError = "No video or image content found in the response.";
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await doGet(detailUrl, DETAIL_UA);
    const text = await resp.text();
    try {
      const payload = JSON.parse(text) as {
        aweme_detail?: AwemeDetail;
        status_code?: number;
      };
      if (payload.aweme_detail) return payload.aweme_detail;
      lastError = "No video or image content found in the response.";
    } catch {
      lastError = "No video or image content found in the response.";
    }
  }
  throw new Error(lastError);
}

function toVideoInfo(detail: AwemeDetail): DouyinVideoInfo {
  const playUri = detail.video?.play_addr?.uri || "";
  const image_url_list = parseImgListFromDetail(detail.images);
  const type = playUri ? "video" : "img";
  const video_url = playUri ? cVUrl.replace("%s", playUri) : "";

  if (!video_url && image_url_list.length === 0) {
    throw new Error("No video or image content found in the response.");
  }

  const stats = detail.statistics;
  const createTime = detail.create_time
    ? formatDate(new Date(detail.create_time * 1000))
    : null;

  const douyinVideoInfo: DouyinVideoInfo = {
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
    image_url_list,
  };
  console.log(douyinVideoInfo);
  return douyinVideoInfo;
}

async function getVideoInfo(url: string): Promise<DouyinVideoInfo> {
  const awemeId = await resolveAwemeId(url);
  const detail = await fetchAwemeDetail(awemeId);
  return toVideoInfo(detail);
}

async function getVideoId(url: string): Promise<string> {
  const info = await getVideoInfo(url);
  const id = info.video_url?.match(/video_id=([^&]+)/)?.[1];
  if (!id) throw new Error("Video ID not found in URL");
  return id;
}

async function getVideoUrl(url: string): Promise<string> {
  const info = await getVideoInfo(url);
  if (!info.video_url) throw new Error("Video ID not found in URL");
  return info.video_url;
}

export { getVideoUrl, getVideoInfo };
