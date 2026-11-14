# Todavía Market Manager v6

Base principal: `market-dashboard-6.html`, evolucionada i preparada com PWA mòbil.

## Què incorpora aquesta versió
- Interfície mòbil responsive basada en la base anterior.
- Catàleg, venda ràpida, estoc, finances, break-even, historial i control Bizum.
- Dades locals al dispositiu.
- Còpies JSON i backups rotatius.
- Registre real de transaccions per corregir una venda sense assumir que el mètode de cobrament actual és el de la venda corregida.
- Cua offline de sincronització: si no hi ha cobertura, les dades queden al telèfon i es reintenten quan torna la connexió.
- Identificador de dispositiu i nom de dispositiu.
- Google Sheets com a còpia/centralització opcional.
- Google Apps Script v6 amb idempotència per evitar duplicats quan es reintenten sincronitzacions.
- PWA preparada per GitHub Pages.

## Publicar a GitHub Pages
Puja el contingut d'aquesta carpeta a un repositori i activa GitHub Pages sobre la branca/carpeta corresponent. L'entrada és `index.html`.

## Google Sheets
1. Crea/obre el Google Sheet que vols utilitzar.
2. Extensions → Apps Script.
3. Copia `google-apps-script.js`.
4. Implementa com a aplicació web amb accés segons el teu entorn.
5. Copia la URL del Web App a Configuració → Google Sheets dins l'app.
6. Prova la connexió.

El backend crea/actualitza els fulls Vendes, Productes, Mercats, Bizum, Catàleg, Sessió i Backups segons les funcions utilitzades.

## Important
La primera font de veritat durant un mercat és el dispositiu. Google Sheets és sincronització/còpia. Això permet treballar sense cobertura.
