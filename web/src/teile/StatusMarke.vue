<script setup>
import { statusName } from '../grundlagen.js';
import { STATUS_SYMBOL } from '../symbole.js';
import Symbol from './Symbol.vue';

defineProps({ status: { type: String, required: true } });
</script>

<template>
  <span class="status-marke" :class="`status-${status}`">
    <Symbol :pfad="STATUS_SYMBOL[status]" :groesse="14" />
    {{ statusName(status) }}
  </span>
</template>
