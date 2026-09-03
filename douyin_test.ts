import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { getVideoInfo, getVideoUrl } from "./douyin.ts";

const originalFetch = globalThis.fetch;
const originalLog = console.log;

type StubCall = { url: string; headers: Record<string, string> };

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  const rec: Record<string, string> = {};
  if (!headers) return rec;
  const h = new Headers(headers);
  h.forEach((value, key) => {
    rec[key.toLowerCase()] = value;
  });
  return rec;
}

function restore() {
  globalThis.fetch = originalFetch;
  console.log = originalLog;
}

function silenceLogs() {
  console.log = () => {};
}

const AWEME_ID = "7675412388233414629";
const PLAY_URI = "v1e00fgi0000da28itnog65krn9dchtg";
const EXPECTED_VIDEO_URL =
  `https://www.iesdouyin.com/aweme/v1/play/?video_id=${PLAY_URI}&ratio=1080p&line=0`;
const SHARE_HTML =
  `<html><script>window._ROUTER_DATA = {"loaderData":{"video_(id)/page":{"itemId":"${AWEME_ID}"}}}</script></html>`;
const NOTE_HTML =
  `<html><script>window._ROUTER_DATA = {"loaderData":{"note_(id)/page":{"itemId":"111"}}}</script></html>`;

const DETAIL_JSON = JSON.stringify({
  status_code: 0,
  aweme_detail: {
    aweme_id: AWEME_ID,
    desc: "贝利亚就该拿红！！",
    create_time: 1787071207,
    aweme_type: 0,
    author: { nickname: "年安安", signature: "要不要听我的小鸡说话" },
    statistics: {
      aweme_id: AWEME_ID,
      comment_count: 1750,
      digg_count: 170945,
      share_count: 16616,
      collect_count: 2133,
    },
    video: {
      play_addr: { uri: PLAY_URI, url_list: ["https://v.example/play.mp4"] },
    },
  },
});

const IMAGE_DETAIL_JSON = JSON.stringify({
  status_code: 0,
  aweme_detail: {
    aweme_id: "111",
    desc: "图文",
    create_time: 1700000000,
    aweme_type: 68,
    author: { nickname: "bob", signature: "sig" },
    statistics: {
      aweme_id: "111",
      comment_count: 1,
      digg_count: 2,
      share_count: 3,
      collect_count: 4,
    },
    images: [
      {
        uri: "tos-cn-i-0813/abc",
        url_list: ["https://p3-sign.douyinpic.com/tos-cn-i-0813/abc~tplv.jpeg"],
      },
      {
        uri: "tos-cn-i-0813/objskip",
        url_list: ["https://p3-sign.douyinpic.com/obj/tos-cn-i-0813/skip.jpeg"],
      },
    ],
  },
});

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubSequence(
  handlers: Array<(url: string) => Response | Promise<Response>>,
): StubCall[] {
  const calls: StubCall[] = [];
  let i = 0;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: headersToRecord(init?.headers) });
    const handler = handlers[Math.min(i, handlers.length - 1)];
    i++;
    return Promise.resolve(handler(url));
  };
  return calls;
}

Deno.test("extracts aweme_id from share page URL then parses JSON detail", async () => {
  silenceLogs();
  const calls = stubSequence([
    () => new Response(SHARE_HTML, { status: 200 }),
    () => jsonResponse(DETAIL_JSON),
  ]);
  try {
    const info = await getVideoInfo("https://v.douyin.com/7ebZCGhzEk0/");
    assertEquals(info.video_url, EXPECTED_VIDEO_URL);
    assertEquals(info.type, "video");
    assertEquals(info.aweme_id, AWEME_ID);
    assertEquals(info.nickname, "年安安");
    assertEquals(info.signature, "要不要听我的小鸡说话");
    assertEquals(info.desc, "贝利亚就该拿红！！");
    assertEquals(info.comment_count, 1750);
    assertEquals(info.digg_count, 170945);
    assertEquals(info.share_count, 16616);
    assertEquals(info.collect_count, 2133);
    assertEquals(info.image_url_list, []);
    assertStringIncludes(calls[1].url, `/aweme/v1/web/aweme/detail/`);
    assertStringIncludes(calls[1].url, `aweme_id=${AWEME_ID}`);
    assertStringIncludes(
      calls[1].headers["user-agent"] ?? "",
      "bingbot",
    );
    assertEquals(calls[1].headers["referer"], "https://www.douyin.com/");
  } finally {
    restore();
  }
});

Deno.test("parses www.douyin.com/video URLs without a share redirect", async () => {
  silenceLogs();
  const calls = stubSequence([
    () => jsonResponse(DETAIL_JSON),
  ]);
  try {
    const url = await getVideoUrl(
      `https://www.douyin.com/video/${AWEME_ID}`,
    );
    assertEquals(url, EXPECTED_VIDEO_URL);
    assertEquals(calls.length, 1);
    assertStringIncludes(calls[0].url, `/aweme/v1/web/aweme/detail/`);
    assertStringIncludes(calls[0].url, `aweme_id=${AWEME_ID}`);
  } finally {
    restore();
  }
});


Deno.test("parses image posts from aweme_detail.images", async () => {
  silenceLogs();
  stubSequence([
    () => new Response(NOTE_HTML, { status: 200 }),
    () => jsonResponse(IMAGE_DETAIL_JSON),
  ]);
  try {
    const info = await getVideoInfo("https://v.douyin.com/img/");
    assertEquals(info.type, "img");
    assertEquals(info.video_url, "");
    assertEquals(info.image_url_list, [
      "https://p3-sign.douyinpic.com/tos-cn-i-0813/abc~tplv.jpeg",
    ]);
    assertEquals(info.nickname, "bob");
    assertEquals(info.aweme_id, "111");
  } finally {
    restore();
  }
});

Deno.test("retries detail fetch when the first response is blocked", async () => {
  silenceLogs();
  const calls = stubSequence([
    () => new Response(SHARE_HTML, { status: 200 }),
    () =>
      new Response("Blocked by ArgusSecurityPlugin Uifid Not Found", {
        status: 403,
      }),
    () => jsonResponse(DETAIL_JSON),
  ]);
  try {
    const info = await getVideoInfo("https://v.douyin.com/7ebZCGhzEk0/");
    assertEquals(info.video_url, EXPECTED_VIDEO_URL);
    assertEquals(
      calls.filter((c) => c.url.includes("/aweme/v1/web/aweme/detail/")).length,
      2,
    );
  } finally {
    restore();
  }
});

Deno.test("throws when JSON detail has neither video nor images", async () => {
  silenceLogs();
  stubSequence([
    () => new Response(SHARE_HTML, { status: 200 }),
    () =>
      jsonResponse(
        JSON.stringify({ status_code: 0, aweme_detail: { aweme_id: AWEME_ID } }),
      ),
  ]);
  try {
    await assertRejects(
      () => getVideoInfo("https://v.douyin.com/fake"),
      Error,
      "No video or image content found in the response.",
    );
  } finally {
    restore();
  }
});
