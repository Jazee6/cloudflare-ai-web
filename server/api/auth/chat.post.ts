import {stream} from "~/utils/req";

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    let {messages, model} = body
    let system

    if (model === '@hf/thebloke/codellama-7b-instruct-awq') {
        system = {
            role: 'system',
            content: 'Write code to solve the following coding problem that obeys the constraints and passes the example test cases. Please wrap your code answer using ```.'
        }
    } else system = {role: 'system', content: 'You are a friendly assistant. Respond using markdown.'}

    messages = [
        system,
        ...messages
    ]

    const res = await fetch(`${process.env.CF_GATEWAY}/workers-ai/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.CF_TOKEN}`,
        },
        body: JSON.stringify({
            messages,
            stream: true,
        }),
    })

    return stream(res)
})
