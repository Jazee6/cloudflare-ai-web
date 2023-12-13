<script setup lang="ts">
const isOpen = ref(false)
const isOpenN = ref(false)

</script>

<template>
  <div id="navbar" class="blur-global">
    <UContainer class="h-full flex items-center">
      <img src="/MenuRound.svg" class="w-8 h-8 cursor-pointer" alt="Menu" @click="isOpenN=!isOpenN"/>
      <h1 class="text-2xl font-bold ml-2">cloudflare-ai-web</h1>

      <USlideover v-model="isOpenN" side="left" class="w-64">
        <UVerticalNavigation>

        </UVerticalNavigation>
      </USlideover>
    </UContainer>
  </div>
</template>

<style scoped>
#navbar {
  border-radius: 0 0 8px 8px;
  z-index: 1;
  @apply shadow h-16 shrink-0 fixed w-full
}
</style>