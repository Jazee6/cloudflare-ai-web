<script setup lang="ts">
const input = ref('')
const loading = ref(false)
const el = ref<HTMLElement>()
const s_lang = ref(['english', 'chinese', 'japanese', 'french', 'spanish', 'arabic', 'russian', 'german', 'portuguese', 'hindi'])
const t_lang = computed(() => {
  const arr = [...s_lang.value]
  arr.splice(arr.indexOf(s_lang_selected.value), 1)
  t_lang_selected.value = arr[0]
  return arr
})
const s_lang_selected = ref('chinese')
const t_lang_selected = ref('english')
const current = computed(() =>
    models.find(i => i.id === selectedModel.value)
)

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

const onclose = () => {
  loading.value = false
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
    req('trans', selectedModel.value, {
      text,
      source_lang: s_lang_selected.value,
      target_lang: t_lang_selected.value
    }).then((res) => {
      history.value[history.value.length - 1].content = (res as TransRes).result.translated_text
    }).finally(() => {
      scrollOnce(el, 512)
      onclose()
    })
    return
  }

  if (selectedModel.value === '@cf/stabilityai/stable-diffusion-xl-base-1.0') {
    req('img', selectedModel.value, {prompt: text}).then((res) => {
      history.value[history.value.length - 1].is_img = true
      history.value[history.value.length - 1].content = URL.createObjectURL(res as Blob)
    }).finally(() => {
      setTimeout(() => {
        scrollOnce(el, 512)
      }, 20)
      onclose()
    })
    return
  }

  if (selectedModel.value === 'gpt-3.5-turbo') {
    await reqStream('openai', {prompt: text}, selectedModel.value, (data: openaiData) => {
      if (data.choices[0].finish_reason === 'stop') {
        return
      }
      history.value[history.value.length - 1].content += data.choices[0].delta.content

      scrollStream(el)
    }, onclose)
    return
  }

  await reqStream('chat', {prompt: text}, selectedModel.value, (data: workersAiData) => {
    history.value[history.value.length - 1].content += data.response

    scrollStream(el)
  }, onclose)
}
</script>

<template>
  <div ref="el" class="py-4 h-full overflow-y-auto pt-24">
    <UContainer>
      <div v-if="selectedModel==='@cf/meta/m2m100-1.2b'" class="flex justify-center sticky top-0 z-10">
        <div id="navbar" class="flex items-center p-2 rounded-xl shadow blur-global">
          <USelectMenu :options="s_lang" v-model="s_lang_selected">

          </USelectMenu>
          <div class="px-4">
            ->
          </div>
          <USelectMenu :options="t_lang" v-model="t_lang_selected">

          </USelectMenu>
        </div>
      </div>
      <ul>
        <li v-for="(i,index) in history" :key="i.id" class="flex flex-col">
          <div v-if="i.is_output" id="reply" class="slide-top">
            <img v-if="i.is_img" :src="i.content" :alt="history[index-1].content" class="sm:max-w-lg rounded-xl"/>
            <div v-else>
              {{ i.content }}
              {{ loading && index + 1 === history.length ? '...' : '' }}
            </div>
          </div>
          <div v-else id="send" class="slide-top">
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
        <UTextarea v-model="input" placeholder="请输入文本..." @keydown.prevent.enter="handleReq" autofocus
                   :rows="1"
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
  @apply self-start break-words bg-gray-200 text-black rounded-xl p-2 mb-2 transition-all;
}

#send::selection {
  @apply text-neutral-900 bg-gray-300;
}

.slide-top {
  animation: slide-top .25s cubic-bezier(.25, .46, .45, .94) both
}

@keyframes slide-top {
  0% {
    transform: translateY(0);
    opacity: 0
  }
  100% {
    transform: translateY(-16px);
    opacity: 1
  }
}
</style>