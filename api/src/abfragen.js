import { Meldung } from './modelle/meldung.js';

export const UMKREIS_BUERGER_M = 150;
export const UMKREIS_VERWALTUNG_M = 250;

/** Open reports around a point, closest first. $geoNear uses the 2dsphere index on ort.punkt. */
export function meldungenImUmkreis({ lng, lat, meter, grenze, ohneId }) {
  const query = { status: { $ne: 'erledigt' } };
  if (ohneId) query._id = { $ne: ohneId };
  return Meldung.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        key: 'ort.punkt',
        distanceField: 'entfernungMeter',
        maxDistance: meter,
        spherical: true,
        query,
      },
    },
    { $limit: grenze },
    {
      $project: {
        kategorie: 1,
        status: 1,
        'ort.name': 1,
        vorgangscode: 1,
        eingegangenAm: 1,
        entfernungMeter: { $round: ['$entfernungMeter', 0] },
      },
    },
  ]);
}

/** All figures for the overview in one aggregation, so they describe the same moment. */
export async function kennzahlen() {
  const offen = { status: { $ne: 'erledigt' } };
  const [ergebnis] = await Meldung.aggregate([
    {
      $facet: {
        nachStatus: [{ $group: { _id: '$status', anzahl: { $sum: 1 } } }],
        nachKategorie: [
          { $match: offen },
          { $group: { _id: '$kategorie', anzahl: { $sum: 1 } } },
          { $sort: { anzahl: -1, _id: 1 } },
        ],
        schwerpunkte: [
          { $match: offen },
          { $group: { _id: '$ort.name', anzahl: { $sum: 1 } } },
          { $sort: { anzahl: -1, _id: 1 } },
          { $limit: 5 },
        ],
        dauer: [
          { $match: { erledigtAm: { $type: 'date' } } },
          {
            $project: {
              // In minutes: $dateDiff counts unit boundaries, so 10:59 to 11:01 would be one hour.
              stunden: {
                $divide: [
                  {
                    $dateDiff: {
                      startDate: '$eingegangenAm',
                      endDate: '$erledigtAm',
                      unit: 'minute',
                    },
                  },
                  60,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              medianStunden: { $median: { input: '$stunden', method: 'approximate' } },
              anzahl: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);
  return {
    nachStatus: Object.fromEntries(ergebnis.nachStatus.map((s) => [s._id, s.anzahl])),
    nachKategorie: ergebnis.nachKategorie.map((k) => ({ kategorie: k._id, anzahl: k.anzahl })),
    schwerpunkte: ergebnis.schwerpunkte.map((s) => ({ ort: s._id, anzahl: s.anzahl })),
    bearbeitung: ergebnis.dauer[0]
      ? { medianStunden: ergebnis.dauer[0].medianStunden, anzahl: ergebnis.dauer[0].anzahl }
      : null,
  };
}
