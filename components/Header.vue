<script setup lang="ts">
import {useDark, useToggle} from "@vueuse/core";

const hideTabBar = useState('hideTabBar', () => true)
const isDark = useDark()
const toggleDark = useToggle(isDark)
let handleClick

onMounted(() => {
  handleClick = () => {
    location.reload()
  }
})
</script>

<template>
  <div id="navbar" class="blur-global dark:bg-neutral-800">
    <UContainer class="h-full flex items-center">
      <div class="w-9 h-9 cursor-pointer rounded-full transition-all hover:bg-neutral-300 dark:hover:bg-neutral-700"
           @click="hideTabBar = !hideTabBar">
        <UIcon name="i-heroicons-bars-3-20-solid" class="h-7 w-7 m-1"/>
      </div>
      <h1 @click="handleClick" class="text-lg font-bold ml-2 hover:cursor-pointer">CF AI Web</h1>
      <div
          class="ml-auto h-8 w-8 cursor-pointer rounded-full transition-all hover:bg-neutral-300 dark:hover:bg-neutral-700"
          @click.passive.stop="toggleDark()">
        <UIcon class="h-6 w-6 m-1" :name="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"/>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
#navbar {
  border-radius: 0 0 8px 8px;
  z-index: 1;
  @apply shadow h-16 shrink-0 fixed w-full z-50
}
</style>