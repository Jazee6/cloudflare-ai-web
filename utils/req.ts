import {fetchEventSource} from "@microsoft/fetch-event-source";

export interface openaiData {
    id: string;
    object: string;
    created: number;
    model: string;
    system_fingerprint?: any;
    choices: {
        index: number;
        delta: {
            content: string;
        }
        finish_reason?: any;
    }[];
}

export interface workersAiData {
    response: string;
}

export interface TransRes {
    result: {
        translated_text: string
    }
}

export interface HistoryItem {
    role: 'user' | 'assistant'
    content: string
    is_img?: boolean
}

export const reqStream = async (path: string, messages: Array<HistoryItem>, model: string,
                                onmessage: Function, onclose: Function) => {
    await fetchEventSource(`/api/${path}`, {
        method: 'POST',
        body: JSON.stringify({
            model,
            messages,
        }),
        headers: {
            'Content-Type': 'application/json'
        },
        onmessage: (e) => {
            if (e.data === '[DONE]') return
            const data = JSON.parse(e.data);
            onmessage(data)
        },
        onclose: () => {
            onclose()
        }
    })
}

export const req = async (path: string, model: string, body: Object) => {
    return await $fetch(`/api/${path}`, {
        method: 'POST',
        body: JSON.stringify({
            model,
            ...body
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    })
}

export const stream = (res: Response) => {
    // https://web.dev/articles/streams
    const readableStream = new ReadableStream({
        async start(controller) {

            if (res.status !== 200) {
                const data = {
                    status: res.status,
                    statusText: res.statusText,
                    body: await res.text(),
                }
                console.error(`Error: recieved non-200 status code, ${JSON.stringify(data)}`);
                controller.close();
                return;
            }

            for await (const chunk of res.body as any) {
                controller.enqueue(chunk);
            }

            controller.close();
        },
    });

    return new Response(readableStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}