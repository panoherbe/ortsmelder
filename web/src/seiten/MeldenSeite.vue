<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { meter } from '../format.js';
import { kategorieName, useGrundlagen } from '../grundlagen.js';
import { naechsterOrt } from '../karte.js';
import { KATEGORIE_SYMBOL } from '../symbole.js';
import OrtsKarte from '../teile/OrtsKarte.vue';
import StatusMarke from '../teile/StatusMarke.vue';
import Symbol from '../teile/Symbol.vue';

const MAX_TEXT = 1000;

const grundlagen = useGrundlagen();
const router = useRouter();

const eingabe = reactive({ kategorie: '', beschreibung: '', hinweis: '', website: '' });
const ort = ref(null);
const ortAuswahl = ref('');
const fehler = reactive({});
const allgemeinerFehler = ref('');
const sendet = ref(false);
const nahe = ref([]);
const formular = ref(null);

const ortName = computed(() =>
  ort.value ? naechsterOrt(grundlagen.value.stadt.orte, ort.value).name : '',
);

function setzeOrt(neu) {
  ort.value = neu;
  ortAuswahl.value = '';
  delete fehler.ort;
}

function waehleAusListe() {
  const treffer = grundlagen.value.stadt.orte.find((o) => o.name === ortAuswahl.value);
  ort.value = treffer ? { lng: treffer.lng, lat: treffer.lat } : null;
  delete fehler.ort;
}

let warteAufNahe;
watch(ort, (wert) => {
  clearTimeout(warteAufNahe);
  if (!wert) {
    nahe.value = [];
    return;
  }
  warteAufNahe = setTimeout(async () => {
    try {
      const antwort = await api.nahe(wert.lng, wert.lat);
      if (ort.value === wert) nahe.value = antwort.treffer;
    } catch {
      nahe.value = [];
    }
  }, 250);
});
onBeforeUnmount(() => clearTimeout(warteAufNahe));

function pruefe() {
  for (const feld of Object.keys(fehler)) delete fehler[feld];
  if (!eingabe.kategorie) fehler.kategorie = 'Bitte wählen Sie eine Kategorie.';
  if (!ort.value) fehler.ort = 'Bitte wählen Sie einen Ort.';
  if (eingabe.beschreibung.trim().length < 5) {
    fehler.beschreibung = 'Bitte beschreiben Sie kurz, was Ihnen aufgefallen ist.';
  }
  return Object.keys(fehler).length === 0;
}

async function fokussiereErstenFehler() {
  await nextTick();
  formular.value?.querySelector('[aria-invalid="true"], .fehlerhaft input')?.focus();
}

async function absenden() {
  allgemeinerFehler.value = '';
  if (!pruefe()) {
    await fokussiereErstenFehler();
    return;
  }
  sendet.value = true;
  try {
    const { vorgangscode } = await api.melde({
      kategorie: eingabe.kategorie,
      beschreibung: eingabe.beschreibung,
      hinweis: eingabe.hinweis || undefined,
      website: eingabe.website || undefined,
      lng: ort.value.lng,
      lat: ort.value.lat,
    });
    await router.push({ name: 'status', params: { code: vorgangscode }, query: { neu: '1' } });
  } catch (grund) {
    Object.assign(fehler, grund.felder);
    allgemeinerFehler.value = grund.message;
    await fokussiereErstenFehler();
  } finally {
    sendet.value = false;
  }
}
</script>

