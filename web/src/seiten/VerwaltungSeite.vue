<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { dauer, vorKurzem, zahl } from '../format.js';
import { kategorieName, statusName, useGrundlagen } from '../grundlagen.js';
import { KATEGORIE_SYMBOL, STATUS_SYMBOL } from '../symbole.js';
import MeldungDetail from '../teile/MeldungDetail.vue';
import OrtsKarte from '../teile/OrtsKarte.vue';
import StatusMarke from '../teile/StatusMarke.vue';
import Symbol from '../teile/Symbol.vue';

const router = useRouter();
const grundlagen = useGrundlagen();

const bereit = ref(false);
const fehler = ref('');
const kennzahlen = ref(null);
const liste = ref({ eintraege: [], gesamt: 0, seite: 1, seiten: 1 });
const filter = reactive({ status: '', kategorie: '', ort: '', suche: '' });
const suchtext = ref('');
const ausgewaehlt = ref(null);
const detailBereich = ref(null);
const listenBereich = ref(null);
const laedtMehr = ref(false);
let listenAnfrage = 0;
let detailAnfrage = 0;

const pins = computed(() =>
  liste.value.eintraege.map((m) => ({
    id: m.id,
    lng: m.ort.lng,
    lat: m.ort.lat,
    status: m.status,
    titel: `${kategorieName(m.kategorie)} bei ${m.ort.name}, ${statusName(m.status)}`,
  })),
);

const hatFilter = computed(() => Object.values(filter).some(Boolean));
const groessterKategorieWert = computed(() =>
  Math.max(1, ...(kennzahlen.value?.nachKategorie ?? []).map((k) => k.anzahl)),
);
const groessterOrtWert = computed(() =>
  Math.max(1, ...(kennzahlen.value?.schwerpunkte ?? []).map((k) => k.anzahl)),
);

function pruefeSitzung(grund) {
  if (grund.status === 401) {
    router.replace({ name: 'anmelden' });
    return true;
  }
  fehler.value = grund.message;
  return false;
}

async function ladeKennzahlen() {
  kennzahlen.value = await api.kennzahlen();
}

// Only the newest request counts: a slow answer must not overwrite a newer filter.
async function ladeListe(seite = 1) {
  listenAnfrage += 1;
  const nummer = listenAnfrage;
  const antwort = await api.meldungen({ ...filter, seite });
  if (nummer !== listenAnfrage) return;
  liste.value =
    seite === 1
      ? antwort
      : { ...antwort, eintraege: [...liste.value.eintraege, ...antwort.eintraege] };
}

async function aktualisiere() {
  fehler.value = '';
  try {
    await Promise.all([ladeKennzahlen(), ladeListe()]);
  } catch (grund) {
    pruefeSitzung(grund);
  }
}

async function starte() {
  fehler.value = '';
  try {
    await api.sitzung();
  } catch (grund) {
    pruefeSitzung(grund);
    return;
  }
  bereit.value = true;
  await aktualisiere();
}

onMounted(starte);

async function ladeMehr() {
  if (laedtMehr.value) return;
  laedtMehr.value = true;
  try {
    await ladeListe(liste.value.seite + 1);
  } catch (grund) {
    pruefeSitzung(grund);
  } finally {
    laedtMehr.value = false;
  }
}

watch(filter, async () => {
  try {
    await ladeListe();
  } catch (grund) {
    pruefeSitzung(grund);
  }
});

async function waehle(id) {
  fehler.value = '';
  detailAnfrage += 1;
  const nummer = detailAnfrage;
  try {
    const meldung = await api.meldung(id);
    if (nummer !== detailAnfrage) return;
    ausgewaehlt.value = meldung;
    await nextTick();
    detailBereich.value?.fokussiere();
  } catch (grund) {
    pruefeSitzung(grund);
  }
}

async function nachAenderung(id) {
  await aktualisiere();
  try {
    ausgewaehlt.value = await api.meldung(id);
  } catch (grund) {
    pruefeSitzung(grund);
  }
}

function schalteFilter(name, wert) {
  filter[name] = filter[name] === wert ? '' : wert;
}

async function filtereAusAuswertung(name, wert) {
  schalteFilter(name, wert);
  await nextTick();
  listenBereich.value?.scrollIntoView?.({ block: 'start' });
}

function setzeFilterZurueck() {
  Object.assign(filter, { status: '', kategorie: '', ort: '', suche: '' });
  suchtext.value = '';
}

async function abmelden() {
  await api.abmelden();
  await router.push({ name: 'anmelden' });
}
</script>

