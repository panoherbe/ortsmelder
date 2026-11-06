import { randomBytes } from 'node:crypto';
import { neuerVorgangscode } from './fachlich.js';
import { Meldung } from './modelle/meldung.js';
import { naechsterOrt } from './stadt.js';

// Everything here is made up: town, streets, reports and answers.
// [place, offset east in m, offset north in m, category, age in days, state, days to handle, text, answer]
const BEISPIELE = [
  [
    'Marktplatz',
    12,
    -8,
    'licht',
    1,
    'neu',
    null,
    'Die Laterne vor dem Brunnen flackert seit gestern Abend.',
  ],
  [
    'Marktplatz',
    -28,
    20,
    'muell',
    2,
    'in_arbeit',
    null,
    'Der Papierkorb an der Bank quillt über.',
    'Danke! Die Stadtreinigung kommt am Donnerstag vorbei.',
  ],
  [
    'Marktplatz',
    35,
    26,
    'spielplatz',
    4,
    'neu',
    null,
    'Eine Latte der Bank am Brunnen ist locker.',
  ],
  [
    'Bahnhofstraße',
    10,
    15,
    'strasse',
    3,
    'in_arbeit',
    null,
    'Großes Schlagloch auf der rechten Fahrspur Richtung Bahnhof.',
    'Wir haben es uns angesehen. Die Reparatur ist eingeplant.',
  ],
  [
    'Bahnhofstraße',
    -35,
    -25,
    'strasse',
    1,
    'neu',
    null,
    'Gehwegplatte steht hoch, man stolpert leicht.',
  ],
  [
    'Bahnhofsvorplatz',
    5,
    -14,
    'muell',
    6,
    'erledigt',
    2,
    'Sperrmüll neben dem Fahrradständer.',
    'Abgeholt. Vielen Dank für den Hinweis!',
  ],
  [
    'Lindenallee',
    6,
    22,
    'gruen',
    5,
    'weitergeleitet',
    null,
    'Ein großer Ast hängt tief über dem Radweg.',
    'Wir haben das an das Grünflächenamt weitergegeben.',
  ],
  [
    'Lindenallee',
    -5,
    -40,
    'licht',
    9,
    'erledigt',
    3,
    'Zwei Laternen hintereinander sind dunkel.',
    'Leuchtmittel getauscht. Es ist wieder hell.',
  ],
  [
    'Schulweg',
    14,
    3,
    'strasse',
    2,
    'neu',
    null,
    'Der Zebrastreifen vor der Schule ist kaum noch zu sehen.',
  ],
  [
    'Schulweg',
    -20,
    10,
    'licht',
    12,
    'erledigt',
    5,
    'Laterne an der Bushaltestelle brennt auch tagsüber.',
    'Die Schaltuhr ist neu eingestellt.',
  ],
  [
    'Stadtpark',
    30,
    12,
    'gruen',
    3,
    'in_arbeit',
    null,
    'Die Hecke am Eingang ragt weit in den Weg.',
    'Der Rückschnitt ist für nächste Woche geplant.',
  ],
  [
    'Stadtpark',
    -18,
    -22,
    'spielplatz',
    15,
    'erledigt',
    4,
    'Der Trinkbrunnen im Park tropft.',
    'Dichtung erneuert.',
  ],
  [
    'Stadtpark',
    45,
    -30,
    'muell',
    1,
    'neu',
    null,
    'Nach dem Wochenende liegt viel Müll auf der Wiese.',
  ],
  [
    'Gartenstraße',
    8,
    -12,
    'gruen',
    7,
    'erledigt',
    1,
    'Laub verstopft den Abfluss an der Ecke.',
    'Der Abfluss ist wieder frei.',
  ],
  [
    'Gartenstraße',
    -26,
    18,
    'strasse',
    4,
    'neu',
    null,
    'Abgesenkter Bordstein ist mit dem Rollator schwer zu befahren.',
  ],
  [
    'Mühlenweg',
    10,
    8,
    'sonstiges',
    8,
    'weitergeleitet',
    null,
    'Das Straßenschild zeigt in die falsche Richtung.',
    'Das Tiefbauamt kümmert sich darum.',
  ],
  ['Sportplatz', -12, 16, 'muell', 2, 'neu', null, 'Glasscherben am Eingang zum Sportplatz.'],
  [
    'Sportplatz',
    20,
    -18,
    'licht',
    20,
    'erledigt',
    6,
    'Flutlichtmast am Parkplatz bleibt nachts an.',
    'Die Steuerung ist repariert.',
  ],
  [
    'Spielplatz Sonnenwiese',
    6,
    10,
    'spielplatz',
    1,
    'in_arbeit',
    null,
    'Die Kette der kleinen Schaukel ist verdreht.',
    'Der Spielplatzdienst schaut morgen vorbei.',
  ],
  [
    'Spielplatz Sonnenwiese',
    -16,
    -9,
    'spielplatz',
    11,
    'erledigt',
    2,
    'Im Sandkasten liegen Scherben.',
    'Sand gesiebt und aufgefüllt.',
  ],
  [
    'Spielplatz Sonnenwiese',
    22,
    -14,
    'gruen',
    5,
    'neu',
    null,
    'Die Wiese neben der Rutsche steht unter Wasser.',
  ],
  [
    'Am Flussufer',
    15,
    6,
    'gruen',
    3,
    'neu',
    null,
    'Ein umgestürzter Baum liegt halb auf dem Uferweg.',
  ],
  [
    'Am Flussufer',
    -30,
    10,
    'spielplatz',
    18,
    'erledigt',
    7,
    'Die Bank am Aussichtspunkt hat eine lockere Lehne.',
    'Festgeschraubt. Viel Freude beim Ausblick!',
  ],
  [
    'Brücke Lindenallee',
    4,
    9,
    'strasse',
    6,
    'in_arbeit',
    null,
    'Am Geländer der Brücke fehlt eine Strebe.',
    'Absicherung steht, die Reparatur folgt.',
  ],
  [
    'Ringstraße Ost',
    12,
    -10,
    'licht',
    2,
    'neu',
    null,
    'Die Ampel-Beleuchtung am Fußweg ist ausgefallen.',
  ],
  [
    'Ringstraße West',
    -8,
    14,
    'muell',
    10,
    'erledigt',
    1,
    'Altkleider liegen neben dem Container.',
    'Wurde abgeholt.',
  ],
];

