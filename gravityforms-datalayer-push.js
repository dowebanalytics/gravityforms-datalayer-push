(function () {
  'use strict';

  var fired = {};
  var capturedData = {};

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

        if (!firstName && /\bnome\b|\bname\b|first.?name|fname|given/.test(hint) && !/compan|aziend/.test(hint)) {
          firstName = input.value.trim().toLowerCase();
        } else if (!lastName  && /cognome|last.?name|lname|surname|family/.test(hint)) lastName  = input.value.trim().toLowerCase();
          else if (!phone     && /phone|telefon|tel\b|mobile|cell/.test(hint))          phone     = input.value.trim();
          else if (!company   && /aziend|compan|societ|organiz|firm/.test(hint))        company   = input.value.trim();
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

  function getFormId(el) {
    try {
      if (el.dataset && el.dataset.formid) return String(el.dataset.formid);
      return (el.id || '').replace('gform_wrapper_', '').replace('gform_', '');
    } catch (e) { return 'unknown'; }
  }

  function pushSuccess(formId, method) {
    if (fired[formId]) return;
    fired[formId] = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event:            'contact_form_submit',
      form_id:          'gform_' + formId,
      form_type:        'gravity_forms',
      detection_method: method,
      user_data:        capturedData[formId] || {}
    });
  }

  // --- Newsletter: push newsletterSubscription se checkbox marketing flaggata ---
  function pushNewsletterIfChecked(formId) {
    try {
      var wrapper  = document.getElementById('gform_wrapper_' + formId);
      if (!wrapper) return;

      var checkbox = wrapper.querySelector(
        'input[name="input_7.1"], ' +
        'input[id$="_7_1"]'
      );

      // Fallback: cerca per hint su label
      if (!checkbox) {
        wrapper.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
          var label = '';
          if (cb.id) {
            var labelEl = wrapper.querySelector('label[for="' + cb.id + '"]');
            if (labelEl) label = labelEl.textContent.toLowerCase();
          }
          if (/newsletter|marketing|comunicazioni|promozion/.test(label)) {
            checkbox = cb;
          }
        });
      }

      if (checkbox && checkbox.checked) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event:     'newsletterSubscription',
          form_id:   'gform_' + formId,
          user_data: capturedData[formId] || {}
        });
      }
    } catch (e) {}
  }

  function tryGformEvent() {
    try {
      if (window.jQuery) {
        jQuery(document).on('gform_confirmation_loaded', function (event, formId) {
          pushSuccess(String(formId), 'gform_event');
          pushNewsletterIfChecked(String(formId));
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
                  pushSuccess(formId, 'mutation_observer');
                  pushNewsletterIfChecked(formId);
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
          var body = doc && doc.body;
          if (!body) return;
          var html = body.innerHTML || '';
          if (
            html.indexOf('gform_confirmation') !== -1 ||
            html.indexOf('gforms_confirmation_message') !== -1
          ) {
            pushSuccess(formId, 'iframe_load');
            pushNewsletterIfChecked(formId);
          }
        } catch (e) {}
      });
    }

    findAndMonitor();
  }

  function attachCapture(form, formId) {
    try {
      var btn = form.querySelector('[type="submit"]');
      if (btn) {
        btn.addEventListener('click', function () {
          capturedData[formId] = captureUserData(form);
        });
      }
    } catch (e) {}
  }

  function init() {
    try {
      document.querySelectorAll('[id^="gform_wrapper_"]').forEach(function (wrapper) {
        var formId = getFormId(wrapper);
        var form   = wrapper.querySelector('form[id^="gform_"]');

        if (form) attachCapture(form, formId);
        observeWrapper(wrapper);
        attachIframeMonitor(formId);
      });

      if (!tryGformEvent()) {
        setTimeout(tryGformEvent, 500);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
