<script setup lang="ts">
import {version} from '../package.json'

const v = ref(version)
</script>

<template>
  <div class="mt-auto shrink-0 h-8">
    <div class="text-center">
      by Jazee V{{ v }} 开发中，非最终版本，且不对AI的结果负责
    </div>
  </div>
</template>

<style scoped>

</style>