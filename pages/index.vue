<script setup lang="ts">
import markdownit from "markdown-it";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import 'highlight.js/styles/github.css';
import type {
  imgData,
  imgReq,
  openaiData,
  openaiReq, Tab,
  TransReq,
  workersAiData,
  workersAiReq
} from "~/utils/type";
import {DB, getHistory, getLatestTab} from "~/utils/db";

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
const access_pass = ref('')
const md: MarkdownIt = markdownit({
  linkify: true,
  highlight: (code, language) => {
    if (language && hljs.getLanguage(language)) {
      return `<pre class="hljs"><code>${hljs.highlight(code, {language}).value}</code></pre>`;
    }
    return `<pre class="hljs"><code>${hljs.highlightAuto(code).value}</code></pre>`;
  },
})
const history = ref<HistoryItem[]>([])
const tab = ref<Tab[]>([])
const router = useRouter()
const selectedTab = ref(0)
const initializing = ref(true)
let session: number

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
  name: 'ChatGPT-3.5-turbo',
  endpoint: 'chat/completions'
}, {
  id: 'Gemini Pro',
  name: 'Gemini Pro(非连续)',
}]

const selectedModel = ref(models[2].id)
watch(selectedModel, v => {
  localStorage.setItem('selectedModel', v)
})

const addHistory = ref(true)
watch(addHistory, v => {
  localStorage.setItem('addHistory', v.toString())
})

const hideTabBar = useState('hideTabBar')
watch(hideTabBar, v => {
  localStorage.setItem('hideTabBar', v!.toString())
})

async function loadData(session: number) {
  tab.value = await DB.tab.limit(100).reverse().toArray()
  history.value = await getHistory(session)
  selectedTab.value = session
}

async function initDB() {
  session = await DB.tab.add({
    content: '新建对话'
  }) as number
  tab.value.unshift({
    id: session,
    content: '新建对话'
  })
  selectedTab.value = session
  await router.push({query: {session}})
}

onMounted(async () => {
  const model = localStorage.getItem('selectedModel')
  selectedModel.value = models.find(i => i.id === model)?.id ?? models[2].id
  addHistory.value = localStorage.getItem('addHistory') === 'true'
  hideTabBar.value = localStorage.getItem('hideTabBar') === 'true'
  const needPass: any = await $fetch('/api/pass')
  if (needPass === 'true' && !localStorage.getItem('access_pass')) {
    isOpen.value = true
  }

  // indexedDB
  const s = router.currentRoute.value.query.session as any
  if (s === undefined) {
    const tab = await getLatestTab()
    if (tab === undefined) {
      await initDB()
    } else {
      session = tab.id
      await loadData(session)
      await router.push({query: {session}})
    }
  } else {
    const res = await DB.tab.get(parseInt(s))
    if (res === undefined) {
      session = (await getLatestTab()).id
      await loadData(session)
      await router.push({query: {session}})
    } else {
      session = parseInt(s)
      await loadData(session)
    }
  }

  initializing.value = false
})

const onclose = () => {
  DB.history.add({
    session,
    ...history.value[history.value.length - 1]
  })
  loading.value = false
}

const upMessages = () => addHistory.value ? toRaw(history.value).slice(0, -1).filter(i => !i.is_img).map(i => {
      return {
        content: i.content,
        role: i.role
      }
    }) :
    toRaw(history.value).slice(history.value.length - 2, -1).map(i => {
      return {
        content: i.content,
        role: i.role
      }
    })

const onerror = (status: number) => {
  if (status === 401) {
    isOpen.value = true
    loading.value = false
  }
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
  DB.history.add({
    session,
    ...send
  })
  if (history.value.length === 1) {
    await DB.tab.update(session, {
      content: text
    })
    tab.value.find(i => i.id === session)!.content = text
  }
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

  switch (selectedModel.value) {
    case '@cf/meta/m2m100-1.2b':
      req('trans', {
        model: selectedModel.value,
        text: send.content,
        source_lang: s_lang_selected.value,
        target_lang: t_lang_selected.value
      } as TransReq).then((res) => {
        history.value[history.value.length - 1].content = (res as unknown as TransRes).result.translated_text
      }).finally(() => {
        scrollOnce(el, 512)
        onclose()
      }).catch(e => {
        if (e.data === 'Unauthorized') {
          onerror(401)
        }
      })
      break

    case '@cf/stabilityai/stable-diffusion-xl-base-1.0':
      let t = 0
      await reqStream('img', (data: imgData) => {
            if (data.response === 'pending') {
              history.value[history.value.length - 1].content = `已等待${t += 5}s`
              return
            }
            history.value[history.value.length - 1].is_img = true
            history.value[history.value.length - 1].content = 'data:image/png;base64,' + data.response
          }, {
            messages: send.content,
            model: selectedModel.value,
          } as imgReq,
          () => {
            setTimeout(() => {
              scrollOnce(el, 512)
            }, 20)
            onclose()
          }
          , onerror)
      break

    case 'gpt-3.5-turbo':
      await reqStream('openai', (data: openaiData) => {
        if (data.choices[0].finish_reason !== null) return
        history.value[history.value.length - 1].content += data.choices[0].delta.content
        scrollStream(el)
      }, {
        messages: upMessages(),
        model: selectedModel.value,
      } as openaiReq, onclose, onerror)
      break

    case 'Gemini Pro':
      await reqStream('gemini', (data: string) => {
        history.value[history.value.length - 1].content += data
        scrollStream(el, 512)
      }, {
        messages: send.content,
      } as any, onclose, onerror)
      break

    default:
      await reqStream('chat', (data: workersAiData) => {
        history.value[history.value.length - 1].content += data.response
        scrollStream(el)
      }, {
        messages: upMessages(),
        model: selectedModel.value,
      } as workersAiReq, onclose, onerror)
  }
}

