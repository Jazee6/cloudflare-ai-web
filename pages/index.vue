<script setup lang="ts">
import {fetchEventSource} from "@microsoft/fetch-event-source";

const input = ref('')
const loading = ref(false)

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

const models = [{
  id: '@cf/meta/llama-2-7b-chat-fp16',
  name: 'llama-2-7b-chat-fp16'
}, {
  id: '@cf/meta/llama-2-7b-chat-int8',
  name: 'llama-2-7b-chat-int8'
}, {
  id: '@cf/mistral/mistral-7b-instruct-v0.1',
  name: 'mistral-7b-instruct-v0.1'
}, {
  id: '@hf/thebloke/codellama-7b-instruct-awq',
  name: 'codellama-7b-instruct-awq'
}]
const selectedModel = ref(models[1].id)

const handleReq = async () => {
  if (!input.value) return
  const text = input.value
  input.value = ''
  history.value.push({
    id: history.value.length + 1,
    content: text,
  })
  loading.value = true
  history.value.push({
    id: history.value.length + 1,
    content: '',
    is_output: true,
  })
  console.log(JSON.stringify({
    prompt: text,
    model: selectedModel.value,
  }))
  await fetchEventSource('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      prompt: text,
      model: selectedModel.value,
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    onmessage: (e) => {
      if (e.data === '[DONE]') return
      const data = JSON.parse(e.data);
      history.value[history.value.length - 1].content += data.response
    },
    onclose: () => {
      loading.value = false
    }
  })
}

const current = computed(() =>
    models.find(i => i.id === selectedModel.value)
)
</script>

<template>
  <div class="py-4 h-full overflow-y-auto">
    <UContainer>
      <div v-for="i in history" :key="i.id" class="flex flex-col">
        <div v-if="i.is_output">
          {{ i.content }}
          {{ loading ? '...' : '' }}
        </div>
        <div v-else class="self-end">
          {{ i.content }}
        </div>
      </div>
    </UContainer>
  </div>
  <div>
    <UContainer>
      <div class="flex space-x-2">
        <UInput v-model="input" placeholder="请输入文本" @keydown.enter="handleReq" class="flex-1"/>
        <USelectMenu v-model="selectedModel" :options="models" value-attribute="id" option-attribute="name">
          <template #label>
            {{ current.name }}
          </template>
        </USelectMenu>
        <UButton @click="handleReq">发送</UButton>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>

</style>