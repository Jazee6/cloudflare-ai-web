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

const fileToDataURL = (file: Blob): Promise<any> => {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = (e) => resolve((e.target as FileReader).result)
        reader.readAsDataURL(file)
    })
}

const dataURLToImage = (dataURL: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.src = dataURL
    })
}

const canvastoFile = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> => {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality))
}

export const compressionFile = async (file: File, type: string, quality = 0.2) => {
    const fileName = file.name
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    const base64 = await fileToDataURL(file)
    const img = await dataURLToImage(base64)
    canvas.width = img.width
    canvas.height = img.height
    context.clearRect(0, 0, img.width, img.height)

    context.fillStyle = '#fff'
    context.fillRect(0, 0, img.width, img.height)

    context.drawImage(img, 0, 0, img.width, img.height)
    const blob = (await canvastoFile(canvas, type, quality)) as Blob
    return new File([blob], fileName, {
        type: type
    })
}
