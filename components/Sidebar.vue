<script setup lang="ts">
import {useGlobalState} from "~/utils/store";

const {openAside, openSettings} = useGlobalState()

defineProps<{
  tabs: TabItem[]
  selected: number

  handleNewChat: () => void
  handleDelete: (tid: number) => void
  handleSwitchChat: (e: MouseEvent) => void
}>()
</script>

<template>
  <div :class="{mask:openAside}" @click="openAside=!openAside"></div>
  <aside class="w-48 flex flex-col transition-all mobile-bar mr-1" :class="{hide:!openAside}">
    <ol id="tabEl" class="flex flex-col space-y-1 overflow-y-auto h-full scrollbar-hide pt-20"
        @click="handleSwitchChat">
      <li v-for="i in tabs" :key="i.id" class="rounded p-1.5 mx-1 cursor-pointer bg-white
                    hover:bg-neutral-300 transition-all flex items-center dark:bg-neutral-800 dark:hover:bg-neutral-600"
          :class="{'card-focus':i.id === selected }" :data-id="i.id">
        <div class="line-clamp-1 font-light text-sm w-full" :data-id="i.id">
          {{ i.label }}
        </div>
        <UIcon name="i-heroicons-trash" v-if="i.id === selected" @click="handleDelete(i.id)"
               class="shrink-0 hover:bg-red-500 transition-all"/>
      </li>
    </ol>
    <div class="flex my-1">
      <IButton name="i-heroicons-cog-8-tooth" @click="openSettings=!openSettings"/>
      <UButton class="ml-auto" variant="soft" @click="handleNewChat">
        {{ $t('new_chat') }} +
      </UButton>
    </div>
  </aside>
</template>

<style scoped lang="postcss">
.hide {
  @apply -translate-x-full opacity-0 w-0 m-0 invisible transition-all
}

.card-focus {
  @apply ring-2 ring-primary-500 dark:ring-primary-400
}

@media not all and (min-width: 768px) {
  .mobile-bar {
    @apply fixed left-0 z-20 h-full bg-white shadow-xl pb-6 px-2 dark:bg-neutral-900 rounded-r
  }

  .mask {
    @apply fixed inset-0 z-10 bg-black opacity-25
  }
}
</style>