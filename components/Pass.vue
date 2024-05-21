<script setup lang="ts">
import {useGlobalState} from "~/utils/store";

const {passModal} = useGlobalState()
const access_pass = ref('')

function handlePass() {
  if (!access_pass.value) return
  localStorage.setItem('access_pass', access_pass.value)
  passModal.value = false
}
</script>

<template>
  <UModal v-model="passModal">
    <div class="p-4 flex flex-col space-y-2">
      <div>
        {{ $t('input_password') }}
      </div>
      <div class="flex space-x-2">
        <UInput v-model.trim="access_pass" type="password" @keydown.enter="handlePass" class="flex-1"/>
        <UButton @click="handlePass">{{ $t('confirm') }}</UButton>
      </div>
    </div>
  </UModal>
</template>