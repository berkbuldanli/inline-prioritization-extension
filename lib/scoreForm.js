/*
 * Priority Scorer — reusable scoring form
 * ---------------------------------------
 * Builds the RICE/ICE input form from the shared METHODS description in
 * lib/scoring.js. The SAME component is used in two places:
 *   - the floating widget on the page (content.js), and
 *   - the "edit" panel inside the popup (popup.js).
 * Building it once here means the fields, tooltips, live math, validation and
 * the score/tier readout always behave identically in both places.
 *
 * Usage:
 *   const form = PriorityScorerForm.create({
 *     method: "RICE",                 // which tab to start on
 *     showTabs: true,                 // show the RICE/ICE switcher?
 *     values: { reach: 500, ... },    // optional starting values
 *     getSameMethodScores: (m) => [], // scores already saved with method m
 *     onChange: (state) => { ... },   // called on every edit
 *   });
 *   container.appendChild(form.element);
 *   form.getState(); // { method, values, score, valid }
 */
(function (global) {
  "use strict";

  const Scoring = global.PriorityScorerScoring;

  function create(options) {
    options = options || {};
    const getSameMethodScores =
      options.getSameMethodScores || function () { return []; };
    const onChange = options.onChange || function () {};

    let method = options.method || "RICE";
    // Remember typed values per method so switching tabs doesn't lose them.
    const valuesByMethod = { RICE: {}, ICE: {} };
    if (options.values) valuesByMethod[method] = Object.assign({}, options.values);

    // --- Build the shell ---------------------------------------------------
    const element = document.createElement("div");
    element.className = "ps-form-wrap";

    // Optional RICE/ICE tab switcher.
    let tabsEl = null;
    if (options.showTabs !== false) {
      tabsEl = document.createElement("div");
      tabsEl.className = "ps-tabs";
      Object.keys(Scoring.METHODS).forEach(function (m) {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "ps-tab" + (m === method ? " ps-tab-active" : "");
        tab.textContent = Scoring.METHODS[m].label;
        tab.dataset.method = m;
        tab.title = Scoring.METHODS[m].summary;
        tab.addEventListener("click", function () {
          if (m === method) return;
          method = m;
          renderFields();
          Array.prototype.forEach.call(tabsEl.children, function (t) {
            t.classList.toggle("ps-tab-active", t.dataset.method === m);
          });
          refresh();
        });
        tabsEl.appendChild(tab);
      });
      element.appendChild(tabsEl);
    }

    // Where the input fields get drawn (redrawn when the method changes).
    const fieldsEl = document.createElement("div");
    fieldsEl.className = "ps-form-fields";
    element.appendChild(fieldsEl);

    // Live score + tier badge.
    const result = document.createElement("div");
    result.className = "ps-result";
    result.innerHTML =
      '<span class="ps-result-label">Score</span>' +
      '<span class="ps-result-right">' +
      '<span class="ps-result-value">—</span>' +
      '<span class="ps-tier ps-tier-none"></span>' +
      "</span>";
    element.appendChild(result);
    const resultValue = result.querySelector(".ps-result-value");
    const tierBadge = result.querySelector(".ps-tier");

    // Validation message ("Enter Reach and Effort…").
    const msg = document.createElement("div");
    msg.className = "ps-form-msg";
    element.appendChild(msg);

    // --- Draw the input fields for the current method ----------------------
    function renderFields() {
      fieldsEl.innerHTML = "";
      const spec = Scoring.METHODS[method];
      const saved = valuesByMethod[method] || {};

      spec.fields.forEach(function (field) {
        const wrap = document.createElement("label");
        wrap.className = "ps-field";

        // Label row: name + optional unit, with a tooltip on hover.
        const labelEl = document.createElement("span");
        labelEl.className = "ps-field-label";
        labelEl.textContent = field.label;
        if (field.unit) {
          const small = document.createElement("small");
          small.textContent = " (" + field.unit + ")";
          labelEl.appendChild(small);
        }
        labelEl.title = field.hint;
        wrap.appendChild(labelEl);

        // The input itself (number or select).
        let input;
        if (field.type === "select") {
          input = document.createElement("select");
          field.options.forEach(function (opt) {
            const o = document.createElement("option");
            o.value = String(opt.value);
            o.textContent = opt.label;
            if (opt.default) o.selected = true;
            input.appendChild(o);
          });
        } else {
          input = document.createElement("input");
          input.type = "number";
          input.step = "any";
          if (field.min != null) input.min = String(field.min);
          if (field.max != null) input.max = String(field.max);
          if (field.placeholder) input.placeholder = field.placeholder;
        }
        input.className = "ps-input";
        input.name = field.name;
        input.title = field.hint;
        // Restore any previously typed/saved value.
        if (saved[field.name] != null && isFinite(saved[field.name])) {
          input.value = String(saved[field.name]);
        }

        input.addEventListener("input", refresh);
        input.addEventListener("change", refresh);
        // Only flag a field red once the user has left it (avoids yelling at an
        // empty form the moment it opens).
        input.addEventListener("blur", function () {
          input.dataset.touched = "1";
          refresh();
        });

        // A short helper line beneath the input, in plain English.
        const hint = document.createElement("span");
        hint.className = "ps-field-hint";
        hint.textContent = field.hint;

        wrap.appendChild(input);
        wrap.appendChild(hint);
        fieldsEl.appendChild(wrap);
      });
    }

    // --- Read the current inputs into { name: number } ---------------------
    function readValues() {
      const values = {};
      Array.prototype.forEach.call(
        fieldsEl.querySelectorAll(".ps-input"),
        function (input) {
          values[input.name] = parseFloat(input.value);
        }
      );
      return values;
    }

    // --- Recompute everything on screen ------------------------------------
    function refresh() {
      const spec = Scoring.METHODS[method];
      const values = readValues();
      valuesByMethod[method] = values; // remember for tab switches

      const perField = spec.validate(values);
      const valid = Object.keys(perField).every(function (k) {
        return perField[k];
      });

      // Flag invalid fields the user has already touched.
      const missing = [];
      Array.prototype.forEach.call(
        fieldsEl.querySelectorAll(".ps-input"),
        function (input) {
          const ok = perField[input.name];
          const touched = input.dataset.touched === "1";
          input.classList.toggle("ps-input-invalid", !ok && touched);
          if (!ok) {
            const f = spec.fields.filter(function (x) { return x.name === input.name; })[0];
            if (f) missing.push(f.label);
          }
        }
      );

      let score = NaN;
      if (valid) {
        score = spec.compute(values);
        resultValue.textContent = Scoring.formatScore(score);
        const tier = Scoring.tierForScore(method, score, getSameMethodScores(method));
        tierBadge.textContent = tier.label;
        tierBadge.className = "ps-tier " + tier.className;
        msg.textContent = "";
      } else {
        resultValue.textContent = "—";
        tierBadge.textContent = "";
        tierBadge.className = "ps-tier ps-tier-none";
        msg.textContent = missing.length
          ? "Enter " + joinWords(missing) + " to see the score."
          : "";
      }

      onChange({ method: method, values: values, score: score, valid: valid });
    }

    // "a", "a and b", "a, b and c"
    function joinWords(arr) {
      if (arr.length <= 1) return arr.join("");
      return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
    }

    // Force every field to show its validation state (used on a failed save).
    function showAllErrors() {
      Array.prototype.forEach.call(
        fieldsEl.querySelectorAll(".ps-input"),
        function (input) { input.dataset.touched = "1"; }
      );
      refresh();
    }

    renderFields();
    refresh();

    return {
      element: element,
      getState: function () {
        const values = readValues();
        const valid = Scoring.isValid(method, values);
        return {
          method: method,
          values: values,
          valid: valid,
          score: valid ? Scoring.METHODS[method].compute(values) : NaN,
        };
      },
      showAllErrors: showAllErrors,
      refresh: refresh,
    };
  }

  global.PriorityScorerForm = { create: create };
})(typeof window !== "undefined" ? window : globalThis);
