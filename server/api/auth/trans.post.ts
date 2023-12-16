import type {TransReq} from "~/utils/type";

export default defineEventHandler(async (event) => {
    const body: TransReq = await readBody(event)
    return await $fetch(`${process.env.CF_GATEWAY}/workers-ai/${body.model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CF_TOKEN}`,
        },
        body: {
            text: body.text,
            source_lang: body.source_lang,
            target_lang: body.target_lang,
        },
    })
})
