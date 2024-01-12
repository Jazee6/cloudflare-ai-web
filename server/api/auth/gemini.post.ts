import {GenerateContentStreamResult, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory} from '@google/generative-ai'
import type {GeminiReq, VisionReq} from "~/utils/type";

const genAI = new GoogleGenerativeAI(process.env.G_API_KEY!);

const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
}

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    }
]

export default defineEventHandler(async (event) => {
    const model = getQuery(event).model as string
    let result: GenerateContentStreamResult

    if (model === 'gemini-pro') {
        const body: GeminiReq = await readBody(event)
        const {history, msg, safeReply} = body
        let modelParams
        safeReply ? modelParams = {model} : modelParams = {model, safetySettings}
        const m = genAI.getGenerativeModel(modelParams);
        const chat = m.startChat({
            history,
        })
        result = await chat.sendMessageStream(msg)
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
        async start(controller) {
            if (model === 'gemini-pro-vision') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({response: 'pending'})}\n\n`));

                const multipartFormData = await readMultipartFormData(event)

                let prompt, modelParams
                const imageParts: VisionReq[] = []
                multipartFormData?.map(d => {
                    switch (d.name) {
                        case 'prompt':
                            prompt = d.data.toString()
                            break;

                        case 'images':
                            imageParts.push({
                                inlineData: {
                                    data: d.data.toString('base64'),
                                    mimeType: d.type!
                                }
                            })
                            break;

                        case 'safeReply':
                            d.data.toString() === 'true' ? modelParams = {model} : modelParams = {model, safetySettings}
                            break
                    }
                })
                const m = genAI.getGenerativeModel(modelParams!);
                if (prompt) {
                    result = await m.generateContentStream([prompt, ...imageParts])
                }
            }

            for await (const chunk of result.stream) {
                let res
                try {
                    res = chunk.text()
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(res)}\n\n`));
                } catch (e) {
                    console.error(e)
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({error: e})}\n\n`))
                }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close();
        },
    });
    return new Response(readableStream, {headers})
})
