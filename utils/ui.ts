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
