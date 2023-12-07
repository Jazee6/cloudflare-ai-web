import {eventStream} from "~/utils/req";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

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
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: [
                system,
                {role: 'user', content: prompt}
            ],
            model,
            stream: true,
            temperature: 0.5,
            presence_penalty: 0,
            frequency_penalty: 0,
            top_p: 1,
        }),
    })

    await eventStream(event, res)
})
