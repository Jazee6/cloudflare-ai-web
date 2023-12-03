<script setup lang="ts">
import {fetchEventSource} from "@microsoft/fetch-event-source";

const input = ref('')
const loading = ref(false)
const el = ref<HTMLElement>()

interface HistoryItem {
  id: number
  content: string
  is_output?: boolean
  is_img?: boolean
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
}, {
  id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  name: 'stable-diffusion-xl-base-1.0'
}, {
  id: 'gpt-3.5-turbo',
  name: 'gpt-3.5-turbo'
}]

const selectedModel = ref(models[2].id)

watch(selectedModel, (v) => {
  localStorage.setItem('selectedModel', v)
})

onMounted(() => {
  selectedModel.value = localStorage.getItem('selectedModel') || models[2].id
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
  const text = input.value.trim()
  if (!text || loading.value) return
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

  if (selectedModel.value === '@cf/stabilityai/stable-diffusion-xl-base-1.0') {
    req('img', {prompt: text}).then((res) => {
      history.value[history.value.length - 1].is_img = true
      history.value[history.value.length - 1].content = URL.createObjectURL(res as Blob)
      if (el.value) {
        el.value.scrollTo({
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
  <div ref="el" class="py-4 h-full overflow-y-auto pt-24">
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
      <ul>
        <li v-for="(i,index) in history" :key="i.id" class="flex flex-col">
          <div v-if="i.is_output" id="reply">
            <img v-if="i.is_img" :src="i.content" :alt="history[index-1].content" class="sm:max-w-lg rounded-xl"/>
            <div v-else>
              {{ i.content }}
              {{ loading && index + 1 === history.length ? '...' : '' }}
            </div>
          </div>
          <div v-else id="send">
            {{ i.content }}
          </div>
        </li>
      </ul>
    </UContainer>
  </div>
  <div>
    <UContainer class="space-y-1 flex flex-col">
      <USelectMenu class="w-fit self-center mt-1" v-model="selectedModel" :options="models" value-attribute="id"
                   option-attribute="name">
        <template #label>
          {{ current.name }}
        </template>
      </USelectMenu>
      <div class="flex">
        <UTextarea v-model="input" placeholder="请输入文本..." @keydown.prevent.enter="handleReq" autofocus :rows="1"
                   autoresize
                   class="flex-1 max-h-48 overflow-y-auto p-1"/>
        <UButton @click="handleReq" :disabled="loading" class="self-end m-1">发送</UButton>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
#send {
  max-width: 80%;
  @apply self-end break-words bg-green-500 text-white rounded-xl p-2 mb-2;
}

#reply {
  max-width: 80%;
  @apply self-start break-words bg-gray-200 text-black rounded-xl p-2 mb-2;
}

#send::selection {
  @apply text-neutral-900 bg-gray-300;
}
</style>