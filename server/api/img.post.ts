const CF_TOKEN = process.env.CF_TOKEN

export const config = {
    runtime: 'edge',
};

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {model, ...rest} = body

    event.node.res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    })

    const interval = setInterval(() => {
        event.node.res.write(`data: ${JSON.stringify({response: 'pending'})}\n\n`)
    }, 5000)

    $fetch(`https://gateway.ai.cloudflare.com/v1/02742d0dc0f623b24977b1e8d7333bea/jaz/workers-ai/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${CF_TOKEN}`,
        },
        body: JSON.stringify(rest),
    }).then(async res => {
        clearInterval(interval)
        const base64 = Buffer.from(await (res as Blob).arrayBuffer()).toString('base64')
        event.node.res.write(`data: ${JSON.stringify({response: base64})}\n\n`)
        event.node.res.write(`data: [DONE]\n\n`)
        event.node.res.end()
    }).catch(() => {
        clearInterval(interval)
        event.node.res.write(`data: [DONE]\n\n`)
        event.node.res.end()
    })
})
