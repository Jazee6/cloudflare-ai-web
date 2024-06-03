<script setup lang="ts">
import {version} from '../package.json'
</script>

<template>
  <footer class="shrink-0 h-6">
    <div class="text-center text-xs font-light">
      {{ version }} | Star on
      <a href="https://github.com/Jazee6/cloudflare-ai-web" target="_blank"
         class="text-neutral-500 hover:text-neutral-900 underline dark:text-neutral-400 dark:hover:text-neutral-300">GitHub</a>
    </div>
  </footer>
</template>