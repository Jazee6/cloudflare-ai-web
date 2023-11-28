<script setup lang="ts">
const isOpen = ref(false)

</script>

<template>
  <div class="h-16 shadow shrink-0">
    <UContainer class="h-full flex items-center">
      <h1 class="text-2xl font-semibold">cf-ai-web</h1>
      <UButton class="ml-auto" @click="isOpen=!isOpen">登录</UButton>

      <UModal v-model="isOpen">
        <div class="p-4">
          开发中...
        </div>
      </UModal>
    </UContainer>
  </div>
</template>

<style scoped>

</style>