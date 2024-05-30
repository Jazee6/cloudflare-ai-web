<script setup lang="ts">
import {handleImgZoom} from "~/utils/tools";

const input = ref('')
const addHistory = ref(true)
const fileList = ref<{
  file: File
  url: string
}[]>([])
const {openModelSelect} = useGlobalState()

onMounted(() => {
  addHistory.value = localStorage.getItem('addHistory') === 'true'
})
watch(addHistory, () => {
  localStorage.setItem('addHistory', addHistory.value.toString())
})

const p = defineProps<{
  loading: boolean
  selectedModel: Model

  handleSend: (input: string, addHistory: boolean, files: {
    file: File
    url: string
  }[]) => void
}>()

function handleInput(e: KeyboardEvent) {
  if (e.shiftKey) {
    input.value += '\n'
  }
  if (e.isComposing || e.shiftKey) {
    return
  }

  if (input.value.trim() === '') return
  if (p.loading) return
  p.handleSend(input.value, addHistory.value, fileList.value)
  input.value = ''
}

function handleAddFiles() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = () => {
    const files = Array.from(input.files || [])
    files.forEach(file => {
      if (file.type.indexOf('image') === -1) return
      if (fileList.value.length >= 5) return
      const url = URL.createObjectURL(file)
      fileList.value.push({file, url})
    })
  }
  input.click()
}

// TODO paste ?? size limit ?? tips

onUnmounted(() => {
  fileList.value.forEach(i => {
    URL.revokeObjectURL(i.url)
  })
})
</script>

<template>
  <div class="relative">
    <div class="absolute bottom-10 w-full flex flex-col">
      <UButton class="self-center drop-shadow-xl mb-1" color="white" @click="openModelSelect=!openModelSelect">
        {{ selectedModel.name }}
        <template #trailing>
          <UIcon name="i-heroicons-chevron-down-solid"/>
        </template>
      </UButton>
      <ul v-if="selectedModel.type === 'vision'" style="margin: 0"
          class="flex flex-wrap bg-white dark:bg-[#121212] rounded-t-md">
        <li v-for="file in fileList" :key="file.url" class="relative group/img">
          <button @click="fileList.splice(fileList.indexOf(file), 1)"
                  class="absolute z-10 hidden group-hover/img:block rounded-full bg-neutral-100 right-0 hover:brightness-75 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 16 16">
              <path fill="currentColor"
                    d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94z"/>
            </svg>
          </button>
          <img :src="file.url"
               class="w-16 h-16 m-1 shadow-xl object-contain cursor-pointer group-hover/img:brightness-75 transition-all rounded-md"
               alt="selected image" @click="handleImgZoom($event.target as HTMLImageElement)"/>
        </li>
      </ul>
    </div>
    <div class="flex items-end">
      <UTooltip :text="addHistory?$t('with_history'):$t('without_history')">
        <UButton class="m-1" @click="addHistory = !addHistory" :color="addHistory?'primary':'gray'"
                 icon="i-heroicons-clock-solid"/>
      </UTooltip>
      <UTooltip v-if="selectedModel.type === 'vision'" :text="$t('add_image')">
        <UButton @click="handleAddFiles" color="white" class="m-1" icon="i-heroicons-paper-clip-16-solid"/>
      </UTooltip>
      <UTextarea v-model="input" :placeholder="$t('please_input_text') + '...' "
                 @keydown.prevent.enter="handleInput($event)"
                 autofocus :rows="1" autoresize
                 class="flex-1 max-h-48 overflow-y-auto p-1"/>
      <UButton @click="handleInput($event)" :disabled="loading" class="m-1">
        {{ $t('send') }}
      </UButton>
    </div>
  </div>
</template>