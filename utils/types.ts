export interface Model {
    id: string
    name: string
    provider: 'openai' | 'workers-ai' | 'google' | 'workers-ai-image'
    type: 'chat' | 'text-to-image' | 'universal'
    endpoint?: string
}

export interface HistoryItem {
    id?: number
    session: number
    type: 'text' | 'image' | 'image-prompt' | 'error'
    content: string
    role: 'user' | 'assistant'
    src?: Blob[]
    src_url?: string[]
    created_at: number
}

export interface TabItem {
    id?: number
    label: string
    created_at: number
}

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

export interface WorkersBodyImage {
    prompt: string
    num_steps?: number
}

export interface WorkersReq {
    model: string
    messages: OpenAIMessage[]
}

export interface WorkersReqImage {
    model: string
    messages: OpenAIMessage[]
    num_steps?: number
}

export interface WorkersRes {
    response: string
}

// export interface GeminiReq {
//     model: string
//     messages: OpenAIMessage[]
// }