# gravityforms-datalayer-push

Script GTM universale che intercetta il successo dell'invio di qualsiasi form **Gravity Forms** e pubblica eventi nel `dataLayer`, completo di `user_data`.

---

## Eventi emessi

### `contact_form_submit`
Emesso ad ogni invio riuscito del form.

```json
{
  "event": "contact_form_submit",
  "form_id": "gform_1",
  "form_type": "gravity_forms",
  "detection_method": "gform_event",
  "user_data": {
    "email": "mario.rossi@example.com",
    "first_name": "mario",
    "last_name": "rossi",
    "phone": "1234567",
    "company": "Acme Srl"
  }
}
```

### `newsletterSubscription`
Emesso solo se l'utente ha flaggato la checkbox di consenso marketing.

```json
{
  "event": "newsletterSubscription",
  "form_id": "gform_1",
  "user_data": {
    "email": "mario.rossi@example.com",
    "first_name": "mario",
    "last_name": "rossi",
    "phone": "1234567",
    "company": "Acme Srl"
  }
}
```

---

## Metodi di detection

| Priorità | `detection_method` | Trigger |
|---|---|---|
| 1 | `gform_event` | `jQuery(document).on('gform_confirmation_loaded')` — evento nativo GF |
| 2 | `mutation_observer` | Comparsa di `.gform_confirmation_wrapper` nel DOM |
| 3 | `iframe_load` | Load dell'iframe `gform_ajax_frame_{id}` con verifica contenuto |

---

## Rilevamento campi user_data

I campi vengono identificati dinamicamente tramite regex su `name`, `placeholder` e testo della `label` associata. Non sono richiesti ID hardcoded.

| Campo | Pattern rilevamento |
|---|---|
| `email` | `input[type="email"]` |
| `first_name` | `nome`, `name`, `first_name`, `fname`, `given` (escluso se contiene `company`/`azienda`) |
| `last_name` | `cognome`, `last_name`, `lname`, `surname`, `family` |
| `phone` | `phone`, `telefon`, `tel`, `mobile`, `cell` |
| `company` | `aziend`, `compan`, `societ`, `organiz`, `firm` |

Lingue supportate: **IT + EN**.

---

## Rilevamento checkbox newsletter

Ricerca in cascata:
1. `input[name="input_7.1"]` — pattern GF standard
2. `input[id$="_7_1"]` — pattern GF generico
3. Fallback regex su label: `newsletter|marketing|comunicazioni|promozion`

---

## Configurazione GTM

1. Crea un nuovo tag **HTML personalizzato**
2. Incolla il contenuto di `gravityforms-datalayer-push.js`
3. Imposta il trigger su **DOM Ready** sulla/e pagina/e con il form
4. Disabilita **Supporto document.write**
5. Crea trigger **Custom Event** `contact_form_submit` e `newsletterSubscription` per GA4, Google Ads, Meta CAPI, ecc.

---

## Compatibilità

- Tutti i form `[id^="gform_wrapper_"]` presenti nel DOM
- Pagine con più form GF simultanei (deduplicazione per `form_id`)
- GF in modalità iframe AJAX (default), con fallback su evento jQuery nativo
