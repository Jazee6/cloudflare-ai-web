<script setup lang="ts">
import {imageGenModels, textGenModels} from "~/utils/db";

const {t} = useI18n()
const {selectedModel, openModelSelect} = useGlobalState()
onMounted(() => {
  const model = localStorage.getItem('selectedModel')
  selectedModel.value = models.find(i => i.id === model) || textGenModels[0]
})
watch(selectedModel, v => {
  localStorage.setItem('selectedModel', v.id)
})

const groups = computed(() => [{
  key: 'text generation',
  label: t('text_generation'),
  commands: textGenModels.map(i => ({
    id: i.id,
    label: i.name
  }))
}, {
  key: 'image generation',
  label: t('image_generation'),
  commands: imageGenModels.map(i => ({
    id: i.id,
    label: i.name
  }))
}])

function onSelect(option: { id: string }) {
  selectedModel.value = models.find(i => i.id === option.id) || textGenModels[0]
}
</script>

<template>
  <UModal v-model="openModelSelect">
    <UCommandPalette @update:model-value="onSelect" :groups="groups" :model-value="selectedModel"/>
  </UModal>
</template>