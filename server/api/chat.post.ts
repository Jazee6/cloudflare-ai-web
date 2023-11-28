export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {prompt} = body
    return await $fetch('https://gateway.ai.cloudflare.com/v1/02742d0dc0f623b24977b1e8d7333bea/jaz/workers-ai/@hf/thebloke/llama-2-13b-chat-awq', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CF_TOKEN}`,
        },
        body: JSON.stringify({
            prompt,
        }),
    })
})
