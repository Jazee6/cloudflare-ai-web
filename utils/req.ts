import {createParser, type ParsedEvent, type ReconnectInterval} from "eventsource-parser";

export const req = (path: string, body: Object) => {
    return $fetch(`/api/auth/${path}`, {
        method: 'POST',
        body,
        headers: {
            Authorization: `${localStorage.getItem('access_pass')}`,
        },
        retry: false
    })
}

const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
}

export const stream = (res: Response, transform?: boolean) => {
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

    if (transform) return new Response(transformStream(readableStream), {headers})

    return new Response(readableStream, {
        headers
    })
}

export const reqStream = async (path: string, onStream: Function, body: object,
                                onDone?: Function, onError?: Function
) => {
    const response = await fetch(`/api/auth/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            Authorization: `${localStorage.getItem('access_pass')}`,
            'Content-Type': 'application/json'
        },
    })

    if (!response.ok) {
        onError && onError(response.status)
        console.error(response.statusText)
    }

    const data = response.body;
    if (!data) {
        return;
    }

    const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
            if (event.data === '[DONE]') return
            const text = JSON.parse(event.data) ?? ""
            onStream(text)
        }
    }

    const reader = data.getReader();
    const decoder = new TextDecoder();
    const parser = createParser(onParse);
    while (true) {
        const {value, done} = await reader.read();
        if (done) break
        const chunkValue = decoder.decode(value);
        parser.feed(chunkValue);
    }
    onDone && onDone()
}

const transformStream = (stream: ReadableStream) => {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const transformStream = new TransformStream({
        async transform(chunk, controller) {
            const data = decoder.decode(chunk);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        },
    });

    return stream.pipeThrough(transformStream);
}