const TAG_MS = 24 * 60 * 60 * 1000;
const METER_JE_GRAD_LAT = 111320;

function zuMeldung(beispiel, stadt, jetzt) {
  const [ortName, ostM, nordM, kategorie, alterTage, status, dauerTage, beschreibung, antwort] =
    beispiel;
  const ort = stadt.orte.find((o) => o.name === ortName);
  const lat = ort.lat + nordM / METER_JE_GRAD_LAT;
  const lng = ort.lng + ostM / (METER_JE_GRAD_LAT * Math.cos((ort.lat * Math.PI) / 180));
  const eingegangenAm = new Date(jetzt - alterTage * TAG_MS);
  const verlauf = [{ am: eingegangenAm, status: 'neu' }];
  const erledigtAm = dauerTage ? new Date(eingegangenAm.getTime() + dauerTage * TAG_MS) : undefined;
  if (status !== 'neu') {
    const am = erledigtAm ?? new Date(eingegangenAm.getTime() + TAG_MS / 3);
    verlauf.push({ am, status, antwort });
  }
  return {
    vorgangscode: neuerVorgangscode(randomBytes),
    kategorie,
    beschreibung,
    ort: { punkt: { type: 'Point', coordinates: [lng, lat] }, name: naechsterOrt(stadt, lng, lat) },
    status,
    antwort,
    verlauf,
    erledigtAm,
    eingegangenAm,
    geaendertAm: verlauf.at(-1).am,
  };
}

/** Fills an empty database only, so a restart never touches what someone has entered. */
export async function fuelleDemoDaten(stadt, jetzt = Date.now()) {
  if (await Meldung.exists({})) return 0;
  const dokumente = BEISPIELE.map((b) => zuMeldung(b, stadt, jetzt));
  await Meldung.insertMany(dokumente, { timestamps: false });
  return dokumente.length;
}