const handlePass = async () => {
  const pass = access_pass.value.trim()
  if (!pass) return
  access_pass.value = ''
  localStorage.setItem('access_pass', pass)
  isOpen.value = false
}

const isLoading = computed(() => loading.value ? 'loading' : '')

const handleTab = async (e: any) => {
  const id = e.target.dataset.id
  if (id === undefined) return
  const sid = parseInt(id)
  selectedTab.value = sid
  session = sid
  await router.push({query: {session}})
  history.value = await getHistory(sid)
}

async function handleNew() {
  await initDB()
  history.value = []

  await nextTick(() => {
    const tabEl = document.getElementById('tabEl')
    tabEl?.scrollTo({
      behavior: 'smooth',
      top: 0
    })
  })
}

function handleHideBar() {
  if (window.innerWidth < 640) {
    hideTabBar.value = true
  }
}

function handleDelete(id: number) {
  DB.tab.delete(id)
  tab.value = tab.value.filter(i => i.id !== id)
  DB.history.where('session').equals(id).delete()
  if (tab.value.length === 0) {
    handleNew()
  }
}
</script>

<template>
  <div :class="{mask:!hideTabBar}" @click="handleHideBar"></div>
  <UContainer class="flex h-full w-full overflow-y-auto">
    <div class="w-48 flex flex-col transition-all z-10 mr-2 mobileBar" :class="{hide:hideTabBar}">
      <ul id="tabEl" class="flex flex-col space-y-1 my-4 pt-16 overflow-y-auto h-full scrollbar-hide"
          @click.passive.stop="handleTab">
        <li v-for="i in tab" :key="i.id" class="rounded p-1.5 mx-2 cursor-pointer bg-white
              hover:bg-gray-300 transition-all flex items-center"
            :class="{'card-focus':i.id === selectedTab }" :data-id="i.id">
          <div class="line-clamp-1 font-light text-sm w-full" :data-id="i.id">
            {{ i.content }}
          </div>
          <UIcon name="i-heroicons-trash" v-if="i.id === selectedTab" @click="handleDelete(i.id)"
                 class="w-6 hover:bg-red-500 transition-all"/>
        </li>
      </ul>
      <UButton class="m-1 max-sm:mb-10" @click.passive.stop="handleNew">
        <div class="line-clamp-1">
          新建对话
        </div>
      </UButton>
    </div>
    <div class="flex flex-col w-full">
      <div ref="el" class="py-4 h-full overflow-y-auto pt-24">
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
        <ul class="flex flex-col space-y-2">
          <USkeleton v-if="initializing" class="h-16 w-3/5 self-end rounded-xl"/>
          <USkeleton v-if="initializing" class="h-16 w-3/5 rounded-xl"/>
          <template v-for="(i,index) in history" :key="index">
            <li v-if="i.role === 'assistant'" id="reply" class="slide-top">
              <img v-if="i.is_img" :src="i.content" :alt="history[index-1].content"
                   class="sm:max-w-lg rounded-xl cursor-pointer"/>
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
      </div>
      <div class="space-y-1 flex flex-col">
        <USelectMenu class="self-center mt-1" v-model="selectedModel" :options="models" value-attribute="id"
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
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
#send {
  max-width: 80%;
  @apply self-end break-words bg-green-500 text-white rounded-xl p-2
}

#reply {
  max-width: 80%;
  @apply self-start break-words bg-gray-200 text-black rounded-xl p-2
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

.card-focus {
  @apply ring-2 ring-primary-500 dark:ring-primary-400
}

.scrollbar-hide::-webkit-scrollbar {
  @apply hidden
}

.hide {
  @apply w-0 opacity-0
}

@media not all and (min-width: 640px) {
  .mobileBar {
    @apply fixed shadow-2xl -translate-x-4 h-full bg-white
  }

  .mask {
    @apply fixed inset-0 bg-black bg-opacity-30 z-10 transition-all
  }
}
</style>