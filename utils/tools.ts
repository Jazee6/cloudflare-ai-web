import {useThrottleFn} from "@vueuse/shared";

const TOKEN_KEY = 'access_pass'

export const isLogin = () => {
    return !!localStorage.getItem(TOKEN_KEY)
}

export const getToken = () => {
    return localStorage.getItem(TOKEN_KEY)
}

export const setToken = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
}

export const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
}

export const scrollStream = (el: HTMLElement, distance: number = 100) => {
    useThrottleFn(() => {
        (el.scrollTop + el.clientHeight >= el.scrollHeight - distance) && el.scrollTo({
            top: el.scrollHeight,
            behavior: 'smooth'
        })
    }, 500)()
}

export function scrollToTop(el: HTMLElement | null) {
    el?.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth'
    })
}

export function getSystemPrompt() {
    const p: OpenAIMessage = {
        role: 'system',
        content: 'You are ChatGPT, a large language model trained by OpenAI. Follow the user\'s instructions carefully. Respond using markdown.'
    }
    return p
}

export function getMessages(history: HistoryItem[], options?: {
    addHistory: boolean,
    type: Model['type']
}) {
    if (options?.type === 'text-to-image') {
        return [{
            role: history[history.length - 2].role,
            content: history[history.length - 2].content
        }]
    }
    if (options?.addHistory)
        return [
            getSystemPrompt()
        ].concat(history.slice(0, -1).filter(i => i.type === 'text').map((item) => {
            return {
                role: item.role,
                content: item.content
            }
        }))
    else
        return [
            getSystemPrompt()
        ].concat({
            role: history[history.length - 2].role,
            content: history[history.length - 2].content
        })
}