const BREITE = 1000;
const METER_JE_GRAD_LAT = 111320;

/** Equirectangular projection of the town's bounding box onto a viewBox 1000 wide. */
export function erstelleProjektion({ west, ost, sued, nord }) {
  const breitengrad = ((sued + nord) / 2) * (Math.PI / 180);
  const hoehe = Math.round((BREITE * (nord - sued)) / ((ost - west) * Math.cos(breitengrad)));
  return {
    breite: BREITE,
    hoehe,
    x: (lng) => ((lng - west) / (ost - west)) * BREITE,
    y: (lat) => ((nord - lat) / (nord - sued)) * hoehe,
    lng: (x) => west + (x / BREITE) * (ost - west),
    lat: (y) => nord - (y / hoehe) * (nord - sued),
  };
}

/** A smooth SVG path through the points (Catmull-Rom as cubic Béziers). */
export function glattePfad(punkte) {
  let pfad = `M${punkte[0][0].toFixed(1)} ${punkte[0][1].toFixed(1)}`;
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [
      punkte[Math.max(i - 1, 0)],
      punkte[i],
      punkte[i + 1],
      punkte[Math.min(i + 2, punkte.length - 1)],
    ];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    pfad += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return pfad;
}

export function verschiebe({ lng, lat }, ostMeter, nordMeter) {
  const breitengrad = lat * (Math.PI / 180);
  return {
    lng: lng + ostMeter / (METER_JE_GRAD_LAT * Math.cos(breitengrad)),
    lat: lat + nordMeter / METER_JE_GRAD_LAT,
  };
}

export function begrenze({ lng, lat }, { west, ost, sued, nord }) {
  return { lng: Math.min(ost, Math.max(west, lng)), lat: Math.min(nord, Math.max(sued, lat)) };
}

export function naechsterOrt(orte, { lng, lat }) {
  const faktor = Math.cos(lat * (Math.PI / 180));
  let bester = orte[0];
  let besterWert = Infinity;
  for (const ort of orte) {
    const wert = ((ort.lng - lng) * faktor) ** 2 + (ort.lat - lat) ** 2;
    if (wert < besterWert) {
      bester = ort;
      besterWert = wert;
    }
  }
  return bester;
}
