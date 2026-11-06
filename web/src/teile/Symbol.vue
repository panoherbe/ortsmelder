<script setup>
defineProps({
  pfad: { type: String, required: true },
  groesse: { type: Number, default: 24 },
});
</script>

<template>
  <svg
    class="symbol"
    viewBox="0 0 24 24"
    :width="groesse"
    :height="groesse"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="pfad" />
  </svg>
</template>
