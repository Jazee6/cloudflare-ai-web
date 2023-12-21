<script setup lang="ts">
const hideTabBar = useState('hideTabBar', () => true)

let handleClick

onMounted(() => {
  handleClick = () => {
    location.reload()
  }
})
</script>

<template>
  <div id="navbar" class="blur-global">
    <UContainer class="h-full flex items-center">
      <img src="/MenuRound.svg" class="w-8 h-8 cursor-pointer" alt="Menu" @click="hideTabBar = !hideTabBar"/>
      <h1 @click="handleClick" class="text-lg font-bold ml-2 hover:cursor-pointer">Uni Ai Web</h1>
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