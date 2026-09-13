# Orari Mësimor — Shkolla 9-Vjeçare

Aplikacion web (pa server, pa instalim) për menaxhimin e mësuesve, lëndëve, kurrikulës
dhe gjenerimin automatik të orarit mësimor për klasat 6–9 (A, B, C — gjithsej 12 klasa).

## Çfarë bën

- **Mësuesit** — emri, lëndët që jep, norma javore e detyrueshme e orëve.
- **Lëndët** — lista e lëndëve mësimore.
- **Kurrikula** — sa orë/javë ka çdo lëndë, për secilën klasë (6, 7, 8, 9).
- **Caktimet** — cili mësues e jep secilën lëndë, në secilën prej 12 klasave.
- **Gjenero Orarin** — krijon automatikisht orarin javor për të gjitha klasat, duke
  shmangur përplasjet (i njëjti mësues në dy vende njëkohësisht) dhe duke kontrolluar
  normën javore të çdo mësuesi.
- **Kërko Mësues** — shkruaj emrin dhe shiko menjëherë orarin e tij javor.
- **Databaza** — eksporto gjithçka si skedar `.json` (backup / transferim), ose importo
  një skedar të mëparshëm për ta vazhduar punën.
- **Mobile friendly** — funksionon mirë në telefon dhe tablet.

Të dhënat ruhen automatikisht në shfletuesin tënd (localStorage). Për t'i mbajtur në
mënyrë të përhershme ose për t'i kaluar në një kompjuter tjetër, përdor **Eksporto/Importo**
te skeda "Databaza".

## Si ta publikosh falas në GitHub Pages

1. Krijo një repository të ri në GitHub, p.sh. `orari-shkolla`.
2. Ngarko (upload) të gjithë përmbajtjen e këtij folderi (`index.html`, `css/`, `js/`)
   në repository (mund ta bësh drag-and-drop direkt në faqen e GitHub, ose me `git push`).
3. Shko te **Settings → Pages** në repository.
4. Te "Build and deployment", zgjidh **Deploy from a branch**, branch: `main`, folder: `/root`.
5. Ruaj. Pas 1-2 minutash, GitHub do të japë një link të tipit:
   `https://<username>.github.io/orari-shkolla/`
6. Hap linkun — aplikacioni funksionon direkt, pa asnjë server apo databazë shtesë.

### Si të vazhdosh punën në një kompjuter tjetër
1. Në kompjuterin ku ke punuar, shko te **Databaza → Eksporto** dhe shkarko skedarin `.json`.
2. Hap të njëjtin sajt (GitHub Pages) në kompjuterin tjetër.
3. Shko te **Databaza → Importo** dhe zgjidh skedarin `.json` që shkarkove.
4. Të gjitha të dhënat (mësues, lëndë, kurrikula, caktimet, orari) rikthehen menjëherë.

## Radha e rekomanduar e plotësimit

1. **Lëndët** — shto të gjitha lëndët (Matematikë, Gjuhë Shqipe, Anglisht, etj.).
2. **Mësuesit** — shto çdo mësues, zgjidh lëndët që jep dhe normën javore (p.sh. 22 orë).
3. **Kurrikula** — për çdo lëndë, vendos sa orë/javë ka në secilën klasë (6/7/8/9).
4. **Caktimet** — për secilën nga 12 klasat, zgjidh mësuesin për çdo lëndë.
5. **Gjenero Orarin** — kliko butonin; shiko orarin për çdo klasë dhe ngarkesën e mësuesve.
6. **Kërko Mësues** — për të parë shpejt orarin e një mësuesi specifik.

## Shënime teknike

- Nuk ka backend/server — gjithçka funksionon në shfletues (HTML + CSS + JavaScript i pastër).
- Algoritmi i gjenerimit të orarit provon disa here (me rend të rastësishëm) dhe zgjedh
  variantin me më pak konflikte, duke u munduar t'i shpërndajë orët e së njëjtës lëndë
  në ditë të ndryshme. Nëse ka orë "të papërcaktuara" pas gjenerimit, kontrollo nëse
  totali i orëve në kurrikulë e kalon numrin e periudhave në dispozicion (ditë × orë/ditë).
