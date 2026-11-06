<script setup>
import { nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { useGrundlagen } from '../grundlagen.js';

const router = useRouter();
const grundlagen = useGrundlagen();
const schluessel = ref('');
const fehler = ref('');
const sendet = ref(false);
const feld = ref(null);

async function anmelden() {
  fehler.value = '';
  sendet.value = true;
  try {
    await api.anmelden(schluessel.value);
    await router.push({ name: 'verwaltung' });
  } catch (grund) {
    fehler.value = grund.message;
    await nextTick();
    feld.value?.focus();
  } finally {
    sendet.value = false;
  }
}
</script>

<template>
  <div class="schmal">
    <h1 class="seitentitel">Verwaltung</h1>
    <form class="karte" novalidate @submit.prevent="anmelden">
      <label class="feld">
        <span>Schlüssel</span>
        <input
          ref="feld"
          v-model="schluessel"
          type="password"
          autocomplete="current-password"
          :aria-invalid="fehler ? 'true' : undefined"
          :aria-describedby="fehler ? 'fehler-schluessel' : undefined"
        />
      </label>
      <p v-if="fehler" id="fehler-schluessel" class="feldfehler" role="alert">{{ fehler }}</p>
      <button class="knopf" type="submit" :disabled="sendet">Anmelden</button>
      <p v-if="grundlagen.demoSchluessel" class="hilfe abstand-oben" data-testid="demo-hinweis">
        Zum Ausprobieren: <code>{{ grundlagen.demoSchluessel }}</code>
      </p>
    </form>
  </div>
</template>
