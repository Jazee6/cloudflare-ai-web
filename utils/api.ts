import {postFetch, streamFetch} from "~/utils/helper";
import type {WorkersReqImage} from "~/utils/types";

export function openAIReq(req: OpenAIReq, onStream: (data: unknown) => void) {
    return streamFetch('/openai', req, onStream)
}

export function workersReq(req: WorkersReq, onStream: (data: unknown) => void) {
    return streamFetch('/workers', req, onStream)
}

export function workersImageReq(req: WorkersReqImage) {
    return postFetch('/workers/image', req)
}

export function geminiReq(req: GeminiReq, onStream: (data: unknown) => void) {
    return streamFetch('/gemini', req, onStream)
}