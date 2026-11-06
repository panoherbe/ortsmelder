# Betrieb

So wird aus der Demo ein echter Betrieb. Die Demo läuft ohne jede Einstellung, nur auf dem eigenen Rechner
(`127.0.0.1`).

## Einstellungen

Alle Werte kommen aus der Umgebung, in Compose aus einer Datei `.env` neben `compose.yaml` (Vorlage: `.env.example`).

| Variable                                                    | Bedeutung                                                       | Standard                      |
| ----------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| `OM_DEMO`                                                   | `1` legt Beispielmeldungen in einer leeren Datenbank an         | in Compose `1`, sonst aus     |
| `OM_VERWALTUNG_SCHLUESSEL`                                  | Schlüssel der Verwaltung; ohne Demo Pflicht, ab 16 Zeichen      | in der Demo `demo-verwaltung` |
| `OM_COOKIE_SECURE`                                          | `1`: Sitzungs-Cookie nur über HTTPS                             | ohne Demo an, in der Demo aus |
| `OM_PROXY_STUFEN`                                           | Anzahl vertrauenswürdiger Proxys vor der Anwendung              | `0`                           |
| `OM_ADRESSE`, `OM_PORT`                                     | Adresse und Port auf dem Rechner                                | `127.0.0.1`, `8080`           |
| `OM_SITZUNG_STUNDEN`                                        | Dauer einer Sitzung                                             | `8`                           |
| `OM_GRENZE_MELDEN`, `OM_GRENZE_ANMELDEN`, `OM_GRENZE_LESEN` | Aufrufe je Adresse: je 10 min, je 15 min (Fehlversuche), je min | `5`, `10`, `300`              |
| `OM_STADT_DATEI`                                            | eigene Stadt als JSON, Aufbau wie `api/stadt/musterstadt.json`  | Musterstadt                   |

`OM_GRENZE_*`, `OM_SITZUNG_STUNDEN` und `OM_STADT_DATEI` gehören zusätzlich unter `environment:` in `compose.yaml`; die
Datei der eigenen Stadt braucht dort auch einen Eintrag unter `volumes:`.

Wer den Schlüssel ändert und neu startet, beendet damit alle laufenden Sitzungen.

## Live gehen

1. `.env` anlegen: `OM_DEMO=0`, eigener Schlüssel, `OM_PROXY_STUFEN=1`.
2. Einen HTTPS-Proxy davorsetzen (Caddy, nginx, Traefik), der `X-Forwarded-For` setzt. Ohne ihn zählen alle
   Besuchenden als eine Adresse, und das Sitzungs-Cookie kommt ohne HTTPS nicht an. Den Port der Anwendung nur für den
   Proxy öffnen (`OM_ADRESSE=127.0.0.1`): Wer ihn direkt erreicht, könnte sich mit einem selbst gesetzten
   `X-Forwarded-For` jeder Aufrufbegrenzung entziehen.
3. Die Demo-Datenbank löschen, falls sie schon lief: `docker compose down -v`.
4. Starten: `docker compose up --build -d --wait`.
5. Sicherung einrichten, etwa täglich `mongodump` aus dem Dienst `mongo`.

MongoDB ist nur im internen Compose-Netz erreichbar und läuft dort ohne eigene Anmeldung. Wer die Datenbank anders
betreibt, setzt `OM_MONGO_URL` mit Zugangsdaten.

Die Aufrufbegrenzung zählt im Speicher des einen Prozesses. Für mehrere Instanzen braucht sie einen gemeinsamen Speicher.

## Eine eigene Stadt

`api/stadt/musterstadt.json` beschreibt Grenzen, benannte Orte und die gezeichnete Karte in Längen- und Breitengraden.
Eine andere Datei mit gleichem Aufbau genügt, die Kartenzeichnung lässt sich etwa aus OpenStreetMap ableiten. Meldungen
außerhalb der Grenzen nimmt der Server nicht an.

## Datenschutz im Betrieb

Das Formular fragt nicht nach Namen oder Kontaktdaten. Der Freitext kann trotzdem Personenbezug enthalten, deshalb
sieht ihn nur die angemeldete Verwaltung. Öffentlich sichtbar sind über die Umkreissuche Kategorie und Stand offener
Meldungen mit grob gerundeter Entfernung, über den Code auch die Antwort der Verwaltung. Die Aufrufbegrenzung hält Adressen nur im Speicher und nur für die Dauer ihres
Fensters; die Anwendung schreibt kein Zugriffsprotokoll. Für einen echten Betrieb braucht es zusätzlich Impressum und
Datenschutzhinweise der betreibenden Stelle sowie eine Löschfrist für alte Meldungen; beides ist nicht enthalten.
