export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {prompt, model} = body
    const res = await fetch(`https://gateway.ai.cloudflare.com/v1/02742d0dc0f623b24977b1e8d7333bea/jaz/workers-ai/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CF_TOKEN}`,
        },
        body: JSON.stringify({
            messages: [
                {role: 'system', content: 'You are a friendly assistant'},
                {role: 'user', content: prompt}
            ],
            stream: true,
        }),
    })
    event.node.res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    })
    if (res.body) {
        const reader = res.body.getReader()
        while (true) {
            const {done, value} = await reader.read()
            if (done) break
            event.node.res.write(value)
        }
        event.node.res.end()
    }
})
