<script setup lang="ts">
const input = ref('')

interface HistoryItem {
  id: number
  content: string
  is_output?: boolean
}

const history = ref<HistoryItem[]>([
  {
    id: 1,
    content: '你好',
  }, {
    id: 2,
    content: '你好, 请问有什么可以帮助您的吗?',
    is_output: true,
  }
])

interface Response {
  result: {
    response: string
  }
}

const handleReq = async () => {
  if (!input.value) return
  history.value.push({
    id: history.value.length + 1,
    content: input.value,
  })
  const data: Response = await $fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.value,
    }),
  })
  history.value.push({
    id: history.value.length + 1,
    content: data.result.response,
    is_output: true,
  })
}
</script>

<template>
  <div class="py-4 h-full overflow-y-auto">
    <UContainer>
      <div v-for="i in history" :key="i.id" class="flex flex-col">
        <div v-if="i.is_output">
          {{ i.content }}
        </div>
        <div v-else class="self-end">
          {{ i.content }}
        </div>
      </div>
    </UContainer>
  </div>
  <div>
    <UContainer>
      <div class="flex">
        <UInput v-model="input" placeholder="请输入文本" @keydown.enter="handleReq" class="flex-1"/>
        <UButton class="ml-2" @click="handleReq">发送</UButton>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>

</style>