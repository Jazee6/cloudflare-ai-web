import {GenerateContentStreamResult, GoogleGenerativeAI} from '@google/generative-ai'
import type {GeminiReq, VisionReq} from "~/utils/type";

const genAI = new GoogleGenerativeAI(process.env.G_API_KEY!);

const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
}

export default defineEventHandler(async (event) => {
    const model = getQuery(event).model as string
    let result: GenerateContentStreamResult

    if (model === 'gemini-pro') {
        const body: GeminiReq = await readBody(event)
        const {history, msg} = body
        const m = genAI.getGenerativeModel({model});
        const chat = m.startChat({
            history,
        })
        result = await chat.sendMessageStream(msg)
    } else if (model === 'gemini-pro-vision') {
        const formData = await readFormData(event)
        const prompt = formData.get('prompt') as string
        const images = formData.getAll('images') as File[]

        const imageParts: VisionReq[] = []
        for (const image of images) {
            imageParts.push({
                inlineData: {
                    data: Buffer.from(await image.arrayBuffer()).toString('base64'),
                    mimeType: image.type
                }
            })
        }

        const m = genAI.getGenerativeModel({model});
        result = await m.generateContentStream([prompt, ...imageParts])
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
        async start(controller) {

            for await (const chunk of result.stream) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk.text())}\n\n`));
            }
            controller.enqueue(`${encoder.encode('data: [DONE]')}\n\n`)
            controller.close();
        },
    });
    return new Response(readableStream, {headers})
})