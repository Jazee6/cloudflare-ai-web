<script setup lang="ts">
import {version} from '../package.json'

const v = ref(version)
</script>

<template>
  <div class="mt-auto shrink-0 h-8">
    <div class="text-center text-xs font-light">
      V{{ v }} | Star on
      <a href="https://github.com/Jazee6/cloudflare-ai-web" target="_blank"
         class="text-neutral-500 hover:text-neutral-900 underline dark:text-neutral-400 dark:hover:text-neutral-300">GitHub</a>
    </div>
  </div>
</template>

<style scoped>

</style>