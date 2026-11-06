<script setup>
import { ref, watch } from 'vue';
import { api } from '../api.js';
import { datum, datumZeit, meter } from '../format.js';
import { kategorieName, statusName, useGrundlagen } from '../grundlagen.js';
import { KATEGORIE_SYMBOL, STATUS_SYMBOL } from '../symbole.js';
import StatusMarke from './StatusMarke.vue';
import Symbol from './Symbol.vue';

const BAUSTEINE = [
  'Danke für Ihre Meldung! Wir schauen es uns an.',
  'Die Reparatur ist eingeplant.',
  'Erledigt. Vielen Dank für den Hinweis!',
];

const props = defineProps({ meldung: { type: Object, required: true } });
const emit = defineEmits(['geaendert', 'waehle', 'sitzung-abgelaufen']);

const grundlagen = useGrundlagen();
const status = ref(props.meldung.status);
const antwort = ref(props.meldung.antwort ?? '');
const sendet = ref(false);
const rueckmeldung = ref('');
const fehler = ref('');
const titel = ref(null);

// A newer version came in (own save or someone else's): the form has to show that one.
watch(
  () => props.meldung.version,
  () => {
    status.value = props.meldung.status;
    antwort.value = props.meldung.antwort ?? '';
  },
);

defineExpose({ fokussiere: () => titel.value?.focus() });

const hatAenderung = () =>
  status.value !== props.meldung.status || antwort.value.trim() !== (props.meldung.antwort ?? '');

async function speichern() {
  fehler.value = '';
  rueckmeldung.value = '';
  if (!hatAenderung()) {
    rueckmeldung.value = 'Alles schon gespeichert.';
    return;
  }
  sendet.value = true;
  try {
    await api.aendere(props.meldung.id, {
      version: props.meldung.version,
      status: status.value,
      antwort: antwort.value.trim(),
    });
    rueckmeldung.value = 'Gespeichert. Die meldende Person sieht den neuen Stand.';
    emit('geaendert', props.meldung.id);
  } catch (grund) {
    if (grund.status === 401) {
      emit('sitzung-abgelaufen');
    } else if (grund.status === 409) {
      fehler.value = `${grund.message} Wir zeigen Ihnen den aktuellen Stand.`;
      emit('geaendert', props.meldung.id);
    } else {
      fehler.value = grund.felder?.antwort ?? grund.message;
    }
  } finally {
    sendet.value = false;
  }
}
</script>

<template>
  <article class="karte detail" data-testid="detail">
    <div class="meldung-kopf">
      <span class="rund-symbol"><Symbol :pfad="KATEGORIE_SYMBOL[meldung.kategorie]" /></span>
      <div>
        <h2 ref="titel" tabindex="-1">{{ kategorieName(meldung.kategorie) }}</h2>
        <p>
          bei {{ meldung.ort.name
          }}<template v-if="meldung.ort.hinweis"> ({{ meldung.ort.hinweis }})</template>
        </p>
      </div>
      <StatusMarke :status="meldung.status" data-testid="detail-status" />
    </div>

    <p class="detail-text">{{ meldung.beschreibung }}</p>
    <p class="hilfe">
      Eingegangen am {{ datum(meldung.eingegangenAm) }} · Code {{ meldung.vorgangscode }}
    </p>

    <form novalidate @submit.prevent="speichern">
      <fieldset class="status-wahl">
        <legend>Stand</legend>
        <label v-for="s in grundlagen.status" :key="s.id" :class="`wahl-${s.id}`">
          <input v-model="status" type="radio" name="status" :value="s.id" />
          <Symbol :pfad="STATUS_SYMBOL[s.id]" :groesse="16" />
          <span>{{ s.name }}</span>
        </label>
      </fieldset>

      <label class="feld" for="antwort">
        <span>Antwort an die meldende Person</span>
      </label>
      <textarea
        id="antwort"
        v-model="antwort"
        rows="3"
        maxlength="1000"
        data-testid="antwort-feld"
      />
      <div class="bausteine" role="group" aria-label="Textbausteine">
        <button v-for="b in BAUSTEINE" :key="b" class="baustein" type="button" @click="antwort = b">
          {{ b }}
        </button>
      </div>

      <p v-if="fehler" class="meldung meldung-fehler" role="alert">{{ fehler }}</p>
      <div class="knopfreihe">
        <button class="knopf" type="submit" :disabled="sendet">
          {{ sendet ? 'Wird gespeichert …' : 'Speichern' }}
        </button>
        <span class="rueckmeldung" role="status" data-testid="rueckmeldung">
          {{ rueckmeldung }}
        </span>
      </div>
    </form>

    <div v-if="meldung.umkreis.length" class="umkreis" data-testid="umkreis">
      <h3>Im Umkreis von {{ meter(meldung.umkreisMeter) }}</h3>
      <ul>
        <li v-for="u in meldung.umkreis" :key="u.id">
          <button class="textknopf" type="button" @click="emit('waehle', u.id)">
            {{ kategorieName(u.kategorie) }}, {{ meter(u.entfernungMeter) }}
          </button>
          <StatusMarke :status="u.status" />
        </li>
      </ul>
    </div>

    <details class="verlauf">
      <summary>Verlauf</summary>
      <ol class="zeitlauf">
        <li v-for="(e, i) in meldung.verlauf" :key="i">
          <strong>{{ statusName(e.status) }}</strong>
          <time :datetime="e.am">{{ datumZeit(e.am) }}</time>
          <p v-if="e.antwort">{{ e.antwort }}</p>
        </li>
      </ol>
    </details>
  </article>
</template>
