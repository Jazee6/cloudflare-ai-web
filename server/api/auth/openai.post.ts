import { handleErr, openaiParser, streamResponse } from "~/utils/helper";
import { OpenAIBody, OpenAIReq } from "~/utils/types";

export default defineEventHandler(async (event) => {
    const body: OpenAIReq = await readBody(event);
    const { model, messages, key } = body;

    const openAIBody: OpenAIBody = {
        stream: true,
        model, // 使用传入的模型参数
        messages,
    };

    // 检查是否提供了自定义的 OPENAI_API_URL
    const apiUrl = process.env.OPENAI_API_URL ? 
        `${process.env.OPENAI_API_URL}/v1/chat/completions` : 
        `${process.env.CF_GATEWAY}/openai/${endpoint}`; 

    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            Authorization: key === undefined ? `Bearer ${process.env.OPENAI_API_KEY}` : `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(openAIBody),
    });

    if (!res.ok) {
        return handleErr(res);
    }

    return streamResponse(res, openaiParser);
});
