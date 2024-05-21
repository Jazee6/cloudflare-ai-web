<script setup lang="ts">
import {useLocalStorage} from "@vueuse/core";

const {openSettings} = useGlobalState()
const settings = useLocalStorage('settings', initialSettings)
</script>

<template>
  <UModal v-model="openSettings">
    <h2 class="font-bold text-lg px-4 pt-4">
      {{ $t('setting') }}
    </h2>
    <ul class="flex flex-col space-y-2 p-4">
      <li class="flex items-end">
        <div class="flex flex-col">
          OPENAI_API_KEY
          <span class="text-xs text-gray-500">{{ $t('use_own_key') }}</span>
        </div>
        <UInput placeholder="sk-xxx" v-model.trim.lazy="settings.openaiKey" class="ml-auto"/>
      </li>
      <li>
        <div class="flex">
          {{ $t('img_gen_steps') }}
          <span class="ml-auto">{{ settings.image_steps }}</span>
        </div>
        <URange :min="1" :max="20" v-model.lazy="settings.image_steps" class="w-full mt-1"/>
      </li>
      <li>
        {{ $t('system_prompt') }}
        <UTextarea autoresize placeholder="You are ChatGPT..." v-model.trim.lazy="settings.system_prompt" class="mt-1"/>
      </li>
    </ul>
  </UModal>
</template>