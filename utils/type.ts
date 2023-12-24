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

export interface openaiReq {
    messages: HistoryItem[]
    model: string
    temperature?: number
    presence_penalty?: number
    frequency_penalty?: number,
    top_p?: number
}

export interface workersAiData {
    response: string;
}

export interface workersAiReq {
    messages: HistoryItem[]
    model: string
}

export interface TransRes {
    result: {
        translated_text: string
    }
}

export interface TransReq {
    model: string
    text: string
    source_lang: string
    target_lang: string
}

export interface imgData {
    response: string
}

export interface imgReq {
    messages: string
    model: string
}

interface Part {
    text: string;
}

interface Content {
    parts: Part[];
    role: string;
}

interface SafetyRating {
    category: string;
    probability: string;
}

interface Candidate {
    content: Content;
    finishReason: string;
    index: number;
    safetyRatings: SafetyRating[];
}

interface SafetyRating {
    category: string;
    probability: string;
}

interface PromptFeedback {
    safetyRatings: SafetyRating[];
}

interface gemini {
    candidates: Candidate[];
    promptFeedback: PromptFeedback;
}

export type geminiData = gemini

export interface geminiReq {
    contents: {
        role: 'user' | 'model'
        parts: {
            text: string
        }[]
    }[]
}

export interface HistoryItem {
    role: 'user' | 'assistant'
    content: string
    is_img?: boolean
}

export interface Tab {
    id: number,
    content: string
}

export interface HistoryDB {
    id: number,
    session: number,
    role: 'user' | 'assistant'
    content: string
    is_img?: boolean
}

export interface GeminiReq {
    history: {
        role: 'user' | 'model'
        parts: string
    }[]
    msg: string
}