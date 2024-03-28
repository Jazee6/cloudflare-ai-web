<script setup lang="ts">
import {useLocalStorage} from "@vueuse/core";

const {openSettings} = useGlobalState()
const settings = useLocalStorage('settings', initialSettings)
</script>

<template>
  <UModal v-model="openSettings">
    <div class="p-4 flex flex-col space-y-3">
      <h2 class="font-bold text-lg">
        {{ $t('setting') }}
      </h2>
      <div class="flex items-end">
        <div class="flex flex-col">
          OPENAI_API_KEY
          <span class="text-xs text-gray-500">{{ $t('use_own_key') }}</span>
        </div>
        <UInput v-model.trim.lazy="settings.openaiKey" class="ml-auto"/>
      </div>
      <div>
        <div class="flex">
          {{ $t('img_gen_steps') }}
          <span class="ml-auto">{{ settings.image_steps }}</span>
        </div>
        <URange :min="1" :max="20" v-model.lazy="settings.image_steps" class="w-full"/>
      </div>
    </div>
  </UModal>
</template>