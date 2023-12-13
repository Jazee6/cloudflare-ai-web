<script setup lang="ts">
import markdownit from "markdown-it";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import 'highlight.js/styles/github.css';

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
const isOpen = ref(false)
const config = useRuntimeConfig()
const {data: needPass} = await useFetch('/api/pass')
const access_pass = ref('')
const md: MarkdownIt = markdownit({
  linkify: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre class="hljs"><code>${hljs.highlight(lang, str, true).value}</code></pre>`;
    }
    return `<pre class="hljs"><code>${hljs.highlightAuto(str)}</code></pre>`;
  },
})

const history = ref<HistoryItem[]>([])

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
  name: '编程-codellama-7b-instruct-awq'
}, {
  id: '@cf/meta/m2m100-1.2b',
  name: '翻译-m2m100-1.2b'
}, {
  id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  name: '绘画-stable-diffusion-xl-base-1.0'
}, {
  id: 'gpt-3.5-turbo',
  name: 'ChatGPT-3.5-turbo'
}]

const selectedModel = ref(models[2].id)

watch(selectedModel, v => {
  localStorage.setItem('selectedModel', v)
})

const addHistory = ref(true)

watch(addHistory, v => {
  localStorage.setItem('addHistory', v.toString())
})

onMounted(() => {
  selectedModel.value = localStorage.getItem('selectedModel') || models[2].id
  addHistory.value = localStorage.getItem('addHistory') === 'true'
  if ((<any>needPass.value) === 'true' && !localStorage.getItem('access_pass')) {
    isOpen.value = true
  }
})

const onclose = () => {
  loading.value = false
}

const upMessages = () => addHistory.value ? toRaw(history.value).filter(i => !i.is_img) :
    toRaw(history.value).slice(history.value.length - 2, history.value.length - 1)

const onerror = () => {
  history.value.pop()
  history.value.pop()
  isOpen.value = true
}

const handleReq = async () => {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  const send: HistoryItem = {
    role: 'user',
    content: text,
  }
  if (selectedModel.value === '@cf/stabilityai/stable-diffusion-xl-base-1.0') {
    send.is_img = true
  }
  history.value.push(send)
  loading.value = true
  history.value.push({
    role: 'assistant',
    content: '',
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
      history.value[history.value.length - 1].content = (res as unknown as TransRes).result.translated_text
    }).finally(() => {
      scrollOnce(el, 512)
      onclose()
    }).catch(onerror)
    return
  }

  if (selectedModel.value === '@cf/stabilityai/stable-diffusion-xl-base-1.0') {
    let t = 0
    await reqStream('img', [send], selectedModel.value, (data: workersAiData) => {
      if (data.response === 'pending') {
        history.value[history.value.length - 1].content = `已等待${t += 5}s`
        return
      }
      history.value[history.value.length - 1].is_img = true
      history.value[history.value.length - 1].content = 'data:image/png;base64,' + data.response
    }, () => {
      setTimeout(() => {
        scrollOnce(el, 512)
      }, 20)
      onclose()
    }, onerror)

    return
  }

  if (selectedModel.value === 'gpt-3.5-turbo') {
    await reqStream('openai', upMessages(), selectedModel.value, (data: openaiData) => {
      if (data.choices[0].finish_reason === 'stop') {
        return
      }
      history.value[history.value.length - 1].content += data.choices[0].delta.content

      scrollStream(el)
    }, onclose, onerror)
    return
  }

  await reqStream('chat', upMessages(), selectedModel.value, (data: workersAiData) => {
    history.value[history.value.length - 1].content += data.response

    scrollStream(el)
  }, onclose, onerror)
}

const handlePass = async () => {
  const pass = access_pass.value.trim()
  if (!pass) return
  access_pass.value = ''
  localStorage.setItem('access_pass', pass)
  isOpen.value = false
}

const isLoading = computed(() => loading.value ? 'loading' : '')
</script>

<template>
  <div ref="el" class="py-4 h-full overflow-y-auto pt-24">
    <UContainer>
      <UModal v-model="isOpen">
        <div class="p-4 flex flex-col space-y-2">
          <div>
            请输入访问密码
          </div>
          <div class="flex space-x-2">
            <UInput v-model="access_pass" type="password" @keydown.enter.passive="handlePass" class="flex-1"/>
            <UButton @click="handlePass">确定</UButton>
          </div>
        </div>
      </UModal>

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
      <ul class="flex flex-col">
        <li id="send" class="slide-top">
          你好
        </li>
        <li id="reply" class="slide-top">
          你好, 请问有什么可以帮助您的吗?
        </li>
        <template v-for="(i,index) in history" :key="index">
          <li v-if="i.role === 'assistant'" id="reply" class="slide-top">
            <img v-if="i.is_img" :src="i.content" :alt="history[index-1].content" class="sm:max-w-lg rounded-xl"/>
            <template v-else>
              <div v-html="md.render(i.content)" class="prose text-black max-w-none"
                   :class="index+1===history.length && isLoading"></div>
            </template>
          </li>
          <li v-else id="send" class="slide-top">
            {{ i.content }}
          </li>
        </template>
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
      <div class="flex items-center">
        <UTooltip :text="addHistory?'发送时携带历史记录':'发送时不携带历史记录'">
          <UButton class="m-1" @click="addHistory = !addHistory" :color="addHistory?'primary':'gray'"
                   icon="i-heroicons-clock-solid"/>
        </UTooltip>
        <UTextarea v-model="input" placeholder="请输入文本..." @keydown.prevent.enter="handleReq" autofocus
                   :rows="1" autoresize
                   class="flex-1 max-h-48 overflow-y-auto p-1"/>
        <UButton @click="handleReq" :disabled="loading" class="m-1">
          发送
        </UButton>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
#send {
  max-width: 80%;
  @apply self-end break-words bg-green-500 text-white rounded-xl p-2 mb-2 transition-all hover:bg-green-600;
}

#reply {
  max-width: 80%;
  @apply self-start break-words bg-gray-200 text-black rounded-xl p-2 transition-all hover:bg-gray-300;
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