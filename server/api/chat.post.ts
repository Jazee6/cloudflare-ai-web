export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    let {prompt, model} = body
    let system
    if (model === '@hf/thebloke/codellama-7b-instruct-awq') {
        system = {
            role: 'system',
            content: 'Write code to solve the following coding problem that obeys the constraints and passes the example test cases. Please wrap your code answer using ```.'
        }
    } else system = {role: 'system', content: 'You are a friendly assistant'}

    let provider
    if (model === 'gpt-3.5-turbo') {
        provider = 'openai'
        model = 'chat/completions'
    } else provider = 'workers-ai'

    const res = await fetch(`https://gateway.ai.cloudflare.com/v1/02742d0dc0f623b24977b1e8d7333bea/jaz/${provider}/${model}`, {
        method: 'POST',
        headers: {
            Authorization: provider === 'openai' ? `Bearer ${process.env.OPENAI_API_KEY}` : `Bearer ${process.env.CF_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: [
                system,
                {role: 'user', content: prompt}
            ],
            model: provider === 'openai' ? 'gpt-3.5-turbo' : '',
            stream: true,
        }),
    })
    console.log(res)
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
