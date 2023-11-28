export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {prompt} = body
    const {model} = body
    return await $fetch(`https://gateway.ai.cloudflare.com/v1/02742d0dc0f623b24977b1e8d7333bea/jaz/workers-ai/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CF_TOKEN}`,
        },
        body: JSON.stringify({
            prompt,
        }),
    })
})
