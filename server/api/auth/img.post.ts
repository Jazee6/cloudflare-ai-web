export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {messages, model} = body

    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
        async start(controller) {
            const interval = setInterval(() => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({response: 'pending'})}\n\n`))
            }, 5000)

            const res = await $fetch(`${process.env.CF_GATEWAY}/workers-ai/${model}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.CF_TOKEN}`,
                },
                body: JSON.stringify({
                    prompt: messages[0].content,
                }),
            })

            const base64 = Buffer.from(await (res as Blob).arrayBuffer()).toString('base64')
            clearInterval(interval)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({response: base64})}\n\n`))
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
            controller.close()
        },
    });

    return new Response(readableStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
})
