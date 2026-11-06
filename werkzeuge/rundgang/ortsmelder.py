"""Walkthrough of the Ortsmelder: one report from the form to the answer, against the real stack.

Every value on screen is a live answer of the application. The numbers on the fact card come from FAKTEN, the
ergebnis.json of a full ./pruefen.sh run. Town, streets and reports are made up.
"""

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
from rundgang import FPS, HELL, Rundgang, faktenkarte, telefonkarte, titelkarte  # noqa: E402

VIEWPORT = {'width': 1280, 'height': 800}
TELEFON = {'width': 390, 'height': 780}

APP = os.environ.get('APP_URL', 'http://localhost:8080')
AUS = Path(os.environ.get('AUS', '/aus'))
FAKTEN = json.loads(Path(os.environ['FAKTEN']).read_text(encoding='utf-8'))
SCHLUESSEL = 'demo-verwaltung'
FUSS = 'Panagiotis Herbe · panoherbe.com'
ZEILE = 'Vue 3 · Node.js · Express · MongoDB'
LIZENZ = 'Offener Code · EUPL-1.2'


def zahl(wert):
    return f'{wert:,}'.replace(',', '.')


def main():
    gruppen = FAKTEN['gruppen']
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=1.5, locale='de-DE',
                                  timezone_id='Europe/Berlin', bypass_csp=True)  # only for the captions
        page = ctx.new_page()
        rg = Rundgang(page, AUS)
        foto = rg.bild

        def klick_auf_karte(anteil_x, anteil_y):
            box = page.locator('.ortskarte').bounding_box()
            x, y = box['x'] + box['width'] * anteil_x, box['y'] + box['height'] * anteil_y
            rg.bewege(x, y)
            for radius, alpha in ((10, 1), (17, .85), (24, .6), (30, .3)):
                rg.zustand['ring'], rg.zustand['ringAlpha'] = radius, alpha
                rg.foto(1 / FPS)
            rg.zustand['ring'] = 0
            page.mouse.click(x, y)

        # The very first screenshot of a new card page can come out tiled; warm it up.
        rg._kartenseite().set_content('<p></p>')
        rg._kartenseite().wait_for_timeout(300)
        rg._kartenseite().screenshot()

        rg.karte(titelkarte('Läuft · erfundene Beispielstadt', 'Ortsmelder',
                            'Etwas ist kaputt? Melden, bearbeiten, beantworten, in einem offenen System.',
                            ZEILE, LIZENZ, FUSS), 4.5,
                 text='Titel: Ortsmelder. Etwas ist kaputt? Melden, bearbeiten, beantworten, in einem offenen System.')

        # --- Melden ---
        page.goto(APP)
        page.wait_for_selector('h1')
        page.evaluate('document.fonts.ready')
        rg.untertitel('Eine Laterne flackert. Melden geht ohne Anmeldung, in drei kurzen Schritten.', rolle='Melden')
        rg.halte(3.6)
        rg.klick(page.locator('.kachel', has_text='Beleuchtung'), danach=0.2)
        rg.untertitel('Erst die Kategorie.', rolle='Melden')
        rg.halte(1.6)
        rg.scrolle(page.evaluate(
            "document.querySelectorAll('.schritt')[1].getBoundingClientRect().top + window.scrollY - 76"))
        rg.untertitel('Dann der Ort: ein Klick auf die Karte oder ein Griff in die Liste.', rolle='Melden')
        rg.halte(2.4)
        klick_auf_karte(0.5, 0.49)
        page.wait_for_selector('[data-testid="nahe"]')
        page.wait_for_timeout(150)
        foto('01-melden')
        rg.untertitel('Die Umkreissuche in MongoDB zeigt sofort, was hier schon bekannt ist.', rolle='Melden')
        rg.halte(4.2)
        rg.scrolle(page.evaluate('document.documentElement.scrollHeight'))
        rg.tippe(page.locator('#beschreibung'), 'Die Laterne am Brunnen flackert.', je_zeichen=0.045, danach=0.3)
        rg.untertitel('Ein, zwei Sätze genügen. Namen braucht es nicht.', rolle='Melden')
        rg.halte(2.4)
        rg.klick(page.get_by_role('button', name='Meldung absenden'), danach=0, warte='[data-testid="vorgangscode"]')
        page.wait_for_timeout(150)
        code = page.get_by_test_id('vorgangscode').inner_text()
        foto('02-danke')
        rg.untertitel('Fertig. Mit diesem Code sieht die meldende Person jederzeit den Stand.', rolle='Melden')
        rg.halte(4.0)

        # --- Verwaltung ---
        page.goto(f'{APP}/verwaltung/anmelden')
        page.wait_for_selector('input[type="password"]')
        rg.untertitel('Die Verwaltung meldet sich mit ihrem Schlüssel an, hier dem der Demo.', rolle='Verwaltung')
        rg.halte(2.2)
        rg.tippe(page.locator('input[type="password"]'), SCHLUESSEL, je_zeichen=0.03, danach=0.1)
        rg.klick(page.get_by_role('button', name='Anmelden'), danach=0, warte='.k-pin')
        page.wait_for_timeout(250)
        foto('03-uebersicht')
        rg.untertitel('Alles auf einen Blick: Stand, Liste und Karte. Die Zahlen kommen aus einer MongoDB-Aggregation.',
                      rolle='Verwaltung')
        rg.halte(5.0)
        rg.klick(page.locator('.eintrag').first, danach=0, warte='[data-testid="detail"]')
        page.wait_for_timeout(150)
        rg.untertitel('Die neue Meldung ist da, ihr Pin auf der Karte hervorgehoben.', rolle='Verwaltung')
        rg.halte(3.2)
        rg.klick(page.locator('.status-wahl label', has_text='In Arbeit'), danach=0.2)
        rg.klick(page.locator('.baustein').first, danach=0.2)
        foto('04-bearbeiten')
        rg.untertitel('Stand setzen, antworten. Ein Textbaustein spart das Tippen.', rolle='Verwaltung')
        rg.halte(3.0)
        rg.scrolle(page.evaluate('window.scrollY') + 300)
        umkreis = page.get_by_test_id('umkreis')
        if umkreis.count():
            rg.untertitel('Darunter steht, was im Umkreis noch offen ist. So fällt eine Häufung gleich auf.',
                          rolle='Verwaltung')
            rg.halte(3.4)
        rg.klick(page.get_by_role('button', name='Speichern'), danach=0,
                 warte=lambda: page.wait_for_function(
                     "document.querySelector('[data-testid=rueckmeldung]').textContent.includes('Gespeichert')"))
        page.wait_for_timeout(250)
        rg.untertitel('Gespeichert. Wenn zwei gleichzeitig ändern, kommt nur eine Änderung durch, die andere Person erfährt es.',
                      rolle='Verwaltung')
        rg.halte(4.2)
        rg.scrolle(page.evaluate('document.documentElement.scrollHeight'))
        alt = dict(rg.zustand)
        rg.zustand.update(text='', zeiger=False, ring=0)
        rg._zeichne()
        page.locator('.auswertung').screenshot(path=str(rg.bilder / '05-auswertung.png'))
        rg.zustand.update(alt)
        rg.untertitel('Wo es sich häuft und was je Kategorie offen ist. Ein Klick filtert die Liste.', rolle='Auswertung')
        rg.halte(4.2)

        # --- Zurück zur meldenden Person ---
        page.goto(f'{APP}/meldung/{code}')
        page.wait_for_selector('[data-testid="antwort"]')
        page.wait_for_timeout(150)
        foto('06-antwort')
        rg.untertitel('Und bei der meldenden Person kommt an: In Arbeit, mit der Antwort der Stadt.', rolle='Stand')
        rg.halte(4.4)

        # --- Telefon ---
        tel_ctx = browser.new_context(viewport=TELEFON, device_scale_factor=2, locale='de-DE',
                                      timezone_id='Europe/Berlin')
        tel = tel_ctx.new_page()
        tel.goto(APP)
        tel.wait_for_selector('h1')
        tel.evaluate('document.fonts.ready')
        tel.wait_for_timeout(200)
        pfad = rg.bilder / '07-telefon.png'
        tel.screenshot(path=str(pfad))
        tel_ctx.close()
        rg.karte(telefonkarte('Keine App', 'Auch auf dem Telefon',
                              'Dieselbe Seite passt sich an, mit der Tastatur ist sie ebenso bedienbar.',
                              Rundgang.als_data_url(pfad), ZEILE, FUSS), 3.6, stil=HELL,
                 text='Auch auf dem Telefon: Dieselbe Seite passt sich an, mit der Tastatur ist sie ebenso bedienbar.')

        rg.karte(faktenkarte(f"Gemessen am {FAKTEN['datum_de']}", 'Was geprüft ist', [
            (f"{zahl(FAKTEN['gesamt']['bestanden'])} Tests", 'alle bestanden, automatisch, mit einem Befehl'),
            (f"{zahl(gruppen['api_echtes_mongodb']['bestanden'])} gegen MongoDB 7",
             'echter Server im Container, nichts nachgebildet'),
            (f"{zahl(gruppen['browser']['bestanden'])} im echten Browser",
             'Abläufe, Tastatur und Barrierefreiheit'),
            (f"{FAKTEN['axe']['verstoesse']} axe-Verstöße",
             f"{zahl(FAKTEN['axe']['pruefungen'])} Prüfungen, Desktop und Telefon, WCAG 2.2 A und AA"),
        ], ZEILE, FUSS), 6.0,
                 text=(f"Gemessen am {FAKTEN['datum_de']}: {zahl(FAKTEN['gesamt']['bestanden'])} Tests bestanden, davon "
                       f"{zahl(gruppen['api_echtes_mongodb']['bestanden'])} gegen echtes MongoDB 7 und "
                       f"{zahl(gruppen['browser']['bestanden'])} im echten Browser; {FAKTEN['axe']['verstoesse']} "
                       f"axe-Verstöße in {zahl(FAKTEN['axe']['pruefungen'])} Prüfungen."))

        rg.karte(titelkarte('Selbst ausprobieren', 'Ein Befehl genügt',
                            'docker compose up --build. Die Stadt und alle Meldungen in diesem Rundgang sind erfunden.',
                            ZEILE, LIZENZ, FUSS), 4.5,
                 text='Selbst ausprobieren: docker compose up --build. Die Stadt und alle Meldungen sind erfunden.')
        rg.schreibe()
        browser.close()


if __name__ == '__main__':
    main()
