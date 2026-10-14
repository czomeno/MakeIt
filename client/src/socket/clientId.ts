// Id estable para esta pestaña/sesión del navegador (no por usuario: dos
// pestañas del mismo usuario tienen cada una el suyo). Viaja en la cabecera
// X-Mutation-Id de cada mutación REST y vuelve en el payload del evento de
// socket correspondiente, así esta pestaña puede distinguir "mi propio
// cambio" (mismo TAB_ID) de "otra pestaña mía, mismo usuario" (actorId
// igual pero clientId distinto) sin confundirlas.
export const TAB_ID = crypto.randomUUID();
