<script setup lang="ts">
import {fetchEventSource} from "@microsoft/fetch-event-source";
import {useStorage} from "@vueuse/core";

const input = ref('')
const loading = ref(false)
const el = ref<HTMLElement>()

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
}, {
  id: '@cf/meta/m2m100-1.2b',
  name: '翻译-m2m100-1.2b'
}]
const selectedModel = ref(models[3].id)

watch(selectedModel, (v) => {
  localStorage.setItem('selectedModel', v)
})

onMounted(() => {
  selectedModel.value = localStorage.getItem('selectedModel') || models[3].id
})

const reqStream = async (path: string, body: Object) => {
  await fetchEventSource(`/api/${path}`, {
    method: 'POST',
    body: JSON.stringify({
      model: selectedModel.value,
      ...body
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    onmessage: (e) => {
      if (e.data === '[DONE]') return
      const data = JSON.parse(e.data);
      history.value[history.value.length - 1].content += data.response
      if (el.value) {
        (el.value.scrollTop + el.value.clientHeight >= el.value.scrollHeight - 100) && !(el.value.clientHeight + el.value.scrollTop === el.value.scrollHeight) && el.value.scrollTo({
          top: el.value.scrollHeight,
          behavior: 'smooth'
        })
      }
    },
    onclose: () => {
      loading.value = false
    }
  })
}

const req = async (path: string, body: Object) => {
  return await $fetch(`/api/${path}`, {
    method: 'POST',
    body: JSON.stringify({
      model: selectedModel.value,
      ...body
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

interface TransRes {
  result: {
    translated_text: string
  }
}

const handleReq = async () => {
  if (!input.value || loading.value) return
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
  await nextTick(() => {
    if (el.value) {
      el.value.scrollTo({
        top: el.value.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
  if (selectedModel.value === '@cf/meta/m2m100-1.2b') {
    req('trans', {
      text,
      source_lang: s_lang_selected.value,
      target_lang: t_lang_selected.value
    }).then((res) => {
      history.value[history.value.length - 1].content = (res as TransRes).result.translated_text
      if (el.value) {
        (el.value.scrollTop + el.value.clientHeight >= el.value.scrollHeight - 300) && el.value.scrollTo({
          top: el.value.scrollHeight,
          behavior: 'smooth'
        })
      }
    }).finally(() => {
      loading.value = false
    })
    return
  }
  await reqStream('chat', {prompt: text})
}

const current = computed(() =>
    models.find(i => i.id === selectedModel.value)
)

const s_lang = ref(['english', 'chinese', 'japanese', 'french', 'spanish', 'arabic', 'russian', 'german', 'portuguese', 'hindi'])
const t_lang = computed(() => {
  const arr = [...s_lang.value]
  arr.splice(arr.indexOf(s_lang_selected.value), 1)
  t_lang_selected.value = arr[0]
  return arr
})
const s_lang_selected = ref('chinese')
const t_lang_selected = ref('english')
</script>

<template>
  <div ref="el" class="py-4 h-full overflow-y-auto">
    <UContainer>
      <div v-if="selectedModel==='@cf/meta/m2m100-1.2b'" class="flex justify-center items-center">
        <USelectMenu :options="s_lang" v-model="s_lang_selected">

        </USelectMenu>
        <div class="px-4">
          ->
        </div>
        <USelectMenu :options="t_lang" v-model="t_lang_selected">

        </USelectMenu>
      </div>
      <div v-for="(i,index) in history" :key="i.id" class="flex flex-col">
        <div v-if="i.is_output">
          {{ i.content }}
          {{ loading && index + 1 === history.length ? '...' : '' }}
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
        <UButton @click="handleReq" :disabled="loading">发送</UButton>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>

</style>