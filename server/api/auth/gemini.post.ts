import {stream} from '~/utils/req';

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const {messages} = body

    const res = await fetch(`https://api.ai.openhole.top/v1beta/models/gemini-pro:streamGenerateContent?key=${process.env.G_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: messages
                        }
                    ]
                }
            ]
        }),
    })

    return stream(res, true);
})