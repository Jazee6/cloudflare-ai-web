import {eventStream} from "~/utils/req";

const CF_GATEWAY = process.env.CF_GATEWAY
const CF_TOKEN = process.env.CF_TOKEN

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

    const res = await fetch(`${CF_GATEWAY}/workers-ai/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${CF_TOKEN}`,
        },
        body: JSON.stringify({
            messages: [
                system,
                {role: 'user', content: prompt}
            ],
            stream: true,
        }),
    })
    await eventStream(event, res)
})