<template>
  <section class="buehne">
    <p class="vorzeile">{{ grundlagen.stadt.name }}</p>
    <h1>Etwas kaputt? Sagen Sie uns, wo.</h1>
    <p class="einleitung">Drei kurze Schritte, keine Anmeldung. Den Rest übernehmen wir.</p>
  </section>

  <form ref="formular" class="melden" novalidate @submit.prevent="absenden">
    <fieldset class="karte schritt" :class="{ fehlerhaft: fehler.kategorie }">
      <legend><span class="schritt-nr" aria-hidden="true">1</span> Worum geht es?</legend>
      <div class="kacheln">
        <label v-for="k in grundlagen.kategorien" :key="k.id" class="kachel">
          <input
            v-model="eingabe.kategorie"
            type="radio"
            name="kategorie"
            :value="k.id"
            :aria-describedby="fehler.kategorie ? 'fehler-kategorie' : undefined"
            @change="delete fehler.kategorie"
          />
          <Symbol :pfad="KATEGORIE_SYMBOL[k.id]" :groesse="28" />
          <span>{{ k.name }}</span>
        </label>
      </div>
      <p v-if="fehler.kategorie" id="fehler-kategorie" class="feldfehler">
        {{ fehler.kategorie }}
      </p>
    </fieldset>

    <fieldset class="karte schritt" :class="{ fehlerhaft: fehler.ort }">
      <legend><span class="schritt-nr" aria-hidden="true">2</span> Wo ist es?</legend>
      <div class="ort-raster">
        <div class="kartenrahmen">
          <OrtsKarte :stadt="grundlagen.stadt" :markierung="ort" waehlbar @waehle="setzeOrt" />
        </div>
        <div class="ort-felder">
          <label class="feld">
            <span>Ort aus der Liste</span>
            <select
              v-model="ortAuswahl"
              :aria-invalid="fehler.ort ? 'true' : undefined"
              :aria-describedby="fehler.ort ? 'fehler-ort' : undefined"
              data-testid="ort-liste"
              @change="waehleAusListe"
            >
              <option value="">{{ ort ? 'Punkt auf der Karte' : 'Bitte wählen' }}</option>
              <option v-for="o in grundlagen.stadt.orte" :key="o.name" :value="o.name">
                {{ o.name }}
              </option>
            </select>
          </label>
          <p v-if="fehler.ort" id="fehler-ort" class="feldfehler">{{ fehler.ort }}</p>
          <p class="ort-wahl" aria-live="polite" data-testid="ort-wahl">
            <template v-if="ort">Gewählt: bei {{ ortName }}</template>
            <template v-else>Oder tippen Sie einfach auf die Karte.</template>
          </p>
          <label class="feld">
            <span>Genauer Hinweis <small>(freiwillig)</small></span>
            <input v-model="eingabe.hinweis" type="text" maxlength="120" autocomplete="off" />
          </label>
          <div v-if="nahe.length" class="nahe" data-testid="nahe">
            <h2>Hier wissen wir schon von</h2>
            <ul>
              <li v-for="(n, i) in nahe" :key="i">
                <span
                  >{{ kategorieName(n.kategorie) }}, rund
                  {{ meter(n.entfernungMeter) }} entfernt</span
                >
                <StatusMarke :status="n.status" />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </fieldset>

    <div class="karte schritt">
      <h2 class="schritt-titel">
        <span class="schritt-nr" aria-hidden="true">3</span>
        <label for="beschreibung">Was ist zu sehen?</label>
      </h2>
      <textarea
        id="beschreibung"
        v-model="eingabe.beschreibung"
        rows="4"
        :maxlength="MAX_TEXT"
        :aria-invalid="fehler.beschreibung ? 'true' : undefined"
        aria-describedby="beschreibung-hilfe"
        @input="delete fehler.beschreibung"
      />
      <p id="beschreibung-hilfe" class="hilfe">
        <span v-if="fehler.beschreibung" class="feldfehler">{{ fehler.beschreibung }}</span>
        <span v-else>Ein, zwei Sätze genügen. Namen brauchen wir nicht.</span>
        <span>{{ eingabe.beschreibung.length }} / {{ MAX_TEXT }}</span>
      </p>
      <!-- Stays empty for people: hidden from sight and from assistive technology. -->
      <input
        v-model="eingabe.website"
        class="unsichtbar-feld"
        type="text"
        name="website"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
      />
    </div>

    <div class="absenden">
      <p v-if="allgemeinerFehler" class="meldung meldung-fehler" role="alert">
        {{ allgemeinerFehler }}
      </p>
      <button class="knopf knopf-gross" type="submit" :disabled="sendet">
        {{ sendet ? 'Wird gesendet …' : 'Meldung absenden' }}
      </button>
    </div>
  </form>
</template>
