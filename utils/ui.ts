import type {Model} from "~/utils/type";

export const scrollStream = (el: globalThis.Ref<HTMLElement | undefined>, distance: number = 100) => {
    if (el.value) {
        (el.value.scrollTop + el.value.clientHeight >= el.value.scrollHeight - distance) && !(el.value.clientHeight + el.value.scrollTop === el.value.scrollHeight) && el.value.scrollTo({
            top: el.value.scrollHeight,
            behavior: 'smooth'
        })
    }
}

export const scrollOnce = (el: globalThis.Ref<HTMLElement | undefined>, distance: number = 256) => {
    if (el.value) {
        el.value.scrollTop + el.value.clientHeight >= el.value.scrollHeight - distance && el.value.scrollTo({
            top: el.value.scrollHeight,
            behavior: 'smooth'
        })
    }
}

export const models: Model[] = [{
    id: 'gpt-3.5-turbo',
    name: 'ChatGPT-3.5-turbo',
    endpoint: 'chat/completions',
    type: 'chat'
}, {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    type: 'chat'
}, {
    id: 'gemini-pro-vision',
    name: 'Gemini Pro Vision',
    type: 'image-to-text'
}, {
    id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    name: '绘画-stable-diffusion-xl-base-1.0',
    type: 'text-to-image'
}, {
    id: '@cf/lykon/dreamshaper-8-lcm',
    name: '绘画-dreamshaper-8-lcm',
    type: 'text-to-image'
}, {
    id: '@cf/meta/m2m100-1.2b',
    name: '翻译-m2m100-1.2b',
    type: 'text-to-text'
}, {
    id: '@cf/qwen/qwen1.5-14b-chat-awq',
    name: '通义千问1.5-14b',
    type: 'chat'
}]

export function convertFileSize(size: number) {
    if (size < 1024) {
        return size + 'B'
    } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + 'KB'
    } else if (size < 1024 * 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(2) + 'MB'
    } else {
        return (size / 1024 / 1024 / 1024).toFixed(2) + 'GB'
    }
}