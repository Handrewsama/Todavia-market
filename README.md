# Todavía Market Manager v8 — gestor de petit negoci

PWA offline-first per a Todavía. Manté el gestor de mercats de la v6 i afegeix una capa completa de gestió de negoci.

## Mòduls
- Mercats: vendes, cobraments, estoc, costos, marge i tancament.
- Botiga física: obertura diària, vendes, costos i tancament de caixa del dia.
- Tallers: fitxes de taller, participants, costos, sessions i benefici.
- Facturació: clients, numeració automàtica, IVA configurable, estat, CSV i PDF.
- PDF de factura: es genera al dispositiu i queda guardat dins de la còpia local de la factura per poder-lo regenerar/recuperar. Es pot descarregar o compartir amb la funció nativa d'iPhone; si Mail està disponible, es pot enviar des de la fulla de compartir.
- Clients.
- Despeses.
- Factures de proveïdors.
- Caixa: entrades i sortides.
- Dades d'empresa i configuració de facturació.
- Fiscalitat: perfil fiscal, calendari trimestral, pre-càlcul d’IVA, IRPF orientatiu i exportació dels llibres/resums fiscals.
- Preparació dels models 303 i 130/131 i control de retencions 111/115; enllaços directes a l’AEAT.
- Factures de compra amb base, IVA, IVA deduïble, NIF del proveïdor i tipus d’operació.
- Exportació/importació de la capa de negoci en JSON.

## Dades
La capa de negoci es guarda localment al dispositiu amb `localStorage`. No depèn de Google Sheets per funcionar.

## Google Sheets + Drive
El fitxer `google-apps-script.js` és una API v8 compatible amb el gestor de mercats anterior i amb la nova capa de negoci.

1. Obre el Google Sheet que vols utilitzar.
2. Extensions → Apps Script.
3. Substitueix el codi pel contingut de `google-apps-script.js`.
4. Implementa com a Aplicació web.
5. Accés: qualsevol persona amb l'enllaç (segons la política del teu compte).
6. Enganxa la URL a Configuració → Google Sheets de l'app.

El primer cop que es sincronitza una factura amb PDF, Apps Script crea automàticament una carpeta `Todavía · Factures` a Google Drive i hi desa el PDF. El full `Factures` conserva l'ID i l'URL de Drive.

## Fulls que crea/manté l'API
Vendes, Mercats, Productes, Bizum, Catàleg, Sessió, Backups, Clients, Factures, Linies Factures, Botiga, Tallers, Sessions Tallers, Despeses, Compres, Caixa, Empresa, Fiscalitat i Resum Fiscal.

## Arquitectura prevista
Ara: iPhone/PWA → dades locals → Google Sheets/Drive opcional.
Més endavant: iPhone/PWA → API Cloudflare → base de dades/Drive, amb sincronització multi-dispositiu.


## V9 — VERI*FACTU

La facturació incorpora una classificació independent entre el tractament d'IVA i l'àmbit del RRSIF/VERI*FACTU. Cada factura permet indicar si s'ha d'incloure en VERI*FACTU o si queda fora d'àmbit, amb un motiu documentat. Les operacions exemptes o no subjectes a IVA no es consideren automàticament fora de VERI*FACTU.

El mòdul genera localment un registre de facturació amb hash SHA-256 i encadenament, manté una cua de registres pendents i sincronitza aquests registres amb Google Sheets. La remissió real a l'AEAT encara requereix completar la connexió tècnica/autenticació amb els serveis de l'AEAT abans de posar el SIF en producció.


## V10.2
- Indicador de versió visible al capdamunt del menú desplegable "Espai de treball / Mercat".
- Selector mostra explícitament la versió carregada: V10.2.
- Service Worker amb nova clau de caché per evitar que Safari/PWA mantingui una versió anterior.


### V10.4 — Cache
Aquesta versió incorpora neteja automàtica de Service Workers i caches antigues per evitar que iOS/Safari mantingui una versió anterior de la PWA.
