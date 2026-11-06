import { shallowRef } from 'vue';
import { api } from './api.js';

const grundlagen = shallowRef(null);

export function setzeGrundlagen(wert) {
  grundlagen.value = wert;
}

export function useGrundlagen() {
  return grundlagen;
}

export async function ladeGrundlagen() {
  grundlagen.value ??= await api.grundlagen();
  return grundlagen.value;
}

const namensuche = (liste, id) => liste?.find((e) => e.id === id)?.name ?? id;

export const kategorieName = (id) => namensuche(grundlagen.value?.kategorien, id);
export const statusName = (id) => namensuche(grundlagen.value?.status, id);
