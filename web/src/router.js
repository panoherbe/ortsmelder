import { createRouter, createWebHistory } from 'vue-router';
import AnmeldenSeite from './seiten/AnmeldenSeite.vue';
import MeldenSeite from './seiten/MeldenSeite.vue';
import NichtGefundenSeite from './seiten/NichtGefundenSeite.vue';
import StandSeite from './seiten/StandSeite.vue';
import StatusSeite from './seiten/StatusSeite.vue';
import VerwaltungSeite from './seiten/VerwaltungSeite.vue';

export const ROUTEN = [
  { path: '/', name: 'melden', component: MeldenSeite, meta: { titel: 'Melden' } },
  { path: '/stand', name: 'stand', component: StandSeite, meta: { titel: 'Stand prüfen' } },
  {
    path: '/meldung/:code',
    name: 'status',
    component: StatusSeite,
    meta: { titel: 'Ihre Meldung' },
  },
  {
    path: '/verwaltung',
    name: 'verwaltung',
    component: VerwaltungSeite,
    meta: { titel: 'Verwaltung' },
  },
  {
    path: '/verwaltung/anmelden',
    name: 'anmelden',
    component: AnmeldenSeite,
    meta: { titel: 'Anmelden' },
  },
  {
    path: '/:rest(.*)',
    name: 'nicht-gefunden',
    component: NichtGefundenSeite,
    meta: { titel: 'Nicht gefunden' },
  },
];

export function erstelleRouter(history = createWebHistory()) {
  const router = createRouter({
    history,
    routes: ROUTEN,
    scrollBehavior: () => ({ top: 0 }),
  });
  router.afterEach((ziel) => {
    document.title = `${ziel.meta.titel} · Ortsmelder`;
  });
  return router;
}
