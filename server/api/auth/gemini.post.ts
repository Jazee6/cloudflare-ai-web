import {GoogleGenerativeAI} from '@google/generative-ai'
import type {GeminiReq} from "~/utils/type";

const genAI = new GoogleGenerativeAI(process.env.G_API_KEY!);

const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
}

export default defineEventHandler(async (event) => {
    const body: GeminiReq = await readBody(event)
    const {history, msg} = body

    const model = genAI.getGenerativeModel({model: "gemini-pro"});

    const chat = model.startChat({
        history,
    })

    const result = await chat.sendMessageStream(msg)

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