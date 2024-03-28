import {OpenAIRes, WorkersRes} from "~/server/utils/types";
import {createParser} from "eventsource-parser";

export const headers = {
    'Content-Type': 'text/event-stream',
} as const

export function streamResponse(res: Response, parser: (chunk: string) => string) {
    const textDecoder = new TextDecoder()
    const textEncoder = new TextEncoder()

    const readableStream = new ReadableStream({
        async start(controller) {
            const parserStream = createParser((event) => {
                if (event.type === "event") {
                    if (event.data === '[DONE]') {
                        parserStream.reset()
                        return
                    }
                    const parsed = parser(event.data)
                    controller.enqueue(textEncoder.encode(parsed))
                }
            })

            for await (const chunk of res.body as any) {
                parserStream.feed(textDecoder.decode(chunk))
            }
            controller.close()
        },
    });

    return new Response(readableStream, {
        headers
    })
}

export function openaiParser(chunk: string) {
    const data: OpenAIRes = JSON.parse(chunk)
    return data.choices[0].delta.content ?? ''
}

export function workersTextParser(chunk: string) {
    const data: WorkersRes = JSON.parse(chunk)
    return data.response
}

export async function handleErr(res: Response) {
    const text = await res.text()
    console.error(res.status, res.statusText, text)
    return new Response(text, {
        status: res.status,
        statusText: res.statusText,
    })
}