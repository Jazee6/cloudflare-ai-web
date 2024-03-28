export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface OpenAIBody {
    model: string
    stream: boolean
    messages: OpenAIMessage[]
}

export interface OpenAIReq {
    model: string
    endpoint: string
    messages: OpenAIMessage[]
    key?: string
}

export interface OpenAIRes {
    choices: {
        index: number
        delta: {
            content?: string
        }
        finish_reason: 'stop' | null
    }[]
}

export interface WorkersBody {
    stream: boolean
    messages: OpenAIMessage[]
}

export interface WorkersReq {
    model: string
    messages: OpenAIMessage[]
}

export interface WorkersRes {
    response: string
}

export interface GeminiReq {
    model: string
    messages: OpenAIMessage[]
}