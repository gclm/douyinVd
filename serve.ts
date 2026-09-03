import { getVideoUrl, getVideoInfo } from "./douyin.ts";
import { pageHtml } from "./page.ts";

const handler = async (req: Request) => {
    console.log("Method:", req.method);

    const url = new URL(req.url);
    if (url.searchParams.has("url")) {
        const inputUrl = url.searchParams.get("url")!;
        console.log("inputUrl:", inputUrl);
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
