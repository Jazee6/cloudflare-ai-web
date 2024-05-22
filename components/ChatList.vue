<script setup lang="ts">
import MarkdownIt from "markdown-it"
import markdownit from "markdown-it"
import hljs from "highlight.js";
import 'highlight.js/styles/github-dark-dimmed.min.css'

defineProps<{
  history: HistoryItem[]
  loading: boolean
}>()

const md: MarkdownIt = markdownit({
  linkify: true,
  highlight: (code, language) => {
    if (language && hljs.getLanguage(language)) {
      return `<pre class="hljs"><code>${hljs.highlight(code, {language}).value}</code></pre>`;
    }
    return `<pre class="hljs"><code>${hljs.highlightAuto(code).value}</code></pre>`;
  },
})

function handleZoom(e: MouseEvent) {
  const img = e.target as HTMLImageElement
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.3s;
    opacity: 0;
    z-index: 9999;
  `
  const imgZoom = document.createElement('img')
  imgZoom.src = img.src
  container.appendChild(imgZoom)
  document.body.appendChild(container)
  container.addEventListener('click', () => {
    container.style.opacity = '0'
    setTimeout(() => {
      document.body.removeChild(container)
    }, 300)
  })

  imgZoom.height
  container.style.opacity = '1'
}
</script>

<template>
  <ul class="overflow-y-auto scrollbar-hide pt-24 pl-1 flex flex-col space-y-1">
    <template v-for="(i,index) in history" :key="i.id">
      <template v-if="!i.content">
        <USkeleton class="loading-item"/>
      </template>
      <template v-else>
        <li v-if="i.type==='text'||i.type==='image-prompt'" class="chat-item slide-top prose"
            :class="[i.role==='user'?'send':'reply-text', index+1===history.length && loading ?  'loading':'' ]"
            v-html="i.role === 'user'? i.content: md.render(i.content)"/>
        <li v-else-if="i.type === 'image'">
          <img @click="handleZoom" class="chat-item slide-top cursor-pointer hover:brightness-75 transition-all"
               :src="i.content"
               :alt="history[index-1].content"/>
        </li>
        <li v-else-if="i.type==='error'" class="chat-item slide-top reply-error">
          {{ i.content }}
        </li>
      </template>
    </template>
  </ul>
</template>

<style scoped>
.loading-item {
  @apply rounded-xl px-2 py-1.5 h-10 shrink-0 w-1/3 animate-pulse
}

.chat-item {
  max-width: 80%;
  @apply break-words rounded-xl px-2 py-1.5
}

.send {
  @apply self-end bg-green-500 text-white dark:bg-green-700 dark:text-gray-300
}

.reply-text {
  @apply self-start bg-gray-200 text-black dark:bg-gray-400
}

.reply-error {
  @apply self-start bg-red-200 dark:bg-red-400 dark:text-black
}

.send::selection {
  @apply text-neutral-900 bg-gray-300
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