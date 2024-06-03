import {createParser} from "eventsource-parser";
import {getToken, isLogin} from "~/utils/tools";
import {useGlobalState} from "~/utils/store";

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

export function imageResponse(res: Response) {
    return new Response(res.body, {
        headers: {
            'Content-Type': 'image/png',
        }
    })
}

export async function handleErr(res: Response) {
    const text = await res.text()
    console.error(res.status, res.statusText, text)
    return new Response(text, {
        status: res.status,
        statusText: res.statusText,
    })
}

const {passModal} = useGlobalState()

async function handleStream(data: ReadableStream, onStream: (data: string) => void, resolve: (value: unknown) => void) {
    const reader = data.getReader()
    const decoder = new TextDecoder()
    while (true) {
        const {value, done} = await reader.read()
        if (done) {
            resolve(null)
            break
        }
        onStream(decoder.decode(value))
    }
}

export async function basicFetch(
    path: string,
    options: RequestInit = {},
    onStream?: (data: string) => void,
) {
    const headers = new Headers(options.headers || {})
    if (isLogin()) {
        headers.set('Authorization', getToken()!)
    }
    const response = await fetch('/api/auth' + path, {
        ...options,
        headers,
    })

    if (!response.ok) {
        const text = await response.text()
        if (response.status === 401 && text === 'Password Incorrect') {
            passModal.value = true
        }
        throw new Error(response.status + ' ' + response.statusText + ' ' + text)
    }

    if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
        const body = response.body
        if (body === null) {
            throw new Error('Response body is null')
        }
        if (onStream) {
            return new Promise(resolve => {
                handleStream(body, onStream, resolve)
            })
        }
    }

    if (response.headers.get('Content-Type')?.includes('image')) {
        return await response.blob()
    }
}

export function streamFetch(path: string, body: Object, onStream: (data: string) => void) {
    return basicFetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }, onStream)
}

export function postFetch(path: string, body: Object) {
    return basicFetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })
}

export function streamFetchWithFile(path: string, body: FormData, onStream: (data: string) => void) {
    return basicFetch(path, {
        method: "POST",
        body,
    }, onStream)
}