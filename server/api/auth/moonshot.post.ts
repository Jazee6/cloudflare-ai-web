import {handleErr, openaiParser, streamResponse} from "~/utils/helper";
import {OpenAIBody, OpenAIReq} from "~/utils/types";

export default defineEventHandler(async (event) => {
    const body: OpenAIReq = await readBody(event)
    const {model, endpoint, messages, key} = body

    const openAIBody: OpenAIBody = {
        stream: true,
        model,
        messages,
    }

    const res = await fetch(`https://api.moonshot.cn/${endpoint}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(openAIBody),
    })

    if (!res.ok) {
        return handleErr(res)
    }

    return streamResponse(res, openaiParser)
})