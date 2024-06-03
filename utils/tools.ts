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

export const scrollStream = (el: HTMLElement, distance: number = 200) => {
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
    const content = JSON.parse(localStorage.getItem('settings') || '{}').system_prompt || 'You are ChatGPT, a large language model trained by OpenAI. Follow the user\'s instructions carefully. Respond using markdown.'
    const p: OpenAIMessage = {
        role: 'system',
        content
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

export function handleImgZoom(img: HTMLImageElement) {
    const container = document.createElement('div')
    container.style.cssText = `
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.3s;
    opacity: 0;
    z-index: 9999;
  `
    const imgZoom = document.createElement('img')
    imgZoom.src = img.src
    const screenW = screen.width
    imgZoom.style.cssText = `
        width: ${screenW > 768 ? '85%' : '100%'};
        height: ${screenW > 768 ? '85%' : '100%'};
        object-fit: contain;
    `
    container.appendChild(imgZoom)
    document.body.appendChild(container)
    container.addEventListener('click', () => {
        container.style.opacity = '0'
        setTimeout(() => {
            document.body.removeChild(container)
        }, 300)
    })

    imgZoom.height
    container.style.opacity = '1'
}