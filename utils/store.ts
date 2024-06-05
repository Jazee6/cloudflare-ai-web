import {createGlobalState} from "@vueuse/shared"

export const useGlobalState = createGlobalState(() => {
    const openModelSelect = ref(false)
    const passModal = ref(false)
    const openAside = ref(false)
    const openSettings = ref(false)
    const selectedModel = ref(uniModals[0])

    return {
        openModelSelect,
        passModal,
        openAside,
        openSettings,
        selectedModel
    }
})