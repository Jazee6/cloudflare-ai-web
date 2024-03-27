<script setup lang="ts">
const input = ref('')
const addHistory = ref(true)
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

  handleSend: (input: string, addHistory: boolean) => void
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
  p.handleSend(input.value, addHistory.value)
  input.value = ''
}
</script>

<template>
  <div class="flex flex-col space-y-1">
    <UButton class="self-center" color="white" @click="openModelSelect=!openModelSelect">
      {{ selectedModel.name }}
      <template #trailing>
        <UIcon name="i-heroicons-chevron-down-solid"/>
      </template>
    </UButton>
    <div class="flex items-end">
      <UTooltip :text="addHistory?$t('with_history'):$t('without_history')">
        <UButton class="m-1" @click="addHistory = !addHistory" :color="addHistory?'primary':'gray'"
                 icon="i-heroicons-clock-solid"/>
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