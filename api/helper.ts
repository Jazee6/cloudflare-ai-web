import {getToken, isLogin} from "~/utils/tools";
import {useGlobalState} from "~/utils/store";

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
    const response = await fetch('/api' + path, {
        ...options,
        headers,
    })

    if (!response.ok) {
        if (response.status === 401 && response.statusText === 'password incorrect') {
            passModal.value = true
        }
        throw new Error(response.status + ' ' + response.statusText + ' ' + await response.text())
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