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

export const models = [{
    id: 'gpt-3.5-turbo',
    name: 'ChatGPT-3.5-turbo',
    endpoint: 'chat/completions'
}, {
    id: 'gemini-pro',
    name: 'Gemini Pro',
}, {
    id: 'gemini-pro-vision',
    name: 'Gemini Pro Vision',
}, {
    id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    name: '绘画-stable-diffusion-xl-base-1.0'
}, {
    id: '@cf/meta/m2m100-1.2b',
    name: '翻译-m2m100-1.2b'
}, {
    id: '@cf/meta/llama-2-7b-chat-fp16',
    name: 'llama-2-7b-chat-fp16'
}, {
    id: '@cf/meta/llama-2-7b-chat-int8',
    name: 'llama-2-7b-chat-int8'
}, {
    id: '@cf/mistral/mistral-7b-instruct-v0.1',
    name: 'mistral-7b-instruct-v0.1'
}, {
    id: '@hf/thebloke/codellama-7b-instruct-awq',
    name: '编程-codellama-7b-instruct-awq'
}]