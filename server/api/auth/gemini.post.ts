import {GoogleGenerativeAI, HarmBlockThreshold, HarmCategory} from '@google/generative-ai'
import {headers} from '~/utils/helper';
import {OpenAIMessage} from "~/utils/types";

const genAI = new GoogleGenerativeAI(process.env.G_API_KEY!)

export default defineEventHandler(async (event) => {
    const body = await readFormData(event)
    const model = body.get('model') as string
    const messages: OpenAIMessage[] = JSON.parse(<string>body.get('messages'))
    const files = body.getAll('files') as File[]

    const m = genAI.getGenerativeModel({model})
    let msg = messages.slice(1)
    // let flag = ['user', 'assistant']
    // for (let i = 0; i < msg.length; i++) {
    //     if (msg[i].role !== flag[i % 2]) {
    //         flag = []
    //         break
    //     }
    // }
    // if (!flag.length) return new Response('对话失效，请重新开始对话', {status: 400})

    let res
    if (files.length) {
        const imageParts = await Promise.all(files.map(fileToGenerativePart))
        const prompt = msg.at(-1)
        if (prompt === undefined) {
            return new Response('对话失效，请重新开始对话', {status: 400})
        }
        res = await m.generateContentStream([prompt.content, ...imageParts])
    } else {
        const chat = m.startChat({
            history: msg.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : m.role === 'user' ? 'user' : 'function',
                parts: [{text: m.content}]
            }))
        })
        res = await chat.sendMessageStream(msg[msg.length - 1].content)
    }

    const textEncoder = new TextEncoder()
    const readableStream = new ReadableStream({
        async start(controller) {
            for await (const chunk of res.stream) {
                try {
                    controller.enqueue(textEncoder.encode(chunk.text()))
                } catch (e) {
                    console.error(e)
                    controller.enqueue(textEncoder.encode('已触发安全限制，请重新开始对话'))
                }
            }

            controller.close()
        }
    })

    return new Response(readableStream, {
        headers,
    })
})

async function fileToGenerativePart(file: File) {
    return {
        inlineData: {
            data: Buffer.from(await file.arrayBuffer()).toString('base64'),
            mimeType: file.type,
        },
    };
}