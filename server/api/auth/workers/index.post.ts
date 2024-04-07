import {handleErr, streamResponse, workersTextParser} from "~/utils/helper";
import {WorkersBody, WorkersReq} from "~/utils/types";

export default defineEventHandler(async (event) => {
    const body: WorkersReq = await readBody(event)
    const {model, messages} = body

    const workersBody: WorkersBody = {
        stream: true,
        messages,
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

    return streamResponse(res, workersTextParser)
})
