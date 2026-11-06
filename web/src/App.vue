<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ladeGrundlagen, useGrundlagen } from './grundlagen.js';

const grundlagen = useGrundlagen();
const fehler = ref('');
const haupt = ref(null);
const route = useRoute();

async function lade() {
  fehler.value = '';
  try {
    await ladeGrundlagen();
  } catch (grund) {
    fehler.value = grund.message;
  }
}

onMounted(lade);

// A page change is silent for screen readers unless the focus moves with it.
const router = useRouter();
let gestartet = false;
router.isReady().then(() => {
  gestartet = true;
});
watch(
  () => route.path,
  async () => {
    if (!gestartet) return;
    await nextTick();
    haupt.value?.focus({ preventScroll: true });
  },
);
</script>

<template>
  <a class="sprunglink" href="#inhalt">Zum Inhalt springen</a>
  <header class="kopf">
    <div class="kopf-innen">
      <router-link class="marke" to="/">
        <img src="/zeichen.svg" alt="" width="30" height="30" />
        <span>
          Ortsmelder
          <small v-if="grundlagen">{{ grundlagen.stadt.name }}</small>
        </span>
      </router-link>
      <nav aria-label="Hauptnavigation" class="navigation">
        <router-link to="/" exact-active-class="aktiv">Melden</router-link>
        <router-link to="/stand" active-class="aktiv">Stand prüfen</router-link>
        <router-link to="/verwaltung" active-class="aktiv">Verwaltung</router-link>
      </nav>
    </div>
  </header>

  <main id="inhalt" ref="haupt" class="haupt" tabindex="-1">
    <div v-if="fehler" class="karte mitte" role="alert">
      <h1>Gleich geht es weiter</h1>
      <p>{{ fehler }}</p>
      <button class="knopf" type="button" @click="lade">Noch einmal versuchen</button>
    </div>
    <router-view v-else-if="grundlagen" />
  </main>

  <footer class="fuss">
    <p>
      <template v-if="grundlagen?.demo">
        {{ grundlagen.stadt.name }} ist erfunden, alle Meldungen sind Beispiele.
      </template>
      Offener Code unter EUPL-1.2.
    </p>
  </footer>
</template>
