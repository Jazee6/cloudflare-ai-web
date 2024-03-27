import {handleErr, streamResponse, workersTextParser} from "~/server/utils/helper";
import {WorkersReq} from "~/server/utils/types";
import {WorkersBody} from "~/server/utils/types";

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