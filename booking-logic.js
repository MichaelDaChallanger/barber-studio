/**
 * booking-logic.js – čistá (bez DOM a bez úložiska) logika rezervácií.
 *
 * Všetky funkcie dostávajú aktuálny čas (`now`) a zoznam rezervácií ako parameter,
 * vďaka čomu sa dajú ľahko testovať. Dátumy sa ukladajú ako lokálne reťazce
 * "RRRR-MM-DD" a časy ako "HH:MM" (čas prevádzky je lokálny čas barber shopu).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data.js'));
  } else {
    root.BookingLogic = factory(root.BarberData);
  }
})(typeof self !== 'undefined' ? self : this, function (Data) {
  'use strict';

  const { SERVICES, BARBERS, OPENING_HOURS, RULES } = Data;

  const STATUS = Object.freeze({ CONFIRMED: 'confirmed', CANCELLED: 'cancelled', COMPLETED: 'completed' });

  /* ------------------------------------------------------------------ */
  /* Dátum a čas                                                         */
  /* ------------------------------------------------------------------ */

  const pad = (n) => String(n).padStart(2, '0');

  /** Date -> "RRRR-MM-DD" v lokálnom čase. */
  function toISODate(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /** "RRRR-MM-DD" -> Date (polnoc lokálneho času) alebo null, ak je dátum neplatný. */
  function parseISODate(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const date = new Date(y, mo - 1, d);
    // odfiltruje napr. 2026-02-31
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date;
  }

  /** "HH:MM" -> minúty od polnoci alebo null. */
  function timeToMinutes(time) {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(time || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  /** minúty od polnoci -> "HH:MM". */
  function minutesToTime(min) {
    return pad(Math.floor(min / 60)) + ':' + pad(min % 60);
  }

  /** Pripočíta n dní k ISO dátumu. */
  function addDays(iso, n) {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  /** Dátum a čas začiatku termínu ako Date. */
  function startDateTime(iso, time) {
    const d = parseISODate(iso);
    const min = timeToMinutes(time);
    d.setHours(Math.floor(min / 60), min % 60, 0, 0);
    return d;
  }

  /** Dátum a čas konca termínu ako Date. */
  function endDateTime(iso, time, duration) {
    return new Date(startDateTime(iso, time).getTime() + duration * 60000);
  }

  /* ------------------------------------------------------------------ */
  /* Vyhľadanie dát                                                      */
  /* ------------------------------------------------------------------ */

  const getService = (id) => SERVICES.find((s) => s.id === id) || null;
  const getBarber = (id) => BARBERS.find((b) => b.id === id) || null;

  /** Otváracie hodiny pre daný ISO dátum, alebo null, keď je zatvorené / dátum je neplatný. */
  function getOpeningHours(iso) {
    const d = parseISODate(iso);
    if (!d) return null;
    return OPENING_HOURS[d.getDay()] || null;
  }

  const barberOffers = (barber, serviceId) => barber.services.includes(serviceId);

  function barberWorksOn(barber, iso) {
    const d = parseISODate(iso);
    return !!d && barber.workDays.includes(d.getDay());
  }

  /**
   * Stav dátumu pre rezerváciu:
   * 'invalid' | 'past' | 'too-far' | 'closed' | 'barber-off' | 'ok'
   */
  function getDateStatus(iso, now, barber) {
    const d = parseISODate(iso);
    if (!d) return 'invalid';
    const today = toISODate(now);
    if (iso < today) return 'past';
    if (iso > addDays(today, RULES.maxDaysAhead)) return 'too-far';
    if (!getOpeningHours(iso)) return 'closed';
    if (barber && !barberWorksOn(barber, iso)) return 'barber-off';
    return 'ok';
  }

  /* ------------------------------------------------------------------ */
  /* Dostupnosť termínov                                                 */
  /* ------------------------------------------------------------------ */

  /** Prekrývajú sa intervaly [aStart, aEnd) a [bStart, bEnd)? */
  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

  /** Aktívne (nezrušené) rezervácie barbera v daný deň. */
  function activeBookingsFor(bookings, barberId, iso) {
    return bookings.filter((b) => b.status === STATUS.CONFIRMED && b.barberId === barberId && b.date === iso);
  }

  /**
   * Vráti mriežku termínov pre daný deň, službu a barbera.
   *
   * Výsledok: { status, slots } kde slots = [{ time, end, state, reason }]
   *  - state 'available'   – termín je voľný,
   *  - state 'booked'      – termín je obsadený (iná rezervácia sa prekrýva s trvaním služby),
   *  - state 'unavailable' – nedá sa vybrať (reason: 'past' | 'after-closing').
   */
  function getDaySlots({ date, service, barber, bookings, now }) {
    const status = getDateStatus(date, now, barber);
    if (status !== 'ok') return { status, slots: [] };

    const hours = getOpeningHours(date);
    const open = timeToMinutes(hours.open);
    const close = timeToMinutes(hours.close);
    const busy = activeBookingsFor(bookings, barber.id, date).map((b) => {
      const s = timeToMinutes(b.time);
      return [s, s + b.duration];
    });

    const slots = [];
    for (let start = open; start < close; start += RULES.slotStep) {
      const end = start + service.duration;
      const time = minutesToTime(start);
      let state = 'available';
      let reason = null;

      if (startDateTime(date, time).getTime() <= now.getTime()) {
        state = 'unavailable';
        reason = 'past';
      } else if (busy.some(([bs, be]) => overlaps(start, end, bs, be))) {
        state = 'booked';
        reason = 'booked';
      } else if (end > close) {
        state = 'unavailable';
        reason = 'after-closing';
      }
      slots.push({ time, end: minutesToTime(end), state, reason });
    }
    return { status, slots };
  }

  /** Zoznam najbližších otvorených dní (dnes len ak ešte zostáva voľný čas). */
  function listOpenDates(now, count, barber) {
    const result = [];
    let iso = toISODate(now);
    for (let i = 0; i <= RULES.maxDaysAhead && result.length < count; i++, iso = addDays(iso, 1)) {
      const status = getDateStatus(iso, now, barber);
      if (status !== 'ok') continue;
      if (i === 0) {
        const hours = getOpeningHours(iso);
        const closeAt = startDateTime(iso, hours.close).getTime() - RULES.slotStep * 60000;
        if (now.getTime() >= closeAt) continue;
      }
      result.push(iso);
    }
    return result;
  }

  /**
   * Najbližší voľný termín pre danú službu (u ktoréhokoľvek barbera, ktorý ju ponúka).
   * Vráti { date, time, barber } alebo null.
   */
  function findNextAvailable({ service, bookings, now, barbers = BARBERS, daysAhead = 21 }) {
    let best = null;
    let iso = toISODate(now);
    for (let i = 0; i <= daysAhead; i++, iso = addDays(iso, 1)) {
      for (const barber of barbers) {
        if (!barberOffers(barber, service.id)) continue;
        const { slots } = getDaySlots({ date: iso, service, barber, bookings, now });
        const free = slots.find((s) => s.state === 'available');
        if (free && (!best || free.time < best.time)) best = { date: iso, time: free.time, barber };
      }
      if (best) return best; // prvý deň, v ktorom je niečo voľné, obsahuje najskorší termín
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Normalizácia a validácia vstupov                                    */
  /* ------------------------------------------------------------------ */

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  /**
   * Zjednotí zápis telefónneho čísla: "0900 123 456", "+421 900 123 456",
   * "00421900123456" aj "900123456" -> "+421900123456".
   */
  function normalizePhone(value) {
    let s = String(value || '').trim().replace(/[\s\-().\/]/g, '');
    if (s.startsWith('00')) s = '+' + s.slice(2);
    else if (s.startsWith('0')) s = '+421' + s.slice(1);
    else if (/^[1-9]\d{8}$/.test(s)) s = '+421' + s;
    else if (/^[1-9]\d{10,14}$/.test(s)) s = '+' + s;
    return s;
  }

  const isValidEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  // Slovenské číslo (+421) má presne 9 číslic za predvoľbou, ostatné medzinárodné čísla 10 až 15 číslic (E.164).
  const isValidPhone = (phone) => (phone.startsWith('+421') ? /^\+421[1-9]\d{8}$/ : /^\+[1-9]\d{9,14}$/).test(phone);
  const isValidName = (name) => /^\p{L}[\p{L}\p{M}\s.'’-]*$/u.test(name);

  /**
   * Overí vstup rezervačného formulára.
   * Vráti { valid, errors, values }, kde values sú upravené (trim, normalizované) hodnoty.
   */
  function validateBookingInput(input, now) {
    const errors = {};
    const src = input || {};

    const service = getService(src.serviceId);
    const barber = getBarber(src.barberId);
    const date = String(src.date || '').trim();
    const time = String(src.time || '').trim();
    const name = String(src.name || '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(src.email);
    const phoneRaw = String(src.phone || '').trim();
    const phone = normalizePhone(phoneRaw);
    const note = String(src.note || '').trim();

    if (!src.serviceId) errors.service = 'Vyberte službu.';
    else if (!service) errors.service = 'Vybraná služba neexistuje.';

    if (!src.barberId) errors.barber = 'Vyberte barbera.';
    else if (!barber) errors.barber = 'Vybraný barber neexistuje.';
    else if (service && !barberOffers(barber, service.id)) errors.barber = 'Tento barber vybranú službu neponúka.';

    if (!date) errors.date = 'Vyberte dátum.';
    else {
      const status = getDateStatus(date, now, barber && !errors.barber ? barber : null);
      if (status === 'invalid') errors.date = 'Zadajte platný dátum.';
      else if (status === 'past') errors.date = 'Vyberte dnešný alebo budúci dátum.';
      else if (status === 'too-far') errors.date = 'Rezervovať je možné najviac ' + RULES.maxDaysAhead + ' dní dopredu.';
      else if (status === 'closed') errors.date = 'V tento deň máme zatvorené.';
      else if (status === 'barber-off') errors.date = 'Vybraný barber v tento deň nepracuje.';
    }

    if (!time) errors.time = 'Vyberte čas.';
    else if (timeToMinutes(time) === null) errors.time = 'Zadajte čas vo formáte HH:MM.';

    if (!name) errors.name = 'Zadajte meno a priezvisko.';
    else if (name.length < 2) errors.name = 'Meno je príliš krátke.';
    else if (name.length > 80) errors.name = 'Meno môže mať najviac 80 znakov.';
    else if (!isValidName(name)) errors.name = 'Meno môže obsahovať iba písmená, medzery, pomlčky a apostrofy.';

    if (!email) errors.email = 'Zadajte e-mail.';
    else if (!isValidEmail(email)) errors.email = 'Zadajte platný e-mail, napríklad meno@domena.sk.';

    if (!phoneRaw) errors.phone = 'Zadajte telefónne číslo.';
    else if (!isValidPhone(phone)) errors.phone = 'Zadajte platné telefónne číslo, napríklad 0900 123 456.';

    if (note.length > RULES.maxNoteLength) {
      errors.note = 'Poznámka môže mať najviac ' + RULES.maxNoteLength + ' znakov.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      values: { service, barber, date, time, name, email, phone, note },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Vytvorenie, zrušenie a vyhľadanie rezervácií                        */
  /* ------------------------------------------------------------------ */

  const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  /** Číslo rezervácie, napr. BS-7K2M9X. */
  function generateId() {
    let id = 'BS-';
    for (let i = 0; i < 6; i++) id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
    return id;
  }

  const sameCustomer = (a, b) =>
    normalizeEmail(a.email) === normalizeEmail(b.email) || normalizePhone(a.phone) === normalizePhone(b.phone);

  const fail = (code, message, errors) => ({ ok: false, code, message, errors: errors || {} });

  /**
   * Vytvorí rezerváciu (nemení pole `bookings`, vracia nový objekt).
   * Výsledok: { ok: true, booking } alebo { ok: false, code, message, errors }.
   * Kódy chýb: VALIDATION, INVALID_TIME, SLOT_TAKEN, PAST, OUTSIDE_HOURS, CUSTOMER_OVERLAP.
   */
  function createBooking(input, bookings, now, idFactory) {
    const check = validateBookingInput(input, now);
    if (!check.valid) return fail('VALIDATION', 'Skontrolujte vyplnené údaje.', check.errors);

    const { service, barber, date, time, name, email, phone, note } = check.values;

    // Dostupnosť sa vždy znova overuje na aktuálnych dátach (ochrana pred dvojitou rezerváciou).
    const slot = getDaySlots({ date, service, barber, bookings, now }).slots.find((s) => s.time === time);
    if (!slot) return fail('INVALID_TIME', 'Tento čas nie je v ponuke.', { time: 'Tento čas nie je v ponuke.' });
    if (slot.state === 'booked') {
      return fail('SLOT_TAKEN', 'Tento termín je už obsadený. Vyberte iný čas.', { time: 'Termín je obsadený.' });
    }
    if (slot.reason === 'past') {
      return fail('PAST', 'Tento čas už uplynul. Vyberte termín v budúcnosti.', { time: 'Čas už uplynul.' });
    }
    if (slot.reason === 'after-closing') {
      return fail('OUTSIDE_HOURS', 'Služba sa do otváracích hodín nezmestí. Vyberte skorší čas.', {
        time: 'Služba sa nezmestí do otváracích hodín.',
      });
    }

    // Jeden zákazník nemôže byť v tom istom čase na dvoch miestach.
    const start = timeToMinutes(time);
    const end = start + service.duration;
    const customer = { name, email, phone };
    const clash = bookings.some(
      (b) =>
        b.status === STATUS.CONFIRMED &&
        b.date === date &&
        sameCustomer(b.customer, customer) &&
        overlaps(start, end, timeToMinutes(b.time), timeToMinutes(b.time) + b.duration)
    );
    if (clash) {
      return fail('CUSTOMER_OVERLAP', 'V tomto čase už máte inú rezerváciu.', {
        time: 'V tomto čase už máte inú rezerváciu.',
      });
    }

    const makeId = idFactory || generateId;
    let id = makeId();
    for (let i = 0; i < 20 && bookings.some((b) => b.id === id); i++) id = makeId();

    return {
      ok: true,
      booking: {
        id,
        serviceId: service.id,
        serviceName: service.name,
        barberId: barber.id,
        barberName: barber.name,
        date,
        time,
        endTime: minutesToTime(end),
        duration: service.duration,
        price: service.price,
        status: STATUS.CONFIRMED,
        customer,
        note,
        createdAt: now.toISOString(),
      },
    };
  }

  /** Zobrazovaný stav: zrušená / uskutočnená (už skončila) / potvrdená. */
  function getDisplayStatus(booking, now) {
    if (booking.status === STATUS.CANCELLED) return STATUS.CANCELLED;
    if (endDateTime(booking.date, booking.time, booking.duration).getTime() <= now.getTime()) {
      return STATUS.COMPLETED;
    }
    return STATUS.CONFIRMED;
  }

  /** Rezerváciu je možné zrušiť, ak je potvrdená a ešte sa nezačala. */
  function canCancel(booking, now) {
    return (
      booking.status === STATUS.CONFIRMED && startDateTime(booking.date, booking.time).getTime() > now.getTime()
    );
  }

  /**
   * Rozpozná, či ide o e-mail alebo telefón.
   * Vráti { type: 'email' | 'phone', value } alebo null pri neplatnom vstupe.
   */
  function parseContactQuery(query) {
    const raw = String(query || '').trim();
    if (!raw) return null;
    if (raw.includes('@')) {
      const email = normalizeEmail(raw);
      return isValidEmail(email) ? { type: 'email', value: email } : null;
    }
    const phone = normalizePhone(raw);
    return isValidPhone(phone) ? { type: 'phone', value: phone } : null;
  }

  const matchesContact = (booking, contact) =>
    contact.type === 'email'
      ? normalizeEmail(booking.customer.email) === contact.value
      : normalizePhone(booking.customer.phone) === contact.value;

  /** Rezervácie zákazníka podľa e-mailu alebo telefónu, zoradené podľa termínu. */
  function findBookings(query, bookings) {
    const contact = parseContactQuery(query);
    if (!contact) return [];
    return bookings
      .filter((b) => matchesContact(b, contact))
      .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : 0));
  }

  /**
   * Zruší rezerváciu. `contactQuery` (e-mail alebo telefón) musí patriť zákazníkovi rezervácie.
   * Výsledok: { ok: true, booking } alebo { ok: false, code, message };
   * kódy: NOT_FOUND, FORBIDDEN, ALREADY_CANCELLED, PAST.
   */
  function cancelBooking(id, contactQuery, bookings, now) {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return fail('NOT_FOUND', 'Rezervácia sa nenašla.');
    const contact = parseContactQuery(contactQuery);
    if (!contact || !matchesContact(booking, contact)) {
      return fail('FORBIDDEN', 'Túto rezerváciu nemôžete zrušiť.');
    }
    if (booking.status === STATUS.CANCELLED) return fail('ALREADY_CANCELLED', 'Rezervácia je už zrušená.');
    if (!canCancel(booking, now)) return fail('PAST', 'Rezerváciu, ktorá sa už začala alebo skončila, nie je možné zrušiť.');
    return { ok: true, booking: Object.assign({}, booking, { status: STATUS.CANCELLED, cancelledAt: now.toISOString() }) };
  }

  /* ------------------------------------------------------------------ */
  /* Pridanie do kalendára (.ics)                                        */
  /* ------------------------------------------------------------------ */

  /** Vytvorí obsah súboru .ics pre rezerváciu (lokálny čas bez časovej zóny). */
  function buildICS(booking, now) {
    const stamp = (iso, time) => iso.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
    const utc = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (t) => String(t).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Barber Studio//Rezervacie//SK',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + booking.id + '@barberstudio.sk',
      'DTSTAMP:' + utc,
      'DTSTART:' + stamp(booking.date, booking.time),
      'DTEND:' + stamp(booking.date, booking.endTime),
      'SUMMARY:' + esc('Barber Studio: ' + booking.serviceName),
      'DESCRIPTION:' + esc('Barber: ' + booking.barberName + '. Cena: ' + booking.price + ' EUR. Číslo rezervácie: ' + booking.id),
      'LOCATION:' + esc(Data.SHOP.address),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  /**
   * Odkaz na pridanie rezervácie do Google kalendára (funguje aj tam, kde nie je povolené sťahovanie súborov).
   */
  function googleCalendarUrl(booking) {
    const stamp = (iso, time) => iso.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
    const params = [
      ['action', 'TEMPLATE'],
      ['text', 'Barber Studio: ' + booking.serviceName],
      ['dates', stamp(booking.date, booking.time) + '/' + stamp(booking.date, booking.endTime)],
      ['ctz', 'Europe/Bratislava'],
      ['details', 'Barber: ' + booking.barberName + '. Cena: ' + booking.price + ' EUR. Číslo rezervácie: ' + booking.id],
      ['location', Data.SHOP.address],
    ];
    return 'https://calendar.google.com/calendar/render?' + params.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  }

  return Object.freeze({
    STATUS,
    pad,
    toISODate,
    parseISODate,
    timeToMinutes,
    minutesToTime,
    addDays,
    startDateTime,
    endDateTime,
    getService,
    getBarber,
    getOpeningHours,
    barberOffers,
    barberWorksOn,
    getDateStatus,
    getDaySlots,
    listOpenDates,
    findNextAvailable,
    normalizeEmail,
    normalizePhone,
    isValidEmail,
    isValidPhone,
    validateBookingInput,
    generateId,
    createBooking,
    getDisplayStatus,
    canCancel,
    parseContactQuery,
    findBookings,
    cancelBooking,
    buildICS,
    googleCalendarUrl,
  });
});
