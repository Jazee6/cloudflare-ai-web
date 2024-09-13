<script setup lang="ts">
defineProps<{
  name: string
}>()
</script>

<template>
  <button
      class="w-8 h-8 cursor-pointer rounded-full transition-all hover:bg-neutral-300 dark:hover:bg-neutral-700">
    <UIcon class="h-6 w-6 m-auto block" :name="name"/>
  </button>
</template>