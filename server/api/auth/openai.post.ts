import {stream} from "~/utils/req"

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    let {messages, model} = body
    let system = {
        role: 'system',
        content: 'You are ChatGPT, a large language model trained by OpenAI. Follow the user\'s instructions carefully. Respond using markdown.'
    }

    messages = [
        system,
        ...messages
    ]

    const res = await fetch(`${process.env.CF_GATEWAY}/openai/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages,
            model,
            stream: true,
            temperature: 0.8,
            presence_penalty: 0,
            frequency_penalty: 0,
            top_p: 1,
        }),
    })

    return stream(res)
})
