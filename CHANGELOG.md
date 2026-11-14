# v6 — canvis sobre market-dashboard-6

- Mantinguda la base funcional de Claude en lloc de substituir-la per una app nova.
- PWA preparada per GitHub Pages.
- Identificació del dispositiu.
- Cua offline de sincronització.
- Idempotència al backend per evitar duplicats en reintents.
- Correcció de la correcció de vendes: ara desfà el mètode de pagament de la transacció real.
- Venda amb Bizum integrada amb el comptador anual; l'entrada manual de Bizum queda com a ajustament separat.
- Correcció del toggle de cost del mercat.
- Correcció de l'estructura del full Productes, que tenia una columna duplicada/inconsistent.
- Backup v6 inclou registre de transaccions i cua pendent.
