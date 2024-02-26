<script setup lang="ts">
import {useLocalStorage} from "@vueuse/core";

const safeReply = useLocalStorage('safeReply', true)
const openaiKey = useLocalStorage('openaiKey', '')
</script>

<template>
  <div class="p-4 flex flex-col space-y-2">
    <div class="font-bold text-lg">
      {{ $t('setting') }}
    </div>
    <div class="flex items-baseline">
      {{ $t('block_sensitive_reply') }} (GeminiPro)
      <UToggle v-model="safeReply" class="ml-auto" disabled/>
    </div>
    <div class="flex items-end">
      <div class="flex flex-col">
        OPENAI_API_KEY
        <span class="text-xs text-gray-500">{{ $t('use_own_key') }}</span>
      </div>
      <UInput v-model="openaiKey" class="ml-auto"/>
    </div>
  </div>
</template>

<style scoped>

</style>