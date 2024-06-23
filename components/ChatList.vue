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
</script>

<template>
  <ul class="overflow-y-auto overflow-x-hidden scrollbar-hide pt-24 pb-16 pl-1 flex flex-col space-y-1">
    <template v-for="(i,index) in history" :key="i.id">
      <template v-if="!i.content">
        <USkeleton class="loading-item"/>
      </template>
      <template v-else>
        <template v-if="i.role==='user'">
          <li v-if="i.type === 'text' || i.type === 'image-prompt'" class="user chat-item user-text">
            {{ i.content }}
          </li>
          <li v-else-if="i.type === 'image'" class="user image-item">
            <template v-for="img_url in i.src_url" :key="img_url">
              <img @click="handleImgZoom($event.target as HTMLImageElement)" :src="img_url" :alt="img_url" class="image"
                   :class="i.src_url?.length === 1 ? 'max-h-64' : (i.src_url?.length === 2 ? 'max-h-32': 'max-h-16')"/>
            </template>
          </li>
        </template>
        <template v-else>
          <li v-if="i.type === 'text'" v-html="md.render(i.content)"
              class="assistant chat-item assistant-text prose prose-pre:break-words prose-pre:whitespace-pre-wrap"
              :class="index+1===history.length && loading ?  'loading':''"/>
          <li v-else-if="i.type === 'image'" class="assistant image-item">
            <template v-for="img_url in i.src_url" :key="img_url">
              <img @click="handleImgZoom($event.target as HTMLImageElement)" :src="img_url" :alt="img_url"
                   class="image"/>
            </template>
          </li>
          <li v-else-if="i.type==='error'" class="assistant chat-item assistant-error">
            {{ i.content }}
          </li>
        </template>
      </template>
    </template>
  </ul>
</template>

<style scoped lang="postcss">
.loading-item {
  @apply rounded-xl px-2 py-1.5 h-10 shrink-0 w-1/3 animate-pulse
}

.user {
  @apply self-end slide-top
}

.assistant {
  @apply slide-top
}

.chat-item {
  @apply break-words rounded-xl px-2 py-1.5 max-w-[95%] md:max-w-[80%]
}

.image-item {
  @apply flex rounded-xl space-x-1 max-w-[95%] md:max-w-[60%]
}

.image {
  @apply cursor-pointer hover:brightness-75 transition-all rounded-md
}

.user-text {
  @apply bg-green-500 text-white dark:bg-green-700 dark:text-gray-300
}

.assistant-text {
  @apply self-start bg-gray-200 text-black dark:bg-gray-400
}

.assistant-error {
  @apply self-start bg-red-200 dark:bg-red-400 dark:text-black
}

.user-text::selection {
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