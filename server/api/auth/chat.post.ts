import {stream} from "~/utils/req";

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    let {messages, model} = body
    let system

    switch (model) {
        case '@cf/qwen/qwen1.5-14b-chat-awq':
            system = {role: 'system', content: '你是一个通用型人工智能，请帮助我解决问题，并使用Markdown格式回复。'}
            break
        default:
            system = {role: 'system', content: 'You are a friendly assistant. Respond using markdown.'}
    }

    const res = await fetch(`${process.env.CF_GATEWAY}/workers-ai/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CF_TOKEN}`,
        },
        body: JSON.stringify({
            messages: [
                system,
                ...messages
            ],
            stream: true,
        }),
    })

    return stream(res)
})
