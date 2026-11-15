# CHANGELOG

## v7 — Gestor de petit negoci
- Afegida capa Gestió negoci.
- Afegida botiga física amb obertura/tancament diari i moviments.
- Afegida gestió de tallers i sessions.
- Afegida gestió de clients.
- Afegida facturació amb numeració, IVA i estat.
- Afegida generació de PDF i compartició per correu des del mòbil.
- Afegit emmagatzematge del PDF a la dada local de la factura.
- Afegida sincronització de factures i PDFs a Google Drive via Apps Script.
- Afegides despeses i factures de proveïdors.
- Afegida caixa d'entrades/sortides.
- Afegides dades d'empresa i configuració de factura.
- Afegida exportació/importació de la gestió en JSON.
- Refet Apps Script v7 amb upsert per ID i nous fulls.
- Corregida estructura de `getTallers`.
- Preparat el camí per a la futura versió online amb Cloudflare.

## V8 — Fiscalitat autònoms (2026-11-15)
- Nou mòdul Fiscalitat i obligacions trimestrals.
- Pre-càlcul IVA repercutit/deduïble i diferencial per trimestre.
- Pre-càlcul orientatiu de rendiment per IRPF i selecció 130/131.
- Perfil fiscal configurable.
- Exportació de llibre de factures emeses, rebudes i resums IVA/IRPF.
- Factures de compra ampliades amb base, IVA, IVA deduïble, NIF i operació.
- Google Sheets: Fiscalitat i Resum Fiscal.
- Actualitzat service worker a v8.


## V9 — VERI*FACTU
- Nou apartat VERI*FACTU.
- Separació entre tractament IVA (subjecta/exempta/no subjecta) i àmbit RRSIF.
- Selector per factura: incloure a VERI*FACTU o fora d'àmbit amb motiu.
- Registre de facturació local amb hash SHA-256 i encadenament.
- Estat de remissió: pendent/acceptat/no generat.
- Exportació CSV dels registres VERI*FACTU.
- Sincronització dels registres a Google Sheets.
- No es marca cap registre com enviat a AEAT fins que existeixi confirmació real.

## V10.1 — Identificació visible de versió
- Afegit el selector desplegable de versió al capçal del menú lateral, a la dreta d'«Espai de treball / Mercat».
- La versió carregada actualment es mostra com a **V10**.
