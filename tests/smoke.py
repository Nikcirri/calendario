"""Prova completa dell'app nel browser (Chrome), come farebbe una persona, con le foto delle schermate.

Uso (dopo `npm run build`):  python3 tests/smoke.py
Serve Python con Playwright e Google Chrome installati. Non gira su GitHub Actions.
Le foto finiscono in tests/screenshots/ (cartella ignorata da git).
"""
import datetime
import http.server
import pathlib
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SHOTS = ROOT / "tests" / "screenshots"
# Martedì 10 novembre 2026, 13:04: l'orologio dell'app è fermo qui, così la prova dà sempre lo stesso risultato.
NOW = datetime.datetime(2026, 11, 10, 13, 4, 0)
errors = []


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = lambda *a, **k: Quiet(*a, directory=str(DIST), **k)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("  ok -", msg)


def shot(page, name):
    page.wait_for_timeout(350)
    page.screenshot(path=str(SHOTS / f"{name}.png"))


def open_menu(page, item, exact=True):
    page.get_by_role("button", name="Apri il menu").click()
    page.get_by_role("navigation", name="Menu principale").get_by_role("button", name=item, exact=exact).click()
    page.wait_for_timeout(250)


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    httpd = serve()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/index.html"
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="it-IT",
            timezone_id="Europe/Rome",
            has_touch=True,
            is_mobile=True,
            color_scheme="dark",
        )
        page = ctx.new_page()
        page.clock.set_fixed_time(NOW)
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)

        print("Mese")
        page.get_by_role("button", name="Apri il menu").wait_for()
        check(page.locator(".title .main").inner_text() == "Novembre", "il titolo è il mese di oggi")
        check(page.locator(".cell").count() == 42, "la griglia ha 6 settimane")
        check(page.locator(".cell.today .number").inner_text() == "10", "oggi è evidenziato")

        print("Inserimento rapido")
        quick = page.get_by_label("Inserimento rapido: scrivi un impegno, anche con giorno e ora")
        quick.fill("Cena con Marco domani alle 20")
        quick.press("Enter")
        page.get_by_text("Creato: Cena con Marco, domani alle 20:00").wait_for()
        check(page.locator(".cell", has_text="Cena con Marco").count() == 1, "l'evento compare nel giorno giusto")
        check(page.locator(".cell.selected .number").inner_text() == "11", "il giorno scelto diventa domani")
        page.get_by_role("button", name="Torna a oggi, mar 10 nov").click()

        print("Nuovo evento con ripetizione")
        page.get_by_role("button", name="Nuovo evento o promemoria per mar 10 nov").click()
        page.get_by_placeholder("Nome dell’evento").fill("Tirocinio")
        # Inizia da lunedì 2 novembre: così ci sono già giorni passati per il recap.
        page.get_by_label("Giorno di inizio").fill("2026-11-02")
        page.get_by_label("Ora di inizio").fill("08:30")
        page.get_by_label("Ora di fine").fill("14:30")
        page.get_by_role("button", name="Categoria").click()
        page.get_by_role("dialog", name="Categoria").get_by_role("button", name="Lavoro").click()
        page.get_by_role("button", name="Ripeti").click()
        rep = page.get_by_role("dialog", name="Ripeti")
        rep.get_by_role("radio", name="Ogni settimana").click()
        for day in ["martedì", "mercoledì", "giovedì"]:
            rep.get_by_role("button", name=day, exact=True).click()
        check("Ogni settimana, lun, mar, mer e gio." in rep.locator(".summary").inner_text(), "la frase descrive la ripetizione")
        shot(page, "07-ripeti")
        rep.get_by_role("button", name="Fatto").click()
        page.locator(".editor .page-body").evaluate("el => el.scrollTo(0, 0)")
        shot(page, "06-nuovo-evento")
        page.get_by_role("button", name="Salva", exact=True).click()
        page.get_by_text("Evento creato").wait_for()
        check(page.locator(".cell:not(.out) .ev", has_text="Tirocinio").count() == 17, "il tirocinio compare da lunedì a giovedì per tutto il mese")
        check(page.locator(".strip").inner_text().startswith("Lavoro a novembre"), "la striscia delle ore compare in cima al mese")
        check("30 di 102 h" in page.locator(".strip").inner_text(), "con le ore fatte e quelle del mese")
        page.get_by_role("button", name="Torna a oggi, mar 10 nov").click()

        print("Altri eventi")
        quick.fill("Calcetto giovedì dalle 18 alle 19")
        quick.press("Enter")
        page.get_by_text("Creato: Calcetto").wait_for()
        quick.fill("Compleanno di Marta il 22")
        quick.press("Enter")
        page.get_by_text("Creato: Compleanno di Marta").wait_for()
        page.get_by_role("button", name="Torna a oggi, mar 10 nov").click()

        print("Promemoria")
        page.get_by_role("button", name="Nuovo evento o promemoria per mar 10 nov").click()
        page.get_by_role("button", name="Promemoria", exact=True).click()
        page.get_by_placeholder("Es. Pagare la bolletta").fill("Pagare la bolletta")
        page.get_by_label("Ora", exact=True).fill("17:00")
        page.get_by_role("button", name="Salva", exact=True).click()
        page.get_by_text("Promemoria creato").wait_for()
        page.wait_for_timeout(2700)
        shot(page, "01-mese")

        print("Sovrapposizione")
        page.get_by_role("button", name="Nuovo evento o promemoria per mar 10 nov").click()
        page.get_by_placeholder("Nome dell’evento").fill("Dentista")
        page.get_by_label("Ora di inizio").fill("14:00")
        check("Si sovrappone a Tirocinio" in page.locator(".warn").inner_text(), "avvisa della sovrapposizione")
        page.get_by_role("button", name="Annulla").click()
        page.get_by_role("alertdialog").get_by_role("button", name="Esci").click()

        print("Settimana, giorno, programma, anno")
        open_menu(page, "Settimana")
        check(page.locator(".block", has_text="Tirocinio").count() == 4, "la settimana mostra i 4 giorni di tirocinio")
        check(page.locator(".block.reminder", has_text="Pagare la bolletta").count() == 1, "il promemoria è nella griglia")
        shot(page, "02-settimana")
        open_menu(page, "Giorno")
        check(page.locator(".title .main").inner_text() == "Mar 10 nov", "il giorno mostra la data")
        shot(page, "03-giorno")
        open_menu(page, "Programma")
        check(page.locator(".badge", has_text="Oggi").count() == 1, "il programma segna oggi")
        shot(page, "04-programma")
        page.get_by_role("checkbox", name="Pagare la bolletta: fatto").click()
        page.locator(".title.done", has_text="Pagare la bolletta").wait_for()
        print("  ok - il promemoria si segna come fatto")
        open_menu(page, "Anno")
        check(page.locator(".month").count() == 12, "l'anno mostra 12 mesi")
        shot(page, "05-anno")
        page.get_by_role("button", name="Novembre 2026").click()
        check(page.locator(".cell").count() == 42, "dall'anno si torna al mese")

        print("Dettaglio ed eliminazione")
        open_menu(page, "Settimana")
        page.locator(".block", has_text="Tirocinio").nth(2).click()
        detail = page.get_by_role("dialog", name="Evento")
        check("Mercoledì 11 novembre" in detail.inner_text(), "il dettaglio mostra il giorno toccato")
        check("Ogni settimana, lun, mar, mer e gio" in detail.inner_text(), "e la ripetizione")
        shot(page, "08-dettaglio")
        detail.get_by_role("button", name="Elimina").click()
        detail.get_by_role("button", name="Solo mer 11 nov").click()
        page.get_by_text("Eliminato solo questo giorno").wait_for()
        check(page.locator(".block", has_text="Tirocinio").count() == 3, "sparisce solo quel giorno")
        page.get_by_role("button", name="Annulla").click()
        page.wait_for_timeout(300)
        check(page.locator(".block", has_text="Tirocinio").count() == 4, "Annulla lo rimette")

        print("Ore effettive e recap")
        page.locator(".block", has_text="Tirocinio").first.click()
        detail = page.get_by_role("dialog", name="Evento")
        detail.get_by_role("button", name="Correggi").click()
        detail.get_by_label("ore").fill("5")
        detail.get_by_label("minuti").fill("30")
        detail.get_by_role("button", name="Salva", exact=True).click()
        detail.get_by_text("Segnate 5 h 30 min").wait_for()
        print("  ok - le ore corrette restano segnate")
        detail.get_by_role("button", name="Chiudi").click()
        open_menu(page, "Recap del mese")
        recap = page.locator(".page", has_text="Recap")
        check("29 h 30 min" in recap.locator(".total").inner_text(), "il recap conta le ore fatte finora")
        check("29,5 di 101,5 h" in recap.inner_text(), "e quelle del mese per la categoria Lavoro")
        shot(page, "09-recap")
        recap.get_by_role("button", name="Torna al calendario").click()

        print("Categorie: tetto e tariffa")
        page.get_by_role("button", name="Apri il menu").click()
        page.get_by_role("button", name="Gestisci categorie").click()
        page.get_by_role("button", name="Lavoro").click()
        sheet = page.get_by_role("dialog", name="Modifica categoria")
        sheet.get_by_label("Tetto di ore al mese (facoltativo)").fill("100")
        sheet.get_by_label("Tariffa oraria in euro (facoltativa)").fill("10")
        sheet.get_by_role("button", name="Salva").click()
        page.get_by_text("Tetto 100 h al mese · 10 €/h").wait_for()
        print("  ok - la categoria mostra tetto e tariffa")
        shot(page, "10-categorie")
        page.get_by_role("button", name="Indietro").click()
        open_menu(page, "Recap del mese")
        page.get_by_text("compenso stimato 1015 €").wait_for()
        print("  ok - il recap stima il compenso")
        shot(page, "09-recap")
        page.get_by_role("button", name="Torna al calendario").click()

        print("Menu, ricerca, cestino, impostazioni")
        page.get_by_role("button", name="Apri il menu").click()
        shot(page, "11-menu")
        page.get_by_role("checkbox", name="Lavoro").click()
        page.locator(".backdrop").click(position={"x": 370, "y": 400})
        page.wait_for_timeout(300)
        check(page.locator(".block", has_text="Tirocinio").count() == 0, "una categoria nascosta sparisce dal calendario")
        page.get_by_role("button", name="Apri il menu").click()
        page.get_by_role("checkbox", name="Lavoro").click()
        page.locator(".backdrop").click(position={"x": 370, "y": 400})
        page.wait_for_timeout(300)
        check(page.locator(".block", has_text="Tirocinio").count() == 4, "e torna quando la si riaccende")

        page.get_by_role("button", name="Cerca").click()
        page.get_by_label("Cerca tra gli impegni").fill("marta")
        page.get_by_text("1 impegno trovato").wait_for()
        print("  ok - la ricerca trova il compleanno")
        shot(page, "12-ricerca")
        page.locator(".row", has_text="Compleanno di Marta").click()
        detail = page.get_by_role("dialog", name="Evento")
        detail.get_by_role("button", name="Elimina").click()
        page.get_by_text("Evento nel cestino").wait_for()
        page.get_by_role("button", name="Indietro").click()
        open_menu(page, "Cestino", exact=False)
        page.locator(".item", has_text="Compleanno di Marta").wait_for()
        print("  ok - l'evento eliminato è nel cestino")
        shot(page, "13-cestino")
        page.get_by_role("button", name="Ripristina").click()
        page.get_by_text("Il cestino è vuoto").wait_for()
        page.get_by_role("button", name="Indietro").click()

        page.get_by_role("button", name="Apri il menu").click()
        page.get_by_role("button", name="Impostazioni").click()
        shot(page, "14-impostazioni")
        page.get_by_role("switch", name="Festività italiane").click()
        check(page.get_by_role("switch", name="Festività italiane").get_attribute("aria-checked") == "false", "le festività si spengono")
        page.get_by_role("switch", name="Festività italiane").click()
        page.get_by_role("button", name="Torna al calendario").click()

        print("I dati restano dopo aver chiuso e riaperto")
        page.reload()
        page.get_by_role("button", name="Apri il menu").wait_for()
        check(page.locator(".block", has_text="Tirocinio").count() == 4, "gli eventi ci sono ancora e la vista è rimasta Settimana")

        browser.close()
    httpd.shutdown()
    # Il controllo aggiornamenti chiama GitHub: senza internet (o prima della prima versione) fallisce, ed è normale.
    real = [e for e in errors if "api.github.com" not in e and "Failed to load resource" not in e and "ERR_" not in e]
    if real:
        print("ERRORI NELLA CONSOLE:")
        for e in real:
            print("  -", e)
        sys.exit(1)
    print("Tutto bene. Foto in tests/screenshots/")


if __name__ == "__main__":
    main()
