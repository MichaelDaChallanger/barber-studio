# Barber Studio – web s online rezerváciou

Jednostránkový web (dizajn: tmavohnedé, béžové a biele pásy s oranžovým akcentom) barber shopu so systémom rezervácie termínov. Bez servera, bez buildu a bez externých knižníc: iba HTML, CSS a JavaScript. Dáta sa ukladajú v `localStorage` prehliadača (demo verzia).

## Spustenie

Najjednoduchšie: otvorte súbor `index.html` v prehliadači (dvojklik). Funguje aj priamo zo súboru.

Alebo cez lokálny server (ak ho preferujete):

```bash
npm start          # python3 -m http.server 8080  →  http://localhost:8080
```

Pri prvom spustení sa naplnia ukážkové dáta (25 rezervácií, vždy v budúcnosti vzhľadom na dnešný dátum). Na vyskúšanie správy rezervácií zadajte v sekcii **Moje rezervácie** e-mail `demo@example.com` alebo telefón `0900 123 456`.

## Štruktúra projektu

```
barber-studio/
├── index.html            # všetky sekcie stránky
├── css/styles.css        # dizajn (hnedá/béžová/biela, oranžový akcent, responzivita)
├── js/
│   ├── data.js           # služby, barberi, otváracie hodiny, pravidlá
│   ├── booking-logic.js  # čistá logika: sloty, validácia, vytvorenie, zrušenie, hľadanie
│   ├── storage.js        # localStorage, ukážkové dáta, služba rezervácií
│   └── app.js            # používateľské rozhranie
├── tests/
│   ├── logic.test.js     # unit testy (Node.js, bez závislostí)
│   └── e2e/run_e2e.py    # testy v reálnom prehliadači (Playwright)
├── tools/build_single.py # zloží projekt do jedného súboru dist/barber-studio.html
└── package.json
```

Súbory `data.js`, `booking-logic.js` a `storage.js` fungujú v prehliadači aj v Node.js, vďaka čomu sa rovnaká logika testuje aj bez prehliadača. Skripty sú klasické (nie ES moduly), preto stránka funguje aj po otvorení zo súboru.

## Funkcie

- Hero sekcia so sloganom, tlačidlom „Rezervovať termín“, stavom „teraz otvorené / zatvorené“ a kartou **najbližšieho voľného termínu** (jedno kliknutie predvyplní celý formulár).
- O nás, cenník (10 služieb s popisom, trvaním a cenou), traja barberi s avatarom, bio, zoznamom služieb a pracovnými dňami.
- Rezervačný formulár: služba, barber, dátum (aj rýchly výber najbližších dní), čas, meno, e-mail, telefón, voliteľná poznámka a súhlas so spracovaním údajov.
- Živé zhrnutie rezervácie s cenou, potvrdenie po odoslaní s číslom rezervácie a **pridanie do Google kalendára** (odkaz).
- Mriežka termínov po 30 minútach: voľné, **obsadené** (šrafované a preškrtnuté, nedajú sa vybrať) a nedostupné (minulosť alebo presah cez zatvorenie).
- Moje rezervácie: vyhľadanie podľa e-mailu alebo telefónu (rôzne zápisy čísla sa zjednotia), rozdelenie na nadchádzajúce a históriu, stavy Potvrdená / Uskutočnená / Zrušená, zrušenie s potvrdením.
- Kontakt s adresou, telefónom, e-mailom, mapou a otváracími hodinami (dnešný deň je zvýraznený), pätička s rýchlymi odkazmi.
- Responzívny dizajn (mobil, tablet, desktop), hamburger menu, plynulé posúvanie, zvýraznenie aktívnej sekcie, podpora `prefers-reduced-motion`.
- Prístupnosť: odkaz „Preskočiť na obsah“, popisky všetkých polí, chyby cez `aria-invalid` a `role="alert"`, viditeľný focus, ovládanie klávesnicou (sloty sú skutočné radio tlačidlá), stav nie je vyjadrený len farbou.

## Pravidlá rezervácií

