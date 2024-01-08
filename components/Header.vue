<script setup lang="ts">
const isDark =ref(false)
let handleClick: () => void
const hideTabBar = useState('hideTabBar', () => true)

// initialize theme
const initTheme = () => {
  isDark.value = localStorage.getItem('theme') === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', isDark.value)
}

// toggle theme
const toggleTheme = ({ x, y }: any) => {
  const root = document.documentElement
  isDark.value = !root.classList.contains('dark')
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')

  // check if the current browser supports viewtransition API
  const isAppearanceTransition
    // @ts-expect-error: Transition API
    = document.startViewTransition
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // if it is not supported, just toggle the class directly
  if (!isAppearanceTransition) {
    root.classList.toggle('dark')
  } else {
    // if it is supported, use the transition API to animate the theme change
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y),
    )

    // @ts-expect-error: Transition API
    const transition = document.startViewTransition(() => {
      root.classList.toggle('dark')
    })
    transition.ready.then(() => {
      const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`,
      ]
      const _c = isDark.value ? clipPath : [...clipPath].reverse()
      const pseudoElement = isDark.value
        ? '::view-transition-new(root)'
        : '::view-transition-old(root)'
      document.documentElement.animate(
        {
          clipPath: _c,
        },
        {
          duration: 600,
          easing: 'ease-in',
          pseudoElement,
        },
      )
    })
  }
}


onMounted(() => {
  initTheme()
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
      <IButton class="ml-auto" :name="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
               @click.passive.stop="toggleTheme"/>
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
<style>
::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
    mix-blend-mode: normal;
  }

  .dark::view-transition-old(root) {
    z-index: 1;
  }

  .dark::view-transition-new(root) {
    z-index: 999;
  }

  ::view-transition-old(root) {
    z-index: 999;
  }

  ::view-transition-new(root) {
    z-index: 1;
  }
</style>