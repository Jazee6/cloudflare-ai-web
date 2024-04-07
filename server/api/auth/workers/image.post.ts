import {handleErr, imageResponse} from "~/utils/helper";
import {WorkersBodyImage, WorkersReqImage} from "~/utils/types";

export default defineEventHandler(async (event) => {
    const body: WorkersReqImage = await readBody(event)
    const {model, messages, num_steps} = body

    const workersBody: WorkersBodyImage = {
        prompt: messages[0].content,
        num_steps
    }

    const res = await fetch(`${process.env.CF_GATEWAY}/workers-ai/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CF_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(workersBody)
    })

    if (!res.ok) {
        return handleErr(res)
    }

    return imageResponse(res)
})