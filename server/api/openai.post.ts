export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    let {prompt, model} = body
    let system = {
        role: 'system',
        content: 'You are ChatGPT, a large language model trained by OpenAI. Follow the user\'s instructions carefully.'
    }

    const res = await fetch(`https://gateway.ai.cloudflare.com/v1/02742d0dc0f623b24977b1e8d7333bea/jaz/openai/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: [
                system,
                {role: 'user', content: prompt}
            ],
            model,
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
