<script setup lang="ts">
defineProps({
  name: String
})
</script>

<template>
  <div class="w-8 h-8 cursor-pointer rounded-full transition-all hover:bg-neutral-300 dark:hover:bg-neutral-700">
    <UIcon class="h-6 w-6 m-1 block" :name="name"/>
  </div>
</template>

<style scoped>

</style>