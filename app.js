/**
 * app.js – používateľské rozhranie: vykresľovanie sekcií, rezervačný formulár,
 * potvrdenie, správa rezervácií a navigácia.
 *
 * Používateľské vstupy sa nikdy nevkladajú cez innerHTML (iba cez textContent),
 * takže meno ani poznámka zákazníka nemôžu vložiť HTML ani skript.
 */
(function () {
  'use strict';

  const Data = window.BarberData;
  const Logic = window.BookingLogic;
  const Store = window.BookingStorage;

  const now = () => new Date();
  const bookings = Store.createBookingService({ now });

  /* ------------------------------------------------------------------ */
  /* Pomocné funkcie                                                     */
  /* ------------------------------------------------------------------ */

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  /** Vytvorí DOM element: h('div', { class: 'x', text: '...' }, ...deti). */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, value);
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  const NBSP = ' ';
  const fmtPrice = (n) => String(n).replace('.', ',') + NBSP + '€';
  const fmtDuration = (min) => min + NBSP + 'min';
  const fmtTime = (t) => t.replace(/^0/, '');

  const longDate = new Intl.DateTimeFormat('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const midDate = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long' });
  const chipDate = new Intl.DateTimeFormat('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
  const weekdayName = new Intl.DateTimeFormat('sk-SK', { weekday: 'long' });

  const fmtDateLong = (iso) => longDate.format(Logic.parseISODate(iso));
  const fmtDateMid = (iso) => midDate.format(Logic.parseISODate(iso));
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const STATUS_LABELS = { confirmed: 'Potvrdená', cancelled: 'Zrušená', completed: 'Uskutočnená' };
  const DAY_SHORT = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];

  /** Pracovné dni barbera ako text, napr. "Po–So" alebo "Ut–So". */
  function workDaysText(barber) {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const days = order.filter((d) => barber.workDays.includes(d));
    const runs = [];
    days.forEach((d) => {
      const last = runs[runs.length - 1];
      if (last && order.indexOf(d) === order.indexOf(last[last.length - 1]) + 1) last.push(d);
      else runs.push([d]);
    });
    return runs
      .map((run) => (run.length > 2 ? DAY_SHORT[run[0]] + '–' + DAY_SHORT[run[run.length - 1]] : run.map((d) => DAY_SHORT[d]).join(', ')))
      .join(', ');
  }

  /* ------------------------------------------------------------------ */
  /* Avatary barberov (SVG, bez externých obrázkov)                      */
  /* ------------------------------------------------------------------ */

  function avatarSVG(barber) {
    const l = barber.look;
    const hair = {
      slick: `<path d="M36 47c-3-21 11-31 24-31s27 10 23 31c-3-9-8-15-23-15-14 0-20 5-24 15z" fill="${l.hair}"/>`,
      fade: `<path d="M38 45c-1-19 9-27 22-27s23 8 22 27c-3-7-8-9-22-9s-19 2-22 9z" fill="${l.hair}"/>`,
      curly:
        `<g fill="${l.hair}"><circle cx="44" cy="36" r="9"/><circle cx="53" cy="27" r="10"/><circle cx="67" cy="27" r="10"/>` +
        `<circle cx="76" cy="36" r="9"/><circle cx="60" cy="24" r="9"/>` +
        `<path d="M39 47c0-9 4-15 21-15s21 6 21 15c-3-7-8-10-21-10s-18 3-21 10z"/></g>`,
    }[l.style];
    const beard = l.hasBeard
      ? `<path d="M39 52c1 22 11 31 21 31s20-9 21-31c-2 9-7 14-21 14s-19-5-21-14z" fill="${l.beard}"/>`
      : '';
    return (
      '<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' +
      '<rect class="av-bg" width="120" height="120" fill="#d9cdbb"/>' +
      `<rect x="52" y="68" width="16" height="20" rx="7" fill="${l.skin}"/>` +
      '<rect x="52" y="68" width="16" height="20" rx="7" fill="#000" opacity=".18"/>' +
      '<path d="M10 124c3-25 21-38 50-38s47 13 50 38z" fill="#26221c"/>' +
      '<path d="M46 86l14 18 14-18" fill="none" stroke="#f2a05a" stroke-width="3"/>' +
      `<ellipse cx="60" cy="52" rx="21" ry="25" fill="${l.skin}"/>` +
      beard +
      hair +
      '<circle cx="51" cy="51" r="1.9" fill="#1a1410"/><circle cx="69" cy="51" r="1.9" fill="#1a1410"/>' +
      '<path d="M54 63h12" stroke="#000" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  function avatar(barber) {
    const wrap = h('span');
    wrap.innerHTML = avatarSVG(barber); // dáta sú statické, nie od používateľa
    return wrap.firstChild;
  }

  /* ------------------------------------------------------------------ */
  /* Stav formulára                                                      */
  /* ------------------------------------------------------------------ */

  const state = { serviceId: '', barberId: '', date: '', time: '', lookupQuery: '' };

  const els = {
    form: $('#booking-form'),
    layout: $('.booking-layout'),
    service: $('#service'),
    barberChoices: $('#barber-choices'),
    date: $('#date'),
    chips: $('#date-chips'),
    slots: $('#time-slots'),
    slotsMessage: $('#slots-message'),
    legend: $('#slots-legend'),
    name: $('#name'),
    email: $('#email'),
    phone: $('#phone'),
    note: $('#note'),
    noteCount: $('#note-count'),
    consent: $('#consent'),
    formError: $('#form-error'),
    confirmation: $('#confirmation'),
    toast: $('#toast'),
    lookupForm: $('#lookup-form'),
    lookupInput: $('#lookup-input'),
    results: $('#my-bookings-results'),
  };

  const currentService = () => Logic.getService(state.serviceId);
  const currentBarber = () => Logic.getBarber(state.barberId);

  /* ------------------------------------------------------------------ */
  /* Vykresľovanie statických sekcií                                     */
  /* ------------------------------------------------------------------ */

  function renderServices() {
    $('#services-list').replaceChildren(
      ...Data.SERVICES.map((s) =>
        h(
          'li',
          { class: 'menu-item', dataset: { serviceId: s.id } },
          h(
            'div',
            { class: 'menu-row' },
            h('h3', { class: 'menu-name', text: s.name }),
            h('span', { class: 'menu-leader', 'aria-hidden': 'true' }),
            h('span', { class: 'menu-price', text: fmtPrice(s.price) })
          ),
          h('p', { class: 'menu-desc', text: s.description }),
          h(
            'div',
            { class: 'menu-foot' },
            h('span', { class: 'menu-duration', text: 'Trvanie: ' + fmtDuration(s.duration) }),
            h('button', {
              type: 'button',
              class: 'btn btn-ghost btn-small',
              'aria-label': 'Rezervovať službu ' + s.name,
              text: 'Rezervovať',
              onclick: () => startBooking({ serviceId: s.id }),
            })
          )
        )
      )
    );
  }

  function renderBarbers() {
    $('#barbers-list').replaceChildren(
      ...Data.BARBERS.map((b) =>
        h(
          'article',
          { class: 'barber', dataset: { barberId: b.id } },
          h(
            'div',
            { class: 'barber-avatar' },
            avatar(b),
            h('div', { class: 'barber-tag' }, h('h3', { text: b.name }), h('p', { text: b.role }))
          ),
          h(
            'div',
            { class: 'barber-body' },
            h('p', { class: 'barber-bio', text: b.bio }),
            h('p', { class: 'barber-label', text: 'Ponúka' }),
            h('ul', { class: 'barber-services' }, b.services.map((id) => h('li', { text: Logic.getService(id).name }))),
            h('p', { class: 'barber-days', text: 'Pracuje: ' + workDaysText(b) }),
            h('button', {
              type: 'button',
              class: 'btn btn-dark btn-small',
              'aria-label': 'Rezervovať termín u barbera ' + b.name,
              text: 'Rezervovať termín',
              onclick: () => startBooking({ barberId: b.id }),
            })
          )
        )
      )
    );
  }

  /** Oranžová karta s odporúčanou službou vedľa cenníka. */
  function renderFeatured() {
    const s = Logic.getService('kralovsky');
    $('#featured-service').replaceChildren(
      h('p', { class: 'featured-label', text: 'Odporúčame' }),
      h('h3', { text: s.name }),
      h('p', { text: s.description }),
      h('div', { class: 'featured-price' }, h('strong', { text: fmtPrice(s.price) }), h('span', { text: fmtDuration(s.duration) })),
      h('button', {
        type: 'button',
        class: 'btn btn-dark',
        'aria-label': 'Rezervovať službu ' + s.name,
        text: 'Rezervovať balíček',
        onclick: () => startBooking({ serviceId: s.id }),
      })
    );
  }

  /** Rýchla rezervačná karta v hero sekcii: predvyberie službu a barbera vo formulári. */
  function initQuickCard() {
    const serviceSelect = $('#quick-service');
    const barberSelect = $('#quick-barber');
    Data.SERVICES.forEach((s) =>
      serviceSelect.append(h('option', { value: s.id, text: `${s.name} (${fmtDuration(s.duration)}, ${fmtPrice(s.price)})` }))
    );
    Data.BARBERS.forEach((b) => barberSelect.append(h('option', { value: b.id, text: b.name })));

    const sync = () => {
      const service = Logic.getService(serviceSelect.value);
      const barber = Logic.getBarber(barberSelect.value);
      $$('option', serviceSelect).forEach((o) => {
        if (o.value) o.disabled = !!barber && !Logic.barberOffers(barber, o.value);
      });
      $$('option', barberSelect).forEach((o) => {
        if (o.value) o.disabled = !!service && !Logic.barberOffers(Logic.getBarber(o.value), service.id);
      });
    };
    serviceSelect.addEventListener('change', sync);
    barberSelect.addEventListener('change', sync);

    $('#quick-go').addEventListener('click', (event) => {
      event.preventDefault();
      startBooking({ serviceId: serviceSelect.value || undefined, barberId: barberSelect.value || undefined });
    });
  }

  function renderFormChoices() {
    els.service.append(
      ...Data.SERVICES.map((s) =>
        h('option', { value: s.id, text: `${s.name} (${fmtDuration(s.duration)}, ${fmtPrice(s.price)})` })
      )
    );

    els.barberChoices.replaceChildren(
      ...Data.BARBERS.map((b) =>
        h(
          'label',
          { class: 'barber-choice' },
          h('input', { type: 'radio', name: 'barber', value: b.id, id: 'barber-' + b.id }),
          h(
            'span',
            { class: 'barber-choice-body' },
            h('span', { class: 'barber-choice-avatar' }, avatar(b)),
            h(
              'span',
              {},
              h('span', { class: 'barber-choice-name', text: b.name }),
              h('span', { class: 'barber-choice-note', dataset: { role: b.role }, text: b.role })
            )
          )
        )
      )
    );
  }

  function renderOpeningInfo() {
    const t = now();
    const todayIso = Logic.toISODate(t);

    const row = $(`#hours-table tr[data-day="${t.getDay()}"]`);
    if (row) row.classList.add('is-today');

    const el = $('#open-now');
    const hours = Logic.getOpeningHours(todayIso);
    const minutes = t.getHours() * 60 + t.getMinutes();
    el.classList.remove('is-open');

    if (hours && minutes >= Logic.timeToMinutes(hours.open) && minutes < Logic.timeToMinutes(hours.close)) {
      el.classList.add('is-open');
      el.textContent = 'Teraz otvorené, zatvárame o ' + fmtTime(hours.close) + '.';
      return;
    }
    // zatvorené: nájde najbližší otvorený okamih
    let iso = todayIso;
    for (let i = 0; i < 8; i++, iso = Logic.addDays(iso, 1)) {
      const h2 = Logic.getOpeningHours(iso);
      if (!h2) continue;
      if (i === 0 && minutes >= Logic.timeToMinutes(h2.open)) continue;
      const when = i === 0 ? 'dnes' : i === 1 ? 'zajtra' : weekdayName.format(Logic.parseISODate(iso));
      el.textContent = 'Teraz zatvorené. Najbližšie otvárame: ' + when + ' o ' + fmtTime(h2.open) + '.';
      return;
    }
  }

  /** Karta "Najbližší voľný termín" v hero sekcii. */
  function renderNextSlot() {
    const box = $('#next-slot');
    const service = Logic.getService('panski-strih');
    const next = Logic.findNextAvailable({ service, bookings: bookings.getAll(), now: now() });
    if (!next) {
      box.hidden = true;
      return;
    }
    const todayIso = Logic.toISODate(now());
    const dayLabel =
      next.date === todayIso
        ? 'Dnes'
        : next.date === Logic.addDays(todayIso, 1)
        ? 'Zajtra'
        : capitalize(weekdayName.format(Logic.parseISODate(next.date)));

    $('#next-slot-when').textContent = `${dayLabel} o ${fmtTime(next.time)}`;
    $('#next-slot-detail').textContent = `${fmtDateMid(next.date)}, ${next.barber.name}, ${service.name}`;
    const button = $('#next-slot-book');
    button.onclick = () => startBooking({ serviceId: service.id, barberId: next.barber.id, date: next.date, time: next.time });
    box.hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* Rezervačný formulár                                                 */
  /* ------------------------------------------------------------------ */

  /** Zablokuje služby a barberov, ktorí k sebe nepasujú. */
  function syncChoices() {
    const service = currentService();
    const barber = currentBarber();

    $$('option', els.service).forEach((opt) => {
      if (!opt.value) return;
      opt.disabled = !!barber && !Logic.barberOffers(barber, opt.value);
    });

    $$('input[name="barber"]', els.barberChoices).forEach((input) => {
      const b = Logic.getBarber(input.value);
      const unsupported = !!service && !Logic.barberOffers(b, service.id);
      input.disabled = unsupported;
      input.checked = state.barberId === b.id;
      const note = $('.barber-choice-note', input.closest('label'));
      note.textContent = unsupported ? 'Túto službu neponúka' : note.dataset.role;
    });
  }

  function renderDateChips() {
    const barber = currentBarber();
    const dates = Logic.listOpenDates(now(), 8, barber);
    els.chips.replaceChildren(
      ...dates.map((iso) =>
        h('button', {
          type: 'button',
          class: 'chip',
          dataset: { date: iso },
          'aria-pressed': String(state.date === iso),
          'aria-label': fmtDateLong(iso),
          text: chipDate.format(Logic.parseISODate(iso)),
          onclick: () => setDate(iso),
        })
      )
    );
  }

  function setDate(iso) {
    state.date = iso;
    els.date.value = iso;
    clearError('date');
    refreshAll();
  }

  const reasonTitle = (slot) =>
    slot.state === 'booked'
      ? 'Obsadené'
      : slot.reason === 'past'
      ? 'Tento čas už uplynul'
      : slot.reason === 'after-closing'
      ? 'Služba by presiahla otváracie hodiny'
      : '';

  function dateStatusMessage(status, barber) {
    switch (status) {
      case 'closed':
        return 'V tento deň máme zatvorené. Vyberte iný dátum.';
      case 'past':
        return 'Vyberte dnešný alebo budúci dátum.';
      case 'too-far':
        return `Rezervovať je možné najviac ${Data.RULES.maxDaysAhead} dní dopredu.`;
      case 'barber-off':
        return `${barber.name} v tento deň nepracuje. Vyberte iný dátum alebo iného barbera.`;
      default:
        return 'Zadajte platný dátum.';
    }
  }

  /** Prekreslí mriežku termínov podľa aktuálneho výberu a uložených rezervácií. */
  function refreshSlots() {
    const service = currentService();
    const barber = currentBarber();
    els.slots.replaceChildren();
    els.legend.hidden = true;
    els.slotsMessage.classList.remove('is-warning');

    if (!service || !barber || !state.date) {
      els.slotsMessage.textContent = 'Najprv vyberte službu, barbera a dátum.';
      return;
    }

    const day = bookings.getDaySlots(state.date, service, barber);
    if (day.status !== 'ok') {
      state.time = '';
      els.slotsMessage.textContent = dateStatusMessage(day.status, barber);
      els.slotsMessage.classList.add('is-warning');
      return;
    }

    if (state.time && !day.slots.some((s) => s.time === state.time && s.state === 'available')) state.time = '';

    els.slots.replaceChildren(
      ...day.slots.map((s) => {
        const id = 'slot-' + s.time.replace(':', '');
        const cls = 'slot' + (s.state === 'booked' ? ' is-booked' : s.state === 'unavailable' ? ' is-off' : '');
        return h(
          'label',
          { class: cls, for: id, title: reasonTitle(s) || null, dataset: { state: s.state } },
          h('input', { type: 'radio', name: 'time', id, value: s.time, disabled: s.state !== 'available', checked: s.time === state.time }),
          h('span', { class: 'slot-body', text: fmtTime(s.time) }),
          s.state === 'booked' ? h('span', { class: 'visually-hidden', text: ', obsadené' }) : null,
          s.state === 'unavailable' ? h('span', { class: 'visually-hidden', text: ', nedostupné' }) : null
        );
      })
    );

    const free = day.slots.filter((s) => s.state === 'available').length;
    if (free) {
      els.slotsMessage.textContent = `Voľných termínov: ${free}. Dĺžka služby: ${fmtDuration(service.duration)}.`;
    } else {
      els.slotsMessage.textContent = 'Na tento deň už nie sú voľné termíny. Vyberte iný dátum alebo barbera.';
      els.slotsMessage.classList.add('is-warning');
    }
    els.legend.hidden = false;
  }

  /** Zhrnutie rezervácie vedľa formulára. */
  function updateSlip() {
    const service = currentService();
    const barber = currentBarber();
    const set = (id, text) => {
      const dd = $('#slip-' + id);
      dd.textContent = text || dd.dataset.empty;
      dd.classList.toggle('is-empty', !text);
    };
    set('service', service ? `${service.name} (${fmtDuration(service.duration)})` : '');
    set('barber', barber ? barber.name : '');
    set('date', state.date && Logic.parseISODate(state.date) ? capitalize(fmtDateLong(state.date)) : '');
    let timeText = '';
    if (state.time && service) {
      timeText = `${fmtTime(state.time)} – ${fmtTime(Logic.minutesToTime(Logic.timeToMinutes(state.time) + service.duration))}`;
    }
    set('time', timeText);
    $('#slip-price').textContent = service ? fmtPrice(service.price) : fmtPrice(0);
  }

  function refreshAll() {
    syncChoices();
    renderDateChips();
    refreshSlots();
    updateSlip();
  }

  /** Predvyplní formulár (tlačidlá v cenníku, kartách barberov a v hero) a posunie stránku k rezervácii. */
  function startBooking(preset) {
    if (!els.confirmation.hidden) showForm();
    if (preset.serviceId) {
      state.serviceId = preset.serviceId;
      els.service.value = preset.serviceId;
      clearError('service');
    }
    if (preset.barberId) {
      const b = Logic.getBarber(preset.barberId);
      const service = currentService();
      if (!service || Logic.barberOffers(b, service.id)) {
        state.barberId = preset.barberId;
        clearError('barber');
      }
    }
    if (preset.date) {
      state.date = preset.date;
      els.date.value = preset.date;
      clearError('date');
    }
    if (preset.time) state.time = preset.time;
    refreshAll();
    $('#rezervacia').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ----- Chyby formulára ----- */

  const FIELD_CONTROLS = {
    service: '#service',
    date: '#date',
    name: '#name',
    email: '#email',
    phone: '#phone',
    note: '#note',
    consent: '#consent',
  };
  const FIELD_ORDER = ['service', 'barber', 'date', 'time', 'name', 'email', 'phone', 'note', 'consent'];

  function setError(field, message) {
    const target = $('#' + field + '-error');
    if (target) target.textContent = message || '';
    const control = FIELD_CONTROLS[field] && $(FIELD_CONTROLS[field]);
    if (control) {
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    }
  }
  const clearError = (field) => setError(field, '');

  function clearErrors() {
    FIELD_ORDER.forEach(clearError);
    els.formError.textContent = '';
  }

  function showErrors(errors) {
    FIELD_ORDER.forEach((field) => setError(field, errors[field] || ''));
  }

  function focusFirstError(errors) {
    const field = FIELD_ORDER.find((f) => errors[f]);
    if (!field) return;
    let target = null;
    if (field === 'barber') target = $('input[name="barber"]:not(:disabled)', els.barberChoices);
    else if (field === 'time') target = $('input[name="time"]:not(:disabled)', els.slots) || els.slotsMessage;
    else target = $(FIELD_CONTROLS[field]);
    if (target) {
      if (!target.matches('input, select, textarea, button')) target.setAttribute('tabindex', '-1');
      target.focus();
    }
  }

  const collectInput = () => ({
    serviceId: state.serviceId,
    barberId: state.barberId,
    date: state.date,
    time: state.time,
    name: els.name.value,
    email: els.email.value,
    phone: els.phone.value,
    note: els.note.value,
  });

  function validateAll() {
    const errors = Object.assign({}, Logic.validateBookingInput(collectInput(), now()).errors);
    if (!els.consent.checked) errors.consent = 'Pre odoslanie rezervácie je potrebný súhlas so spracovaním údajov.';
    return errors;
  }

  /** Kontrola jedného poľa (pri opustení poľa alebo úprave poľa s chybou). */
  function validateField(field) {
    const errors = validateAll();
    setError(field, errors[field] || '');
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove('is-visible'), 5000);
  }

  /* ----- Odoslanie ----- */

  function onSubmit(event) {
    event.preventDefault();
    els.formError.textContent = '';

    const errors = validateAll();
    if (Object.keys(errors).length) {
      showErrors(errors);
      els.formError.textContent = 'Skontrolujte zvýraznené polia a skúste to znova.';
      focusFirstError(errors);
      return;
    }

    // Dostupnosť sa pri uložení znova overuje na aktuálnych dátach.
    const result = bookings.create(collectInput());
    if (!result.ok) {
      showErrors(result.errors || {});
      els.formError.textContent = result.message;
      if (['SLOT_TAKEN', 'INVALID_TIME', 'PAST', 'OUTSIDE_HOURS', 'CUSTOMER_OVERLAP'].includes(result.code)) {
        state.time = '';
        refreshAll();
        renderNextSlot();
        focusFirstError({ time: true });
      } else {
        focusFirstError(result.errors || {});
      }
      return;
    }

    clearErrors();
    notifyShop(result.booking);
    showConfirmation(result.booking);
    renderNextSlot();
    refreshAll();
  }

  /* ----- Potvrdenie ----- */

  function detailRow(label, value) {
    return h('div', {}, h('dt', { text: label }), h('dd', { text: value }));
  }

  function bookingMailText(b) {
    return [
      'Nová rezervácia ' + b.id,
      '',
      'Služba: ' + b.serviceName,
      'Barber: ' + b.barberName,
      'Dátum: ' + fmtDateLong(b.date),
      'Čas: ' + fmtTime(b.time) + ' – ' + fmtTime(b.endTime),
      'Cena na mieste: ' + fmtPrice(b.price),
      '',
      'Meno: ' + b.customer.name,
      'E-mail: ' + b.customer.email,
      'Telefón: ' + b.customer.phone,
      b.note ? 'Poznámka: ' + b.note : ''
    ].join('\n');
  }

  function bookingMailto(b) {
    return 'mailto:' + Data.SHOP.email + '?subject=' + encodeURIComponent('Rezervácia ' + b.id + ' – ' + b.serviceName) + '&body=' + encodeURIComponent(bookingMailText(b));
  }

  /** Voliteľné automatické upozornenie salónu (Data.SHOP.notifyUrl); chyba nikdy nezruší rezerváciu. */
  function notifyShop(b) {
    if (!Data.SHOP.notifyUrl || typeof fetch !== 'function') return;
    try {
      const body = new URLSearchParams({ subject: 'Rezervácia ' + b.id + ' – ' + b.serviceName, email: b.customer.email, message: bookingMailText(b) });
      fetch(Data.SHOP.notifyUrl, { method: 'POST', headers: { Accept: 'application/json' }, body }).catch(function () {});
    } catch (e) { /* ignorované */ }
  }

  function showConfirmation(b) {
    els.confirmation.replaceChildren(
      h('h3', { text: 'Rezervácia je potvrdená' }),
      h('p', {
        class: 'confirmation-lead',
        text: 'Ďakujeme, ' + b.customer.name.split(' ')[0] + '. V demo verzii sa e-mail neposiela automaticky. Uložte si číslo rezervácie, pridajte termín do kalendára alebo pošlite rezerváciu salónu e-mailom.',
      }),
      h(
        'dl',
        { class: 'confirmation-grid' },
        detailRow('Číslo rezervácie', b.id),
        detailRow('Služba', b.serviceName),
        detailRow('Barber', b.barberName),
        detailRow('Dátum', capitalize(fmtDateLong(b.date))),
        detailRow('Čas', `${fmtTime(b.time)} – ${fmtTime(b.endTime)}`),
        detailRow('Cena na mieste', fmtPrice(b.price)),
        detailRow('Meno', b.customer.name),
        detailRow('E-mail', b.customer.email),
        detailRow('Telefón', b.customer.phone),
        b.note ? detailRow('Poznámka', b.note) : null
      ),
      h(
        'div',
        { class: 'confirmation-actions' },
        h('a', { class: 'btn btn-orange', id: 'add-to-calendar', href: Logic.googleCalendarUrl(b), target: '_blank', rel: 'noopener noreferrer', text: 'Pridať do Google kalendára' }),
        h('a', { class: 'btn btn-ghost', id: 'mail-booking', href: bookingMailto(b), text: 'Poslať rezerváciu salónu e-mailom' }),
        h('button', { type: 'button', class: 'btn btn-ghost', id: 'show-my-bookings', text: 'Zobraziť moje rezervácie', onclick: () => openMyBookings(b.customer.email) }),
        h('button', { type: 'button', class: 'btn btn-ghost', id: 'new-booking', text: 'Rezervovať ďalší termín', onclick: newBooking })
      )
    );
    els.layout.hidden = true;
    els.confirmation.hidden = false;
    els.confirmation.focus();
    els.confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showForm() {
    els.confirmation.hidden = true;
    els.layout.hidden = false;
  }

  /** Nová rezervácia: údaje o zákazníkovi ostanú predvyplnené, výber termínu sa vymaže. */
  function newBooking() {
    state.serviceId = state.barberId = state.date = state.time = '';
    els.service.value = '';
    els.date.value = '';
    els.note.value = '';
    els.noteCount.textContent = '0 / ' + Data.RULES.maxNoteLength + ' znakov';
    clearErrors();
    showForm();
    refreshAll();
    $('#rezervacia').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------ */
  /* Moje rezervácie                                                     */
  /* ------------------------------------------------------------------ */

  function bookingCard(b) {
    const t = now();
    const status = Logic.getDisplayStatus(b, t);
    const actions = h('div', { class: 'booking-actions' });

    const showCancelButton = () =>
      actions.replaceChildren(
        h('button', {
          type: 'button',
          class: 'btn btn-danger btn-small',
          dataset: { action: 'cancel' },
          text: 'Zrušiť rezerváciu',
          onclick: showCancelConfirm,
        })
      );

    const showCancelConfirm = () =>
      actions.replaceChildren(
        h(
          'div',
          { class: 'cancel-confirm', role: 'group', 'aria-label': 'Potvrdenie zrušenia' },
          h('p', { text: 'Naozaj chcete zrušiť túto rezerváciu?' }),
          h('button', { type: 'button', class: 'btn btn-danger btn-small', dataset: { action: 'confirm-cancel' }, text: 'Áno, zrušiť', onclick: () => cancelBooking(b) }),
          h('button', { type: 'button', class: 'btn btn-ghost btn-small', dataset: { action: 'keep' }, text: 'Ponechať', onclick: showCancelButton })
        )
      );

    if (Logic.canCancel(b, t)) showCancelButton();
    else if (status === 'confirmed') actions.append(h('p', { class: 'booking-sub', text: 'Termín sa už začal, zrušiť ho nie je možné.' }));

    return h(
      'article',
      { class: 'booking-card is-' + status, tabindex: '-1', dataset: { id: b.id, status } },
      h(
        'div',
        { class: 'booking-main' },
        h('h4', { text: b.serviceName }),
        h('p', { class: 'booking-sub', text: 'Barber: ' + b.barberName }),
        h('p', { class: 'booking-sub', text: 'Číslo rezervácie: ' + b.id })
      ),
      h(
        'div',
        { class: 'booking-when-wrap' },
        h('p', { class: 'booking-when', text: capitalize(fmtDateLong(b.date)) }),
        h('p', { class: 'booking-sub', text: `${fmtTime(b.time)} – ${fmtTime(b.endTime)} (${fmtDuration(b.duration)})` })
      ),
      h(
        'div',
        { class: 'booking-side' },
        h('span', { class: 'status status-' + status, text: STATUS_LABELS[status] }),
        h('p', { class: 'booking-price', text: fmtPrice(b.price) })
      ),
      actions
    );
  }

  function renderMyBookings() {
    if (!state.lookupQuery) {
      els.results.replaceChildren();
      return;
    }
    const list = bookings.find(state.lookupQuery);
    if (!list.length) {
      els.results.replaceChildren(
        h(
          'p',
          { class: 'results-empty', dataset: { empty: 'true' } },
          'Pre „' + state.lookupQuery + '“ sme nenašli žiadne rezervácie. Skontrolujte zápis e-mailu alebo čísla, alebo si ',
          h('a', { href: '#rezervacia', text: 'vyberte nový termín' }),
          '.'
        )
      );
      return;
    }

    const t = now();
    const upcoming = list.filter((b) => Logic.getDisplayStatus(b, t) === 'confirmed');
    const history = list.filter((b) => Logic.getDisplayStatus(b, t) !== 'confirmed').reverse();
    const nodes = [];
    nodes.push(h('h3', { class: 'results-group-title', text: `Nadchádzajúce rezervácie (${upcoming.length})` }));
    nodes.push(
      upcoming.length
        ? h('div', { class: 'booking-list', dataset: { group: 'upcoming' } }, upcoming.map(bookingCard))
        : h('p', { class: 'results-empty', text: 'Nemáte žiadne nadchádzajúce rezervácie.' })
    );
    if (history.length) {
      nodes.push(h('h3', { class: 'results-group-title', text: `História (${history.length})` }));
      nodes.push(h('div', { class: 'booking-list', dataset: { group: 'history' } }, history.map(bookingCard)));
    }
    els.results.replaceChildren(...nodes);
  }

  function cancelBooking(b) {
    const result = bookings.cancel(b.id, state.lookupQuery);
    if (!result.ok) {
      showToast(result.message);
      renderMyBookings();
      return;
    }
    renderMyBookings();
    refreshAll(); // uvoľnený termín sa ihneď zobrazí vo formulári
    renderNextSlot();
    showToast('Rezervácia bola zrušená a termín je opäť voľný.');
    const card = $(`.booking-card[data-id="${b.id}"]`, els.results);
    if (card) card.focus();
  }

  function onLookup(event) {
    event.preventDefault();
    const query = els.lookupInput.value.trim();
    const errorEl = $('#lookup-error');
    errorEl.textContent = '';
    els.lookupInput.removeAttribute('aria-invalid');

    if (!query) {
      errorEl.textContent = 'Zadajte e-mail alebo telefónne číslo.';
    } else if (!Logic.parseContactQuery(query)) {
      errorEl.textContent = 'Zadajte platný e-mail alebo telefónne číslo, napríklad meno@domena.sk alebo 0900 123 456.';
    }
    if (errorEl.textContent) {
      els.lookupInput.setAttribute('aria-invalid', 'true');
      state.lookupQuery = '';
      els.results.replaceChildren();
      els.lookupInput.focus();
      return;
    }
    state.lookupQuery = query;
    renderMyBookings();
  }

  function openMyBookings(query) {
    els.lookupInput.value = query;
    els.lookupForm.requestSubmit ? els.lookupForm.requestSubmit() : onLookup(new Event('submit', { cancelable: true }));
    $('#moje-rezervacie').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------ */
  /* Navigácia                                                           */
  /* ------------------------------------------------------------------ */

  function initNav() {
    // hlavička je cez hero priehľadná a po posunutí dostane tmavé pozadie
    const header = $('#site-header');
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const toggle = $('.nav-toggle');
    const nav = $('#site-nav');
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // zvýraznenie sekcie, ktorá je práve v strede obrazovky
    if ('IntersectionObserver' in window) {
      const links = $$('.site-nav li a');
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach((a) => {
              const active = a.getAttribute('href') === '#' + entry.target.id;
              a.classList.toggle('is-active', active);
              if (active) a.setAttribute('aria-current', 'true');
              else a.removeAttribute('aria-current');
            });
          });
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      $$('main section[id]').forEach((section) => observer.observe(section));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Inicializácia                                                       */
  /* ------------------------------------------------------------------ */

  function init() {
    renderServices();
    renderFeatured();
    renderBarbers();
    renderFormChoices();
    initQuickCard();
    renderOpeningInfo();
    $('#year').textContent = now().getFullYear();

    // rozsah dátumu: dnes až 60 dní dopredu
    const today = Logic.toISODate(now());
    els.date.min = today;
    els.date.max = Logic.addDays(today, Data.RULES.maxDaysAhead);

    els.service.addEventListener('change', () => {
      state.serviceId = els.service.value;
      clearError('service');
      refreshAll();
    });

    els.barberChoices.addEventListener('change', (e) => {
      if (e.target.name !== 'barber') return;
      state.barberId = e.target.value;
      clearError('barber');
      refreshAll();
    });

    els.date.addEventListener('change', () => {
      state.date = els.date.value;
      clearError('date');
      refreshAll();
    });

    els.slots.addEventListener('change', (e) => {
      if (e.target.name !== 'time') return;
      state.time = e.target.value;
      clearError('time');
      updateSlip();
    });

    // živá kontrola textových polí
    ['name', 'email', 'phone', 'note'].forEach((field) => {
      const control = els[field];
      control.addEventListener('blur', () => {
        if (control.value.trim()) validateField(field);
      });
      control.addEventListener('input', () => {
        if (control.getAttribute('aria-invalid') === 'true') validateField(field);
      });
    });
    els.consent.addEventListener('change', () => {
      if (els.consent.checked) clearError('consent');
    });
    els.note.addEventListener('input', () => {
      els.noteCount.textContent = `${els.note.value.length} / ${Data.RULES.maxNoteLength} znakov`;
    });

    els.form.addEventListener('submit', onSubmit);
    els.lookupForm.addEventListener('submit', onLookup);
    $('#use-demo').addEventListener('click', () => openMyBookings(Data.DEMO_CUSTOMER.email));

    // obnovenie demo dát s potvrdením priamo na stránke (okno confirm nie je všade dostupné)
    const resetButton = $('#reset-demo');
    const resetBox = $('#reset-confirm');
    const toggleReset = (open) => {
      resetBox.hidden = !open;
      resetButton.hidden = open;
      (open ? $('#reset-no') : resetButton).focus();
    };
    resetButton.addEventListener('click', () => toggleReset(true));
    $('#reset-no').addEventListener('click', () => toggleReset(false));
    $('#reset-yes').addEventListener('click', () => {
      bookings.reset();
      state.lookupQuery = '';
      els.lookupInput.value = '';
      els.results.replaceChildren();
      showForm();
      refreshAll();
      renderNextSlot();
      toggleReset(false);
      showToast('Demo dáta boli obnovené.');
    });

    // zmeny z inej karty prehliadača
    window.addEventListener('storage', (e) => {
      if (e.key !== Store.STORAGE_KEY) return;
      refreshSlots();
      renderNextSlot();
      renderMyBookings();
    });

    initNav();
    refreshAll();
    renderNextSlot();
  }

  init();
})();
