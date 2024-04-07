<script setup lang="ts">
import {useLocalStorage} from "@vueuse/core";

const route = useRoute()
const router = useRouter()
const {t} = useI18n()

const tabs = ref<TabItem[]>([])
const history = ref<HistoryItem[]>([])
const selectedTab = ref(0)
const {selectedModel} = useGlobalState()
const initializing = ref(true)
const loading = ref(false)
let settings: Ref<Settings>
let session: number = 0

async function initDB() {
  session = await DB.addTab(t('new_chat')) as number
  tabs.value.unshift({
    id: session,
    label: t('new_chat')
  })
  selectedTab.value = session
  await router.push({query: {session}})
}

async function loadData() {
  [tabs.value, history.value] = await Promise.all([DB.getTabs(), DB.getHistory(session)]);
  selectedTab.value = session
}

async function getLatestData() {
  const tab = await DB.getLatestTab()
  if (tab) {
    session = tab.id!
    await loadData()
    await router.push({query: {session}})
  } else await initDB()
}

onMounted(async () => {
  let s = parseInt(route.query.session as string)
  if (Number.isNaN(s)) {
    await getLatestData()
  } else {
    const tab = await DB.tab.get(s)
    if (tab) {
      session = tab.id!
      await loadData()
    } else await getLatestData()
  }

  settings = useLocalStorage('settings', initialSettings)

  initializing.value = false
})

async function handleNewChat() {
  if (loading.value) return

  await initDB()
  history.value = []

  await nextTick(() => {
    const tabEl = document.getElementById('tabEl')
    scrollToTop(tabEl)
  })
}

async function handleSwitchChat(e: MouseEvent) {
  if (loading.value) return

  const target = e.target as HTMLElement
  const id = target.dataset.id
  if (!id) return
  if (parseInt(id) === selectedTab.value) return
  selectedTab.value = parseInt(id)
  history.value = await DB.getHistory(parseInt(id))
  await router.push({query: {session: id}})
  session = parseInt(id)
}

async function handleDelete(id: number) {
  if (loading.value) return

  if (tabs.value.length === 1) return
  tabs.value = tabs.value.filter(i => i.id !== id)
  DB.deleteTabAndHistory(id)

  const nid = tabs.value[0].id as number
  selectedTab.value = nid
  history.value = await DB.getHistory(nid)
  await router.push({query: {session: nid}})
  session = nid
}

function basicCatch(e: Error) {
  history.value[history.value.length - 1].content += e.message
  history.value[history.value.length - 1].type = 'error'
  nextTick(() => {
    const chatList = document.getElementById('chatList')
    scrollToTop(chatList)
  })
  DB.history.add(toRaw(history.value[history.value.length - 1]))
}

function basicFin() {
  loading.value = false
}

function basicDone() {
  DB.history.add(toRaw(history.value[history.value.length - 1]))
}

async function handleSend(input: string, addHistory: boolean) {
  loading.value = true
  const type = selectedModel.value.type

  if (history.value.length === 0) {
    const label = input.substring(0, 15)
    DB.tab.update(session, {label}).then(() => {
      tabs.value.find(i => i.id === session)!.label = label
    })
  }
  const historyItem = {
    session,
    role: 'user',
    content: input,
    type: type === 'chat' ? 'text' : 'image-prompt'
  } as HistoryItem
  const id = await DB.history.add(historyItem) as number
  history.value.push({
    id,
    ...historyItem
  })
  history.value.push({
    id: id + 1,
    session,
    role: 'assistant',
    content: '',
    type: type === 'chat' ? 'text' : 'image'
  })

  const chatList = document.getElementById('chatList') as HTMLElement
  await nextTick(() => {
    scrollToTop(chatList)
  })

  const req = {
    model: selectedModel.value.id,
    messages: getMessages(toRaw(history.value), {addHistory, type})
  }
  switch (selectedModel.value.provider) {
    case 'openai':
      openAIReq({
        ...req,
        endpoint: selectedModel.value.endpoint!,
        key: settings.value.openaiKey === '' ? undefined : settings.value.openaiKey
      }, text => {
        history.value[history.value.length - 1].content += text
        scrollStream(chatList)
      }).then(basicDone).catch(basicCatch).finally(basicFin)
      break
    case "workers-ai":
      workersReq(req, res => {
        history.value[history.value.length - 1].content += res
        scrollStream(chatList)
      }).then(basicDone).catch(basicCatch).finally(basicFin)
      break
    case "workers-ai-image":
      workersImageReq({
        ...req,
        num_steps: settings.value.image_steps,
      }).then(res => {
        history.value[history.value.length - 1].content = URL.createObjectURL(res as Blob)
        history.value[history.value.length - 1].src = res as Blob

        setTimeout(() => {
          scrollToTop(chatList)
        }, 100)
        basicDone()
      }).catch(basicCatch).finally(basicFin)
      break
    case "google":
      geminiReq(req, text => {
        history.value[history.value.length - 1].content += text
        scrollStream(chatList, 512)
      }).then(basicDone).catch(basicCatch).finally(basicFin)
      break
  }
}
</script>

<template>
  <UContainer class="flex h-full w-full overflow-y-auto">
    <ModelSelect/>
    <Setting/>
    <Pass/>

    <Sidebar :tabs="tabs" :selected="selectedTab" :handle-delete="handleDelete" :handle-new-chat="handleNewChat"
             :handle-switch-chat="handleSwitchChat"/>
    <main class="w-full flex flex-col">
      <USkeleton v-if="initializing" class="h-24 w-3/5 self-end rounded-xl mt-20"/>
      <USkeleton v-if="initializing" class="h-24 w-3/5 rounded-xl mt-2"/>

      <template v-else>
        <ChatList id="chatList" :history="history" :loading="loading"/>
        <ChatInput class="mt-auto" :session="session" :loading="loading" :selected-model="selectedModel"
                   :handle-send="handleSend"/>
      </template>
    </main>
  </UContainer>
</template>