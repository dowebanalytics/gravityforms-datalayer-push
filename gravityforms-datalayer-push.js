(function () {
  'use strict';

  // ── Utility ────────────────────────────────────────────────────────────────

  function captureUserData(form) {
    try {
      var emailEl   = form.querySelector('input[type="email"]');
      var firstName = '', lastName = '', phone = '', company = '';

      form.querySelectorAll('input[type="text"], input[type="tel"]').forEach(function (input) {
        var name        = (input.name        || '').toLowerCase();
        var placeholder = (input.placeholder || '').toLowerCase();
        var label       = '';

        if (input.id) {
          var labelEl = form.querySelector('label[for="' + input.id + '"]');
          if (labelEl) label = labelEl.textContent.toLowerCase().trim();
        }

        var hint = name + ' ' + placeholder + ' ' + label;

        if (!firstName && /nome|name|first.?name|fname|given/.test(hint) && !/compan|aziend/.test(hint)) {
          firstName = input.value.trim().toLowerCase();
        } else if (!lastName && /cognome|last.?name|lname|surname|family/.test(hint)) {
          lastName = input.value.trim().toLowerCase();
        } else if (!phone && /phone|telefon|tel|mobile|cell/.test(hint)) {
          phone = input.value.trim();
        } else if (!company && /aziend|compan|societ|organiz|firm/.test(hint)) {
          company = input.value.trim();
        }
      });

      return {
        email:      emailEl ? emailEl.value.trim().toLowerCase() : '',
        first_name: firstName,
        last_name:  lastName,
        phone:      phone,
        company:    company
      };
    } catch (e) {
      return {};
    }
  }

  function isNewsletterChecked(form) {
    try {
      var checkbox = form.querySelector('input[name="input_7.1"], input[id$="_7_1"]');
      if (!checkbox) {
        form.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
          var labelEl = cb.id ? form.querySelector('label[for="' + cb.id + '"]') : null;
          var label   = labelEl ? labelEl.textContent.toLowerCase() : '';
          if (/newsletter|marketing|comunicazioni|promozion/.test(label)) checkbox = cb;
        });
      }
      return !!(checkbox && checkbox.checked);
    } catch (e) {
      return false;
    }
  }

  function getFormId(el) {
    try {
      if (el.dataset && el.dataset.formid) return String(el.dataset.formid);
      return (el.id || '').replace('gform_wrapper_', '').replace('gform_', '');
    } catch (e) { return 'unknown'; }
  }

  // ── dataLayer push ─────────────────────────────────────────────────────────

  var fired = {};

  function pushSuccess(formId, method, userData) {
    if (fired[formId]) return;
    fired[formId] = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event:            'contact_form_submit',
      form_id:          'gform_' + formId,
      form_type:        'gravity_forms',
      detection_method: method,
      user_data:        userData || {}
    });
  }

  function pushNewsletter(formId, userData) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event:     'newsletterSubscription',
      form_id:   'gform_' + formId,
      user_data: userData || {}
    });
  }

  // ── Pre-submit: salva dati in sessionStorage ────────────────────────────────

  function attachPreSubmitCapture(form, formId) {
    form.addEventListener('submit', function () {
      try {
        sessionStorage.setItem('gf_user_data_' + formId,  JSON.stringify(captureUserData(form)));
        sessionStorage.setItem('gf_newsletter_' + formId, isNewsletterChecked(form) ? '1' : '0');
      } catch (e) {}
    });
  }

  // ── Conferma non-AJAX: div già nel DOM al caricamento pagina ───────────────

  function checkStaticConfirmation() {
    var candidates = document.querySelectorAll(
      '[id^="gforms_confirmation_message_"], .gform_confirmation_wrapper, .gform_confirmation'
    );

    candidates.forEach(function (el) {
      var formId;
      var idMatch = el.id && el.id.match(/gforms_confirmation_message_(\d+)/);
      if (idMatch) {
        formId = idMatch[1];
      } else {
        var wrapper = el.closest('[id^="gform_wrapper_"]');
        formId = wrapper ? getFormId(wrapper) : 'unknown';
      }

      var userData     = {};
      var isNewsletter = false;
      try {
        var raw = sessionStorage.getItem('gf_user_data_' + formId);
        if (raw) userData = JSON.parse(raw);
        isNewsletter = sessionStorage.getItem('gf_newsletter_' + formId) === '1';
      } catch (e) {}

      pushSuccess(formId, 'page_load_static', userData);
      if (isNewsletter) pushNewsletter(formId, userData);

      try {
        sessionStorage.removeItem('gf_user_data_' + formId);
        sessionStorage.removeItem('gf_newsletter_' + formId);
      } catch (e) {}
    });
  }

  // ── AJAX fallback ──────────────────────────────────────────────────────────

  function loadSavedData(formId) {
    try { return JSON.parse(sessionStorage.getItem('gf_user_data_' + formId) || '{}'); } catch (e) { return {}; }
  }

  function loadSavedNewsletter(formId) {
    try { return sessionStorage.getItem('gf_newsletter_' + formId) === '1'; } catch (e) { return false; }
  }

  function tryGformEvent() {
    try {
      if (window.jQuery) {
        jQuery(document).on('gform_confirmation_loaded', function (event, formId) {
          var id = String(formId);
          pushSuccess(id, 'gform_event', loadSavedData(id));
          if (loadSavedNewsletter(id)) pushNewsletter(id, loadSavedData(id));
        });
        return true;
      }
    } catch (e) {}
    return false;
  }

  function observeWrapper(wrapper) {
    try {
      var formId = getFormId(wrapper);
      var observer = new MutationObserver(function (mutations) {
        try {
          mutations.forEach(function (m) {
            m.addedNodes.forEach(function (node) {
              if (node.nodeType === 1) {
                if (
                  node.classList.contains('gform_confirmation_wrapper') ||
                  node.classList.contains('gform_confirmation') ||
                  (node.querySelector && node.querySelector('.gform_confirmation'))
                ) {
                  pushSuccess(formId, 'mutation_observer', loadSavedData(formId));
                  if (loadSavedNewsletter(formId)) pushNewsletter(formId, loadSavedData(formId));
                }
              }
            });
          });
        } catch (e) {}
      });
      observer.observe(wrapper, { childList: true, subtree: true });
    } catch (e) {}
  }

  function attachIframeMonitor(formId) {
    var attempts = 0;
    function findAndMonitor() {
      var iframe = document.getElementById('gform_ajax_frame_' + formId);
      if (!iframe) {
        if (++attempts < 20) setTimeout(findAndMonitor, 300);
        return;
      }
      iframe.addEventListener('load', function () {
        try {
          var doc  = iframe.contentDocument || iframe.contentWindow.document;
          var html = (doc && doc.body && doc.body.innerHTML) || '';
          if (html.indexOf('gform_confirmation') !== -1 || html.indexOf('gforms_confirmation_message') !== -1) {
            pushSuccess(formId, 'iframe_load', loadSavedData(formId));
            if (loadSavedNewsletter(formId)) pushNewsletter(formId, loadSavedData(formId));
          }
        } catch (e) {}
      });
    }
    findAndMonitor();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    checkStaticConfirmation();

    document.querySelectorAll('[id^="gform_wrapper_"]').forEach(function (wrapper) {
      var formId = getFormId(wrapper);
      var form   = wrapper.querySelector('form[id^="gform_"]');
      if (form) attachPreSubmitCapture(form, formId);
      observeWrapper(wrapper);
      attachIframeMonitor(formId);
    });

    if (!tryGformEvent()) setTimeout(tryGformEvent, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
