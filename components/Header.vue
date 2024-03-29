<script setup lang="ts">
import {useDark, useToggle} from "@vueuse/core";
import {useGlobalState} from "~/utils/store";

const isDark = useDark()
const toggleDark = useToggle(isDark)
const {openAside} = useGlobalState()
onMounted(() => {
  const open = localStorage.getItem('openAside')
  openAside.value = open === 'true' || open === null
})
watch(openAside, (v) => {
  localStorage.setItem('openAside', v.toString())
})
</script>

<template>
  <header class="blur-global dark:bg-neutral-800 shadow h-16 fixed w-full z-50 rounded-b-lg">
    <UContainer class="h-full flex items-center">
      <IButton name="i-heroicons-bars-3-20-solid" @click="openAside = !openAside"/>
      <h1 @click="()=>location.reload()" class="text-lg font-bold ml-2 hover:cursor-pointer">CF AI Web</h1>
      <IButton class="ml-auto" :name="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"
               @click="toggleDark()"/>
    </UContainer>
  </header>
</template>