<template>
  <div v-if="!bereit && fehler" class="schmal">
    <div class="karte mitte" role="alert">
      <h1>Gleich geht es weiter</h1>
      <p>{{ fehler }}</p>
      <button class="knopf" type="button" @click="starte">Noch einmal versuchen</button>
    </div>
  </div>
  <div v-if="bereit" class="verwaltung">
    <div class="verwaltung-kopf">
      <h1 class="seitentitel">Meldungen in {{ grundlagen.stadt.name }}</h1>
      <button class="knopf knopf-zweit" type="button" @click="abmelden">Abmelden</button>
    </div>

    <p v-if="fehler" class="meldung meldung-fehler" role="alert">{{ fehler }}</p>

    <section v-if="kennzahlen" aria-label="Kennzahlen" class="kennzahlen">
      <button
        v-for="s in grundlagen.status"
        :key="s.id"
        class="kennzahl"
        :class="`kennzahl-${s.id}`"
        type="button"
        :aria-pressed="filter.status === s.id"
        :data-testid="`kennzahl-${s.id}`"
        @click="schalteFilter('status', s.id)"
      >
        <span class="kennzahl-symbol"><Symbol :pfad="STATUS_SYMBOL[s.id]" :groesse="18" /></span>
        <strong>{{ zahl(kennzahlen.nachStatus[s.id] ?? 0) }}</strong>
        <span>{{ s.name }}</span>
      </button>
      <div class="kennzahl kennzahl-dauer" data-testid="kennzahl-dauer">
        <strong>{{
          kennzahlen.bearbeitung ? dauer(kennzahlen.bearbeitung.medianStunden) : '–'
        }}</strong>
        <span>typische Bearbeitungszeit</span>
      </div>
    </section>

    <div class="arbeitsflaeche">
      <section ref="listenBereich" class="spalte-liste" aria-label="Meldungen">
        <form class="filter" role="search" @submit.prevent="filter.suche = suchtext.trim()">
          <label class="feld feld-suche">
            <span>Suche im Text</span>
            <input v-model="suchtext" type="search" data-testid="suche" maxlength="80" />
          </label>
          <button class="knopf knopf-zweit" type="submit">Suchen</button>
          <label class="feld feld-voll">
            <span>Kategorie</span>
            <select v-model="filter.kategorie" data-testid="filter-kategorie">
              <option value="">Alle Kategorien</option>
              <option v-for="k in grundlagen.kategorien" :key="k.id" :value="k.id">
                {{ k.name }}
              </option>
            </select>
          </label>
        </form>
        <p class="listen-info" aria-live="polite" data-testid="anzahl">
          {{ zahl(liste.gesamt) }} {{ liste.gesamt === 1 ? 'Meldung' : 'Meldungen' }}
          <button v-if="hatFilter" class="textknopf" type="button" @click="setzeFilterZurueck">
            Alle zeigen
          </button>
        </p>
        <ul class="liste" data-testid="liste">
          <li v-for="m in liste.eintraege" :key="m.id">
            <button
              class="eintrag"
              :class="{ gewaehlt: ausgewaehlt?.id === m.id }"
              type="button"
              :aria-current="ausgewaehlt?.id === m.id ? 'true' : undefined"
              @click="waehle(m.id)"
            >
              <span class="rund-symbol"><Symbol :pfad="KATEGORIE_SYMBOL[m.kategorie]" /></span>
              <span class="eintrag-text">
                <strong>{{ kategorieName(m.kategorie) }}</strong>
                <span class="eintrag-auszug">{{ m.beschreibung }}</span>
                <span class="eintrag-ort">{{ m.ort.name }} · {{ vorKurzem(m.eingegangenAm) }}</span>
              </span>
              <StatusMarke :status="m.status" />
            </button>
          </li>
        </ul>
        <button
          v-if="liste.seite < liste.seiten"
          class="knopf knopf-zweit"
          type="button"
          :disabled="laedtMehr"
          data-testid="mehr-laden"
          @click="ladeMehr"
        >
          Mehr laden
        </button>
      </section>

      <section class="spalte-detail" aria-label="Ausgewählte Meldung">
        <MeldungDetail
          v-if="ausgewaehlt"
          ref="detailBereich"
          :key="ausgewaehlt.id"
          :meldung="ausgewaehlt"
          @geaendert="nachAenderung"
          @waehle="waehle"
          @sitzung-abgelaufen="router.replace({ name: 'anmelden' })"
        />
        <div v-else class="karte leer">
          <h2>Wählen Sie eine Meldung</h2>
          <p>Aus der Liste oder direkt auf der Karte.</p>
        </div>
      </section>

      <section class="spalte-karte" aria-label="Karte">
        <div class="kartenrahmen karte-klebt">
          <OrtsKarte
            :stadt="grundlagen.stadt"
            :pins="pins"
            :ausgewaehlt="ausgewaehlt?.id ?? null"
            @pin="waehle"
          />
        </div>
        <p
          v-if="liste.gesamt > liste.eintraege.length"
          class="hilfe karte-hinweis"
          data-testid="karte-hinweis"
        >
          Die Karte zeigt die {{ zahl(liste.eintraege.length) }} neuesten von
          {{ zahl(liste.gesamt) }} Meldungen.
        </p>
      </section>
    </div>

    <section v-if="kennzahlen" class="auswertung" aria-label="Auswertung">
      <div class="karte">
        <h2>Wo es sich häuft</h2>
        <ul class="balken">
          <li v-for="s in kennzahlen.schwerpunkte" :key="s.ort">
            <button
              class="balken-knopf"
              type="button"
              :aria-pressed="filter.ort === s.ort"
              @click="filtereAusAuswertung('ort', s.ort)"
            >
              <span>{{ s.ort }}</span>
              <span class="balken-spur">
                <span
                  class="balken-wert"
                  :style="{ width: `${(s.anzahl / groessterOrtWert) * 100}%` }"
                />
              </span>
              <strong>{{ s.anzahl }}</strong>
            </button>
          </li>
        </ul>
      </div>
      <div class="karte">
        <h2>Offen je Kategorie</h2>
        <ul class="balken">
          <li v-for="k in kennzahlen.nachKategorie" :key="k.kategorie">
            <button
              class="balken-knopf"
              type="button"
              :aria-pressed="filter.kategorie === k.kategorie"
              @click="filtereAusAuswertung('kategorie', k.kategorie)"
            >
              <span>{{ kategorieName(k.kategorie) }}</span>
              <span class="balken-spur">
                <span
                  class="balken-wert"
                  :style="{ width: `${(k.anzahl / groessterKategorieWert) * 100}%` }"
                />
              </span>
              <strong>{{ k.anzahl }}</strong>
            </button>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
