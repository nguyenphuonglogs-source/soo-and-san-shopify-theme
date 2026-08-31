/* Soo & San — PDP v2 interactions
   Countdown timers, variant selection, priority-preview add-on, upload state,
   story tabs/accordion, mobile gallery dots, add-to-cart submit. */
(function () {
  "use strict";

  /* ---------------- money formatting ---------------- */
  function formatMoney(cents, format) {
    if (typeof cents === "string") cents = cents.replace(".", "");
    var value = "";
    var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    var formatString = format || "${{amount}}";

    function defaultTo(value, defaultValue) {
      return value == null || value !== value ? defaultValue : value;
    }
    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = defaultTo(precision, 2);
      thousands = defaultTo(thousands, ",");
      decimal = defaultTo(decimal, ".");
      if (isNaN(number) || number == null) return "0";
      number = (number / 100.0).toFixed(precision);
      var parts = number.split(".");
      var dollars = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1" + thousands);
      var centsPart = parts[1] ? decimal + parts[1] : "";
      return dollars + centsPart;
    }

    switch (formatString.match(placeholderRegex)[1]) {
      case "amount":
        value = formatWithDelimiters(cents, 2);
        break;
      case "amount_no_decimals":
        value = formatWithDelimiters(cents, 0);
        break;
      case "amount_with_comma_separator":
        value = formatWithDelimiters(cents, 2, ".", ",");
        break;
      case "amount_no_decimals_with_comma_separator":
        value = formatWithDelimiters(cents, 0, ".", ",");
        break;
      default:
        value = formatWithDelimiters(cents, 2);
    }
    return formatString.replace(placeholderRegex, value);
  }

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function initAll(scope) {
    scope = scope || document;
    initCountdowns(scope);
    initGalleries(scope);
    initStory(scope);
    initHero(scope);
  }

  onReady(function () { initAll(document); });
  document.addEventListener("shopify:section:load", function (e) { initAll(e.target); });

  /* ---------------- countdown ---------------- */
  function initCountdowns(scope) {
    var widgets = scope.querySelectorAll("[data-pdp-countdown]");
    widgets.forEach(function (widget) {
      if (widget.__pdpCountdownInit) return;
      widget.__pdpCountdownInit = true;

      var target = new Date(widget.getAttribute("data-pdp-countdown")).getTime();
      var hoursEl = widget.querySelector('[data-unit="h"]');
      var minsEl = widget.querySelector('[data-unit="m"]');
      var secsEl = widget.querySelector('[data-unit="s"]');

      function tick() {
        var diff = target - Date.now();
        if (isNaN(target) || diff <= 0) {
          if (hoursEl) hoursEl.textContent = "00";
          if (minsEl) minsEl.textContent = "00";
          if (secsEl) secsEl.textContent = "00";
          return;
        }
        var totalSeconds = Math.floor(diff / 1000);
        var h = Math.floor(totalSeconds / 3600);
        var m = Math.floor((totalSeconds % 3600) / 60);
        var s = totalSeconds % 60;
        var pad = function (n) { return String(n).padStart(2, "0"); };
        if (hoursEl) hoursEl.textContent = pad(h);
        if (minsEl) minsEl.textContent = pad(m);
        if (secsEl) secsEl.textContent = pad(s);
      }
      tick();
      setInterval(tick, 1000);
    });
  }

  /* ---------------- mobile gallery dots ---------------- */
  function initGalleries(scope) {
    var galleries = scope.querySelectorAll("[data-pdp-gallery]");
    galleries.forEach(function (gallery) {
      if (gallery.__pdpGalleryInit) return;
      gallery.__pdpGalleryInit = true;

      var track = gallery.querySelector("[data-pdp-gallery-track]");
      var slides = Array.prototype.slice.call(gallery.querySelectorAll("[data-pdp-gallery-slide]"));
      var dots = Array.prototype.slice.call(gallery.querySelectorAll("[data-pdp-gallery-dot]"));
      if (!track || !slides.length) return;

      function setActive(index) {
        dots.forEach(function (dot, i) {
          dot.setAttribute("aria-current", i === index ? "true" : "false");
        });
      }
      dots.forEach(function (dot, i) {
        dot.addEventListener("click", function () {
          slides[i].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
        });
      });

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var index = slides.indexOf(entry.target);
            if (index > -1) setActive(index);
          }
        });
      }, { root: track, threshold: 0.6 });
      slides.forEach(function (slide) { observer.observe(slide); });
    });
  }

  /* ---------------- story tabs / accordion ---------------- */
  function initStory(scope) {
    var blocks = scope.querySelectorAll("[data-pdp-story]");
    blocks.forEach(function (block) {
      if (block.__pdpStoryInit) return;
      block.__pdpStoryInit = true;

      var tabs = Array.prototype.slice.call(block.querySelectorAll("[data-pdp-story-tab]"));
      var panels = Array.prototype.slice.call(block.querySelectorAll("[data-pdp-story-panel]"));

      function select(index) {
        tabs.forEach(function (tab, i) {
          var active = i === index;
          tab.setAttribute("aria-selected", active ? "true" : "false");
          var icon = tab.querySelector("[data-pdp-story-icon]");
          if (icon) icon.textContent = active ? "–" : "+";
        });
        panels.forEach(function (panel, i) {
          panel.hidden = i !== index;
        });
      }

      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () {
          var isAccordion = tab.hasAttribute("data-pdp-story-accordion");
          if (isAccordion) {
            var panel = panels[i];
            var wasOpen = !panel.hidden;
            panel.hidden = wasOpen;
            var icon = tab.querySelector("[data-pdp-story-icon]");
            if (icon) icon.textContent = wasOpen ? "+" : "–";
            tab.setAttribute("aria-selected", wasOpen ? "false" : "true");
          } else {
            select(i);
          }
        });
      });
    });
  }

  /* ---------------- hero: variant picker + upsell + cart ---------------- */
  function initHero(scope) {
    var roots = scope.querySelectorAll("[data-pdp-hero]");
    roots.forEach(function (root) {
      if (root.__pdpHeroInit) return;
      root.__pdpHeroInit = true;

      var moneyFormat = root.getAttribute("data-money-format") || "${{amount}}";
      var variantsJson = root.querySelector("[data-pdp-variants]");
      var variants = [];
      try { variants = JSON.parse(variantsJson.textContent); } catch (e) { variants = []; }

      var form = root.querySelector("#pdp-v2-product-form");
      var variantIdInput = root.querySelector("[data-pdp-variant-id]");
      var priceCompareEl = root.querySelectorAll("[data-pdp-price-compare]");
      var priceNowEl = root.querySelectorAll("[data-pdp-price-now]");
      var priceSaveEl = root.querySelectorAll("[data-pdp-price-save]");
      var subtotalCompareEl = root.querySelectorAll("[data-pdp-subtotal-compare]");
      var subtotalNowEl = root.querySelectorAll("[data-pdp-subtotal-now]");
      var sizeLabelEl = root.querySelectorAll("[data-pdp-size-label]");
      var ctaButtons = root.querySelectorAll("[data-pdp-cta]");
      var errorEls = root.querySelectorAll("[data-pdp-form-error]");

      var frameButtons = Array.prototype.slice.call(root.querySelectorAll("[data-pdp-option-select]"));
      var sizeCycleButtons = Array.prototype.slice.call(root.querySelectorAll("[data-pdp-size-cycle]"));
      var uploadInputs = Array.prototype.slice.call(root.querySelectorAll("[data-pdp-upload-input]"));
      var uploadLabelEls = root.querySelectorAll("[data-pdp-upload-label]");
      var uploadHintEls = root.querySelectorAll("[data-pdp-upload-hint]");
      var upsellToggles = Array.prototype.slice.call(root.querySelectorAll("[data-pdp-priority-toggle]"));

      var priorityVariantId = root.getAttribute("data-priority-variant-id") || "";
      var priorityPrice = parseInt(root.getAttribute("data-priority-price") || "0", 10);
      var priorityAvailable = root.getAttribute("data-priority-available") === "true";

      var selectedOptions = {};
      frameButtons.forEach(function (btn) {
        if (btn.getAttribute("aria-current") === "true") {
          selectedOptions[btn.getAttribute("data-option-position")] = btn.getAttribute("data-option-value");
        }
      });
      var initialSize = root.getAttribute("data-initial-size-value");
      var sizePosition = root.getAttribute("data-size-option-position");
      if (initialSize && sizePosition) selectedOptions[sizePosition] = initialSize;

      var priorityOn = false;

      function findVariant() {
        return variants.find(function (v) {
          return Object.keys(selectedOptions).every(function (pos) {
            return v["option" + pos] === selectedOptions[pos];
          });
        });
      }

      function uniqueSizeValues() {
        var seen = [];
        variants.forEach(function (v) {
          var val = v["option" + sizePosition];
          if (val && seen.indexOf(val) === -1) seen.push(val);
        });
        return seen;
      }

      function setText(list, text) {
        list.forEach(function (el) { el.textContent = text; });
      }
      function setHidden(list, isHidden) {
        list.forEach(function (el) {
          if (isHidden) el.setAttribute("hidden", ""); else el.removeAttribute("hidden");
        });
      }

      function render() {
        var variant = findVariant();
        if (!variant) return;

        if (variantIdInput) variantIdInput.value = variant.id;

        var price = variant.price;
        var compareAt = variant.compare_at_price && variant.compare_at_price > price ? variant.compare_at_price : null;
        var pct = compareAt ? Math.round((1 - price / compareAt) * 100) : null;

        setText(priceNowEl, formatMoney(price, moneyFormat));
        setHidden(priceCompareEl, !compareAt);
        setHidden(priceSaveEl, !compareAt);
        if (compareAt) {
          setText(priceCompareEl, formatMoney(compareAt, moneyFormat));
          setText(priceSaveEl, "Save " + pct + "%");
        }

        var subtotal = price + (priorityOn ? priorityPrice : 0);
        var subtotalCompare = compareAt ? compareAt + (priorityOn ? priorityPrice : 0) : null;
        setText(subtotalNowEl, formatMoney(subtotal, moneyFormat));
        setHidden(subtotalCompareEl, !subtotalCompare);
        if (subtotalCompare) setText(subtotalCompareEl, formatMoney(subtotalCompare, moneyFormat));

        if (sizePosition) setText(sizeLabelEl, selectedOptions[sizePosition] || "");

        ctaButtons.forEach(function (btn) { btn.disabled = !variant.available; });
      }

      frameButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var position = btn.getAttribute("data-option-position");
          var value = btn.getAttribute("data-option-value");
          selectedOptions[position] = value;
          frameButtons
            .filter(function (b) { return b.getAttribute("data-option-position") === position; })
            .forEach(function (b) { b.setAttribute("aria-current", b === btn ? "true" : "false"); });
          render();
        });
      });

      sizeCycleButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var values = uniqueSizeValues();
          if (!values.length) return;
          var current = selectedOptions[sizePosition];
          var idx = values.indexOf(current);
          var next = values[(idx + 1) % values.length];
          selectedOptions[sizePosition] = next;
          render();
        });
      });

      var uploadCtaDefault = root.getAttribute("data-upload-cta-default") || "Add photo";
      var uploadCtaAdded = root.getAttribute("data-upload-cta-added") || "Photo added — replace";

      uploadInputs.forEach(function (input) {
        input.addEventListener("change", function () {
          var file = input.files && input.files[0];
          var added = !!file;
          setText(uploadLabelEls, added ? uploadCtaAdded : uploadCtaDefault);
          if (added) {
            var sizeMb = (file.size / (1024 * 1024)).toFixed(1);
            setText(uploadHintEls, file.name + " · " + sizeMb + " MB · looks good");
          } else {
            setText(uploadHintEls, root.getAttribute("data-upload-hint-default") || "");
          }
          // keep every file input in the (possibly duplicated desktop/mobile) markup in sync
          uploadInputs.forEach(function (other) {
            if (other !== input && file) {
              try {
                var dt = new DataTransfer();
                dt.items.add(file);
                other.files = dt.files;
              } catch (e) { /* DataTransfer not supported: leave as-is */ }
            }
          });
        });
      });

      upsellToggles.forEach(function (toggle) {
        toggle.addEventListener("click", function () {
          priorityOn = !priorityOn;
          upsellToggles.forEach(function (t) { t.setAttribute("aria-pressed", priorityOn ? "true" : "false"); });
          render();
        });
      });

      if (form) {
        form.addEventListener("submit", function (evt) {
          evt.preventDefault();
          var errorMessage = "";
          ctaButtons.forEach(function (btn) { btn.disabled = true; });

          var formData = new FormData(form);
          fetch(window.Shopify && window.Shopify.routes && window.Shopify.routes.root
            ? window.Shopify.routes.root + "cart/add.js"
            : "/cart/add.js", {
            method: "POST",
            headers: { Accept: "application/json" },
            body: formData
          })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
              if (!result.ok) throw new Error(result.data && result.data.description ? result.data.description : "Could not add to bag.");
              if (priorityOn && priorityVariantId && priorityAvailable) {
                return fetch("/cart/add.js", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Accept: "application/json" },
                  body: JSON.stringify({ id: priorityVariantId, quantity: 1 })
                }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
                  .then(function (result2) {
                    if (!result2.ok) throw new Error(result2.data && result2.data.description ? result2.data.description : "Could not add priority preview.");
                  });
              }
            })
            .then(function () {
              window.location.href = window.location.origin + "/cart";
            })
            .catch(function (err) {
              errorMessage = err.message || "Something went wrong. Please try again.";
              errorEls.forEach(function (el) {
                el.textContent = errorMessage;
                el.setAttribute("data-visible", "true");
              });
              ctaButtons.forEach(function (btn) { btn.disabled = false; });
            });
        });
      }

      render();
    });
  }
})();
