import {streamFetch} from "~/api/helper";
import type {OpenAIReq, WorkersReq} from "~/server/utils/types";

export function openAIReq(req: OpenAIReq, onStream: (data: unknown) => void) {
    return streamFetch('/auth/openai', req, onStream)
}

export function workersReq(req: WorkersReq, onStream: (data: unknown) => void) {
    return streamFetch('/auth/workers', req, onStream)
}
