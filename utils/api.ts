import {streamFetch} from "~/utils/helper";

export function openAIReq(req: OpenAIReq, onStream: (data: unknown) => void) {
    return streamFetch('/auth/openai', req, onStream)
}

export function workersReq(req: WorkersReq, onStream: (data: unknown) => void) {
    return streamFetch('/auth/workers', req, onStream)
}

export function geminiReq(req: GeminiReq, onStream: (data: unknown) => void) {
    return streamFetch('/auth/gemini', req, onStream)
}