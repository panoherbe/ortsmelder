<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import { datumZeit } from '../format.js';
import { kategorieName, statusName, useGrundlagen } from '../grundlagen.js';
import { KATEGORIE_SYMBOL } from '../symbole.js';
import StatusMarke from '../teile/StatusMarke.vue';
import Symbol from '../teile/Symbol.vue';

const route = useRoute();
const grundlagen = useGrundlagen();
const meldung = ref(null);
const fehler = ref('');
const laedt = ref(true);
const nichtGefunden = ref(false);
const kopierHinweis = ref('');

const neu = computed(() => route.query.neu === '1');
const adresse = computed(() => `${window.location.origin}/meldung/${meldung.value?.vorgangscode}`);

async function lade() {
  laedt.value = true;
  fehler.value = '';
  nichtGefunden.value = false;
  try {
    meldung.value = await api.stand(route.params.code);
  } catch (grund) {
    meldung.value = null;
    fehler.value = grund.message;
    nichtGefunden.value = grund.status === 404;
  } finally {
    laedt.value = false;
  }
}

watch(() => route.params.code, lade, { immediate: true });

async function kopiere() {
  try {
    await navigator.clipboard.writeText(meldung.value.vorgangscode);
    kopierHinweis.value = 'Code kopiert.';
  } catch {
    kopierHinweis.value = 'Bitte notieren Sie den Code von Hand.';
  }
}
</script>

<template>
  <div class="schmal">
    <p v-if="laedt" class="hilfe">Einen Moment …</p>

    <div v-else-if="fehler" class="karte mitte">
      <template v-if="nichtGefunden">
        <h1>Das haben wir nicht gefunden</h1>
        <p>{{ fehler }}</p>
        <router-link class="knopf" to="/stand">Code noch einmal eingeben</router-link>
      </template>
      <template v-else>
        <h1>Gleich geht es weiter</h1>
        <p>{{ fehler }}</p>
        <button class="knopf" type="button" @click="lade">Noch einmal versuchen</button>
      </template>
    </div>

    <template v-else>
      <section v-if="neu" class="danke">
        <h1>Danke! Ihre Meldung ist da.</h1>
        <p>Mit diesem Code sehen Sie jederzeit den Stand:</p>
        <p class="code" data-testid="vorgangscode">{{ meldung.vorgangscode }}</p>
        <div class="knopfreihe">
          <button class="knopf knopf-zweit" type="button" @click="kopiere">Code kopieren</button>
          <router-link class="knopf knopf-zweit" to="/">Noch etwas melden</router-link>
        </div>
        <p class="hilfe" aria-live="polite">
          <template v-if="kopierHinweis">{{ kopierHinweis }}</template>
          <template v-else>Oder merken Sie sich diese Seite: {{ adresse }}</template>
        </p>
      </section>
      <h1 v-else class="seitentitel">Ihre Meldung</h1>

      <article class="karte">
        <div class="meldung-kopf">
          <span class="rund-symbol"><Symbol :pfad="KATEGORIE_SYMBOL[meldung.kategorie]" /></span>
          <div>
            <h2>{{ kategorieName(meldung.kategorie) }}</h2>
            <p>bei {{ meldung.ort.name }}, {{ grundlagen.stadt.name }}</p>
          </div>
          <StatusMarke :status="meldung.status" data-testid="status" />
        </div>

        <div v-if="meldung.antwort" class="antwort" data-testid="antwort">
          <h3>Antwort der Stadt</h3>
          <p>{{ meldung.antwort }}</p>
        </div>

        <h3 class="abstand-oben">Bisher</h3>
        <ol class="zeitlauf">
          <li v-for="(eintrag, i) in meldung.verlauf" :key="i">
            <strong>{{ statusName(eintrag.status) }}</strong>
            <time :datetime="eintrag.am">{{ datumZeit(eintrag.am) }}</time>
          </li>
        </ol>
      </article>
    </template>
  </div>
</template>
