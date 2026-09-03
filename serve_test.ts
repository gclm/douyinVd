import { assertEquals, assertStringIncludes } from "@std/assert";
import { handler } from "./serve.ts";

const originalFetch = globalThis.fetch;
const originalLog = console.log;

function restore() {
  globalThis.fetch = originalFetch;
  console.log = originalLog;
}

function silenceLogs() {
  console.log = () => {};
}

const PLAY_URI = "v1e00fgi0000da28itnog65krn9dchtg";
const EXPECTED_VIDEO_URL =
  `https://www.iesdouyin.com/aweme/v1/play/?video_id=${PLAY_URI}&ratio=1080p&line=0`;
const DETAIL_JSON = JSON.stringify({
  status_code: 0,
  aweme_detail: {
    aweme_id: "7675412388233414629",
    desc: "title",
    create_time: 1700000000,
    author: { nickname: "alice", signature: "sig" },
    statistics: {
      aweme_id: "7675412388233414629",
      comment_count: 1,
      digg_count: 2,
      share_count: 3,
      collect_count: 4,
    },
    video: { play_addr: { uri: PLAY_URI } },
  },
});

Deno.test("GET / returns the usage page", async () => {
  silenceLogs();
  try {
    const resp = await handler(new Request("https://example.com/"));
    const html = await resp.text();
    assertEquals(resp.status, 200);
    assertStringIncludes(
      resp.headers.get("content-type") ?? "",
      "text/html",
    );
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "解析");
    assertStringIncludes(html, 'id="url"');
  } finally {
    restore();
  }
});

Deno.test("GET /?url= still returns the play URL", async () => {
  silenceLogs();
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(DETAIL_JSON, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  try {
    const resp = await handler(
      new Request(
        "https://example.com/?url=" +
          encodeURIComponent("https://www.douyin.com/video/7675412388233414629"),
      ),
    );
    assertEquals(await resp.text(), EXPECTED_VIDEO_URL);
  } finally {
    restore();
  }
});

Deno.test("GET /?data&url= still returns JSON", async () => {
  silenceLogs();
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(DETAIL_JSON, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  try {
    const resp = await handler(
      new Request(
        "https://example.com/?data&url=" +
          encodeURIComponent("https://www.douyin.com/video/7675412388233414629"),
      ),
    );
    const info = JSON.parse(await resp.text());
    assertEquals(info.video_url, EXPECTED_VIDEO_URL);
    assertEquals(info.nickname, "alice");
    assertEquals(info.type, "video");
  } finally {
    restore();
  }
});

Deno.test("usage page is not served when url param is present", async () => {
  silenceLogs();
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(DETAIL_JSON, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  try {
    const resp = await handler(
      new Request(
        "https://example.com/?url=" +
          encodeURIComponent("https://www.douyin.com/video/7675412388233414629"),
      ),
    );
    const text = await resp.text();
    assertEquals(text.includes("<!DOCTYPE html>"), false);
    assertEquals(text, EXPECTED_VIDEO_URL);
  } finally {
    restore();
  }
});
