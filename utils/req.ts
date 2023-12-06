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

export const reqStream = async (path: string, body: Object, model: string,
                                onmessage: Function, onclose: Function) => {
    await fetchEventSource(`/api/${path}`, {
        method: 'POST',
        body: JSON.stringify({
            model,
            ...body
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