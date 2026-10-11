/**
 * data.js – statické dáta barber shopu (služby, barberi, otváracie hodiny, pravidlá).
 *
 * Súbor funguje v prehliadači (globálna premenná BarberData) aj v Node.js (require),
 * aby sa dali rovnaké dáta použiť aj v automatických testoch.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BarberData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Základné informácie o prevádzke (demo údaje, adresa je fiktívna). */
  const SHOP = {
    name: 'Barber Studio',
    slogan: 'Klasické remeslo, presný strih.',
    address: 'Obchodná 12, 811 06 Bratislava',
    phone: '+421 900 123 456',
    phoneHref: '+421900123456',
    email: 'barbershopmn17@gmail.com',
    // Voliteľné: adresa formulára (napr. https://formspree.io/f/xxxx), ktorá po každej rezervácii
    // pošle e-mail na adresu salónu. Funguje na vlastnom hostingu, nie priamo v aplikácii Claude.
    notifyUrl: '',
    mapLink: 'https://www.openstreetmap.org/?mlat=48.1486&mlon=17.1077#map=17/48.1486/17.1077',
    mapEmbed:
      'https://www.openstreetmap.org/export/embed.html?bbox=17.1030%2C48.1458%2C17.1124%2C48.1514&layer=mapnik&marker=48.1486%2C17.1077',
  };

  /** Pravidlá rezervácií. */
  const RULES = {
    slotStep: 30, // krok mriežky začiatkov termínov v minútach
    maxDaysAhead: 60, // koľko dní dopredu je možné rezervovať
    maxNoteLength: 300, // maximálna dĺžka poznámky
  };

  /** Názvy dní podľa Date.getDay() (0 = nedeľa). */
  const DAY_NAMES = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];

  /**
   * Otváracie hodiny podľa Date.getDay(). null = zatvorené.
   * Po–Pi 9:00–19:00, So 9:00–14:00, Ne zatvorené.
   */
  const OPENING_HOURS = {
    0: null,
    1: { open: '09:00', close: '19:00' },
    2: { open: '09:00', close: '19:00' },
    3: { open: '09:00', close: '19:00' },
    4: { open: '09:00', close: '19:00' },
    5: { open: '09:00', close: '19:00' },
    6: { open: '09:00', close: '14:00' },
  };

  /** Cenník. duration = minúty, price = EUR. */
  const SERVICES = [
    {
      id: 'panski-strih',
      name: 'Pánsky strih',
      description: 'Konzultácia, strih nožnicami a strojčekom, úprava kontúr a styling.',
      duration: 30,
      price: 18,
    },
    {
      id: 'strih-styling',
      name: 'Strih, umytie a styling',
      description: 'Strih s umytím vlasov, masážou pokožky hlavy a stylingom produktmi.',
      duration: 45,
      price: 25,
    },
    {
      id: 'skin-fade',
      name: 'Skin fade',
      description: 'Plynulý prechod až na kožu, presné línie a dôkladné dokončenie britvou.',
      duration: 45,
      price: 22,
    },
    {
      id: 'strojcek',
      name: 'Strojčekový strih',
      description: 'Rýchly strih na jednu dĺžku alebo jednoduchý prechod.',
      duration: 30,
      price: 12,
    },
    {
      id: 'uprava-brady',
      name: 'Úprava brady',
      description: 'Tvarovanie, skrátenie a vyčistenie kontúr brady a fúzov.',
      duration: 30,
      price: 14,
    },
    {
      id: 'holenie-britvou',
      name: 'Klasické holenie britvou',
      description: 'Horúci uterák, holiaca pena a holenie britvou, nakoniec upokojujúci balzam.',
      duration: 30,
      price: 20,
    },
    {
      id: 'strih-brada',
      name: 'Strih a brada',
      description: 'Pánsky strih spolu s úpravou brady. Najobľúbenejšia kombinácia.',
      duration: 60,
      price: 32,
    },
    {
      id: 'detsky-strih',
      name: 'Detský strih',
      description: 'Trpezlivý strih pre chlapcov do 12 rokov.',
      duration: 30,
      price: 14,
    },
    {
      id: 'farbenie',
      name: 'Kamufláž sivín',
      description: 'Jemné prefarbenie vlasov alebo brady, ktoré pôsobí prirodzene.',
      duration: 45,
      price: 25,
    },
    {
      id: 'kralovsky',
      name: 'Kráľovský balíček',
      description: 'Strih, úprava brady, holenie britvou, maska na tvár a masáž šije.',
      duration: 90,
      price: 55,
    },
  ];

  /**
   * Barberi. workDays podľa Date.getDay() (v kombinácii s otváracími hodinami),
   * services = id služieb, ktoré barber ponúka, look = vzhľad avatara.
   */
  const BARBERS = [
    {
      id: 'marek',
      name: 'Michael Nguyen',
      role: 'Majster barber a zakladateľ',
      bio: 'Strihá viac ako dvanásť rokov. Pozná klasiku aj aktuálne trendy a poradí, čo vám pristane k tvaru tváre.',
      workDays: [1, 2, 3, 4, 5, 6],
      services: [
        'panski-strih',
        'strih-styling',
        'skin-fade',
        'strojcek',
        'uprava-brady',
        'holenie-britvou',
        'strih-brada',
        'detsky-strih',
        'farbenie',
        'kralovsky',
      ],
      look: { skin: '#e0b088', hair: '#1c1612', beard: '#2a1e15', hasBeard: true, style: 'slick' },
    },
    {
      id: 'tomas',
      name: 'Tomáš Kováč',
      role: 'Špecialista na fade',
      bio: 'Presné prechody, ostré línie a čistý výsledok. Tomáš je jednotka pre skin fade a moderné krátke strihy.',
      workDays: [1, 2, 3, 4, 5],
      services: ['panski-strih', 'strih-styling', 'skin-fade', 'strojcek', 'strih-brada', 'detsky-strih'],
      look: { skin: '#c98f67', hair: '#120f0c', beard: '#120f0c', hasBeard: false, style: 'fade' },
    },
    {
      id: 'lukas',
      name: 'Lukáš Novák',
      role: 'Majster brady a holenia',
      bio: 'Horúci uterák, britva a pokoj. Lukáš sa venuje úprave brady a holeniu v tradičnom štýle.',
      workDays: [2, 3, 4, 5, 6],
      services: ['panski-strih', 'uprava-brady', 'holenie-britvou', 'strih-brada', 'farbenie', 'kralovsky'],
      look: { skin: '#e8bf9a', hair: '#4a4038', beard: '#6b5f55', hasBeard: true, style: 'curly' },
    },
  ];

  /** Demo zákazník, s ktorým sú predvyplnené ukážkové rezervácie. */
  const DEMO_CUSTOMER = {
    name: 'Demo Zákazník',
    email: 'demo@example.com',
    phone: '+421900123456',
  };

  return Object.freeze({ SHOP, RULES, DAY_NAMES, OPENING_HOURS, SERVICES, BARBERS, DEMO_CUSTOMER });
});
