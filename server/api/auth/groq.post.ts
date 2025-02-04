import {handleErr, openaiParser, streamResponse} from "~/utils/helper";
import {OpenAIBody, OpenAIReq} from "~/utils/types";

export default defineEventHandler(async (event) => {
    const body: OpenAIReq = await readBody(event);
    const {model, messages, key, endpoint} = body;

    const openAIBody: OpenAIBody = {
        stream: true,
        model,
        messages,
    };

    const apiUrl = process.env.GROQ_API_URL ?
        `${process.env.GROQ_API_URL}` :
        `https://api.groq.com/openai/v1/chat/completions`;

    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            Authorization: key === undefined ? `Bearer ${process.env.GROQ_API_KEY}` : `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(openAIBody),
    });

    if (!res.ok) {
        return handleErr(res);
    }

    return streamResponse(res, openaiParser);
});
