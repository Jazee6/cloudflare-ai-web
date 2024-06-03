import {streamFetchWithFile} from "~/utils/helper";

export function openAIReq(req: OpenAIReq, onStream: (data: unknown) => void) {
    return streamFetch('/openai', req, onStream)
}

export function workersReq(req: WorkersReq, onStream: (data: unknown) => void) {
    return streamFetch('/workers', req, onStream)
}

export function workersImageReq(req: WorkersReqImage) {
    return postFetch('/workers/image', req)
}

export function geminiReq(req: FormData, onStream: (data: unknown) => void) {
    return streamFetchWithFile('/gemini', req, onStream)
}