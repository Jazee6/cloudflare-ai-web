export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {model, ...rest} = body
    return await $fetch(`${process.env.CF_GATEWAY}/workers-ai/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CF_TOKEN}`,
        },
        body: JSON.stringify(rest),
    })
})
