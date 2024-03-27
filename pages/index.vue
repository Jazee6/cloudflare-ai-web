<script setup lang="ts">
import {workersReq, openAIReq} from "~/api";
import {scrollStream} from "~/utils/tools";
import {useThrottleFn} from "@vueuse/shared";

const route = useRoute()
const router = useRouter()
const {t} = useI18n()

const tabs = ref<TabItem[]>([])
const history = ref<HistoryItem[]>([])
const selectedTab = ref(0)
const {selectedModel} = useGlobalState()
const initializing = ref(true)
const loading = ref(false)
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

  initializing.value = false
})

async function handleNewChat() {
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

async function handleSwitchChat(e: MouseEvent) {
  const target = e.target as HTMLElement
  const id = target.dataset.id
  if (!id) return
  if (parseInt(id) === selectedTab.value) return
  selectedTab.value = parseInt(id)
  history.value = await DB.getHistory(parseInt(id))
  await router.push({query: {session: id}})
}

function handleDelete(id: number) {
  if (tabs.value.length === 1) return
  tabs.value = tabs.value.filter(i => i.id !== id)
  DB.deleteTabAndHistory(id)
}

async function handleSend(input: string, addHistory: boolean) {
  loading.value = true

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
    type: 'text'
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
    type: 'text'
  })

  const chatList = document.getElementById('chatList') as HTMLElement
  await nextTick(() => {
    chatList.scrollTo({
      behavior: 'smooth',
      top: chatList.scrollHeight
    })
  })

  switch (selectedModel.value.provider) {
    case 'openai':
      openAIReq({
        model: selectedModel.value.id,
        messages: getMessages(toRaw(history.value), addHistory),
        endpoint: selectedModel.value.endpoint!
      }, text => {
        history.value[history.value.length - 1].content += text
        scrollStream(chatList)
      }).then(() => {
        DB.history.add(toRaw(history.value[history.value.length - 1]))
      }).finally(() => {
        loading.value = false
      })
      break
    case "workers-ai":
      workersReq({
        model: selectedModel.value.id,
        messages: getMessages(toRaw(history.value), addHistory),
      }, text => {
        history.value[history.value.length - 1].content += text
        scrollStream(chatList)
      }).then(() => {
        DB.history.add(toRaw(history.value[history.value.length - 1]))
      }).finally(() => {
        loading.value = false
      })
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