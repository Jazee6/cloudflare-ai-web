import {createGlobalState} from "@vueuse/shared"
import {textGenModels} from "./db"
import {ref} from "vue"

export const useGlobalState = createGlobalState(() => {
    const openModelSelect = ref(false)
    const passModal = ref(false)
    const openAside = ref(false)
    const openSettings = ref(false)
    const selectedModel = ref(textGenModels[0])

    return {
        openModelSelect,
        passModal,
        openAside,
        openSettings,
        selectedModel
    }
})