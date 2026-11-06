<script setup>
import { nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const code = ref('');
const fehler = ref('');
const feld = ref(null);

async function suche() {
  const wert = code.value.trim();
  if (!wert) {
    fehler.value = 'Bitte geben Sie Ihren Code ein.';
    await nextTick();
    feld.value?.focus();
    return;
  }
  router.push({ name: 'status', params: { code: wert } });
}
</script>

<template>
  <div class="schmal">
    <h1 class="seitentitel">Wie steht es um Ihre Meldung?</h1>
    <form class="karte" novalidate @submit.prevent="suche">
      <label class="feld">
        <span>Ihr Code</span>
        <input
          ref="feld"
          v-model="code"
          type="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="XXXX-XXXX-XX"
          :aria-invalid="fehler ? 'true' : undefined"
          :aria-describedby="fehler ? 'fehler-code' : undefined"
          @input="fehler = ''"
        />
      </label>
      <p v-if="fehler" id="fehler-code" class="feldfehler" role="alert">{{ fehler }}</p>
      <button class="knopf" type="submit">Stand anzeigen</button>
    </form>
  </div>
</template>
