<script setup>
import { computed } from 'vue';
import { begrenze, erstelleProjektion, glattePfad, verschiebe } from '../karte.js';
import { STATUS_SYMBOL } from '../symbole.js';

const props = defineProps({
  stadt: { type: Object, required: true },
  pins: { type: Array, default: () => [] },
  markierung: { type: Object, default: null },
  waehlbar: { type: Boolean, default: false },
  ausgewaehlt: { type: [String, null], default: null },
});
const emit = defineEmits(['waehle', 'pin']);

const projektion = computed(() => erstelleProjektion(props.stadt.grenzen));
const umrechnen = (punkte) =>
  punkte.map(([lng, lat]) => [projektion.value.x(lng), projektion.value.y(lat)]);

const strassen = computed(() =>
  props.stadt.karte.strassen.map((s) => ({ ...s, pfad: glattePfad(umrechnen(s.punkte)) })),
);
const wasser = computed(() =>
  props.stadt.karte.wasser.map((w) => ({ ...w, pfad: glattePfad(umrechnen(w.punkte)) })),
);
const gruen = computed(() =>
  props.stadt.karte.gruen.map((g) => ({
    ...g,
    punkte: umrechnen(g.punkte)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' '),
  })),
);
const beschriftung = computed(() =>
  props.stadt.karte.beschriftung.map((b) => ({
    ...b,
    x: projektion.value.x(b.lng),
    y: projektion.value.y(b.lat),
  })),
);

// Done reports at the bottom, the selected one on top.
const rang = (pin) => (pin.id === props.ausgewaehlt ? 2 : pin.status === 'erledigt' ? 0 : 1);
const groesse = (pin) =>
  pin.id === props.ausgewaehlt ? 1.9 : pin.status === 'erledigt' ? 1.05 : 1.35;
const sichtbarePins = computed(() =>
  props.pins
    .map((p) => ({ ...p, x: projektion.value.x(p.lng), y: projektion.value.y(p.lat) }))
    .sort((a, b) => rang(a) - rang(b)),
);

const zeiger = computed(() =>
  props.markierung
    ? { x: projektion.value.x(props.markierung.lng), y: projektion.value.y(props.markierung.lat) }
    : null,
);

function klick(ereignis) {
  if (!props.waehlbar) return;
  const flaeche = ereignis.currentTarget.getBoundingClientRect();
  const x = ((ereignis.clientX - flaeche.left) / flaeche.width) * projektion.value.breite;
  const y = ((ereignis.clientY - flaeche.top) / flaeche.height) * projektion.value.hoehe;
  emit('waehle', { lng: projektion.value.lng(x), lat: projektion.value.lat(y) });
}

const RICHTUNG = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function taste(ereignis) {
  const richtung = RICHTUNG[ereignis.key];
  if (!props.waehlbar || !richtung) return;
  ereignis.preventDefault();
  const { west, ost, sued, nord } = props.stadt.grenzen;
  const start = props.markierung ?? { lng: (west + ost) / 2, lat: (sued + nord) / 2 };
  const schritt = ereignis.shiftKey ? 100 : 25;
  emit(
    'waehle',
    begrenze(verschiebe(start, richtung[0] * schritt, richtung[1] * schritt), props.stadt.grenzen),
  );
}
</script>

<template>
  <svg
    class="ortskarte"
    :class="{ waehlbar }"
    :viewBox="`0 0 ${projektion.breite} ${projektion.hoehe}`"
    :role="waehlbar ? 'application' : 'group'"
    :tabindex="waehlbar ? 0 : undefined"
    :aria-label="
      waehlbar
        ? `Karte von ${stadt.name}. Klicken oder mit den Pfeiltasten den Ort setzen.`
        : `Karte von ${stadt.name} mit den Meldungen`
    "
    @click="klick"
    @keydown="taste"
  >
    <rect class="k-land" :width="projektion.breite" :height="projektion.hoehe" />
    <polygon v-for="g in gruen" :key="g.name" class="k-gruen" :points="g.punkte" />
    <path v-for="w in wasser" :key="w.name" class="k-wasser" :d="w.pfad" :stroke-width="w.breite" />
    <g class="k-strassen">
      <path
        v-for="s in strassen"
        :key="`r-${s.name}`"
        class="k-strasse-rand"
        :d="s.pfad"
        :stroke-width="s.breite + 4"
      />
      <path
        v-for="s in strassen"
        :key="s.name"
        class="k-strasse"
        :d="s.pfad"
        :stroke-width="s.breite"
      />
    </g>
    <text v-for="b in beschriftung" :key="b.text" class="k-text" :x="b.x" :y="b.y">
      {{ b.text }}
    </text>

    <g
      v-for="pin in sichtbarePins"
      :key="pin.id"
      class="k-pin"
      :class="[`pin-${pin.status}`, { gewaehlt: pin.id === ausgewaehlt }]"
      role="button"
      tabindex="0"
      :aria-label="pin.titel"
      :aria-pressed="pin.id === ausgewaehlt"
      :transform="`translate(${pin.x.toFixed(1)} ${pin.y.toFixed(1)}) scale(${groesse(pin)})`"
      @click.stop="emit('pin', pin.id)"
      @keydown.enter.prevent="emit('pin', pin.id)"
      @keydown.space.prevent="emit('pin', pin.id)"
    >
      <!-- A wider invisible circle keeps the click target comfortable at small map sizes. -->
      <circle class="k-pin-flaeche" cx="0" cy="-26" r="26" />
      <path class="k-pin-form" d="M0 0C-5-9-19-18-19-31a19 19 0 0 1 38 0C19-18 5-9 0 0z" />
      <path
        class="k-pin-zeichen"
        :d="STATUS_SYMBOL[pin.status]"
        transform="translate(-13 -44) scale(1.08)"
      />
    </g>

    <g
      v-if="zeiger"
      class="k-zeiger"
      data-testid="markierung"
      :transform="`translate(${zeiger.x.toFixed(1)} ${zeiger.y.toFixed(1)})`"
    >
      <circle class="k-zeiger-hof" r="30" />
      <path d="M0 0C-7-12-26-24-26-42a26 26 0 0 1 52 0C26-24 7-12 0 0z" />
      <circle class="k-zeiger-punkt" cx="0" cy="-42" r="9" />
    </g>
  </svg>
</template>