| Pravidlo | Detail |
| --- | --- |
| Otváracie hodiny | Po–Pi 9:00–19:00, So 9:00–14:00, Ne zatvorené |
| Rezervovať je možné | iba v budúcnosti a najviac 60 dní dopredu |
| Mriežka začiatkov | po 30 minútach |
| Trvanie služby | rezervácia blokuje celý interval `[začiatok, začiatok + trvanie)`; služba sa musí zmestiť do otváracích hodín |
| Dostupnosť | termín je obsadený, ak sa prekrýva s inou nezrušenou rezerváciou rovnakého barbera |
| Barber | musí danú službu ponúkať a v ten deň pracovať (Marek Po–So, Tomáš Po–Pi, Lukáš Ut–So) |
| Dvojitá rezervácia | dostupnosť sa pri odoslaní kontroluje znova na aktuálnych dátach (platí aj pre dve karty prehliadača) |
| Zákazník | nemôže mať dve prekrývajúce sa rezervácie |
| Zrušenie | iba potvrdená a ešte nezačatá rezervácia; termín sa ihneď uvoľní |

## Dátový model

```
Service  { id, name, description, duration (min), price (EUR) }
Barber   { id, name, role, bio, workDays[], services[] (id), look }
Booking  { id: "BS-XXXXXX", serviceId, serviceName, barberId, barberName,
           date: "RRRR-MM-DD", time: "HH:MM", endTime, duration, price,
           status: "confirmed" | "cancelled", customer: { name, email, phone },
           note, createdAt, cancelledAt? }
```

Názov služby, meno barbera, cena a trvanie sa pri rezervácii ukladajú ako kópia, takže staré rezervácie ostanú správne, aj keby sa cenník zmenil. Stav „Uskutočnená“ sa nepočíta do úložiska, odvodzuje sa z času.

## Testy

```bash
npm test                               # 35 unit testov logiky (Node.js 18+, bez inštalácie)
```

End-to-end testy (30) bežia v Chromiu a vyžadujú Playwright:

```bash
pip install playwright && playwright install chromium
npm run test:e2e                       # alebo: python3 tests/e2e/run_e2e.py [časť názvu testu]
```

E2E testy majú nastavený pevný čas (nedeľa 11. 10. 2026, 19:55), aby boli ukážkové dáta a očakávané hodnoty deterministické.

## Obmedzenia demo verzie

- Dáta sú iba v prehliadači návštevníka, rezervácie sa medzi zariadeniami nezdieľajú a e-mail sa neodosiela.
- Vyhľadanie rezervácií podľa e-mailu alebo telefónu nemá overenie, čo je pre demo v poriadku. V ostrej prevádzke je potrebný server a overenie (napríklad jednorazový kód v e-maile alebo SMS), inak by rezervácie videl každý, kto pozná cudzí e-mail.
- Mapa je schematická (SVG) s odkazom na OpenStreetMap. Adresa, telefón a e-mail sú fiktívne.
- Písma Oswald a DM Sans sa sťahujú z Google Fonts; bez internetu sa použijú systémové písma.
- Fotografiu do úvodnej sekcie nastavíte premennou `--hero-photo` v `css/styles.css` (napr. `url(img/hero.jpg)`).

## Návrhy na ďalšie vylepšenia

1. Server a databáza (napríklad Node.js s PostgreSQL), aby sa rezervácie zdieľali medzi zariadeniami a administrátor ich videl.
2. Odosielanie potvrdení a pripomienok e-mailom alebo SMS a overenie zákazníka jednorazovým kódom.
3. Administrácia pre barberov: vlastné pracovné hodiny, dovolenky, prestávky, blokovanie termínov.
4. Možnosť „ktorýkoľvek barber“ s automatickým priradením prvého voľného.
5. Zmena termínu (presun rezervácie) a pravidlo zrušenia najneskôr niekoľko hodín vopred.
6. Rezervácia viacerých služieb naraz s automatickým súčtom času a ceny.
7. Čakacia listina pre obsadené dni a zobrazenie kapacity v kalendárovom prehľade mesiaca.
8. Vlastné webové fonty lokálne z priečinka projektu a skutočné fotografie barberov namiesto avatarov.
9. Viacjazyčnosť (sk, en) a PWA režim pre inštaláciu na telefón.

## Jeden súbor

`python3 tools/build_single.py` vytvorí `dist/barber-studio.html` (CSS aj JS vložené priamo), ktorý možno nahrať kamkoľvek ako hotovú stránku.
