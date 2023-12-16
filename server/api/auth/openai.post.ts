import {stream} from "~/utils/req"

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    let {messages, model, endpoint = 'chat/completions'} = body
    let system = {
        role: 'system',
        content: 'You are ChatGPT, a large language model trained by OpenAI. Follow the user\'s instructions carefully. Respond using markdown.'
    }

    const res = await fetch(`${process.env.CF_GATEWAY}/openai/${endpoint}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: [
                system,
                ...messages
            ],
            model,
            stream: true,
            temperature: 0.8,
            presence_penalty: 0,
            frequency_penalty: 0,
            // top_p: 1,
        }),
    })

    return stream(res)
})
