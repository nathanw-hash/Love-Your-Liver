// =============================================================================
// PDF deliverables - print infrastructure + patient supplement handout
// (Milestone 4, slice 4b). Renders the static Nutrition Detective Supplement
// Recommendations handout into an off-screen #print-root and triggers the
// browser's native print / Save-as-PDF. Only the patient name and consult date
// are dynamic (read from the finalized row's frozen snapshot.profile and
// consult_date); the catalog and boilerplate are fixed clinic content. Pure
// UI/print - the engine block is never touched (all of this lives before
// const MARKER_ORDER). consultPrintDoc() is shared infra the M4 clinical-note
// slice (4a) will reuse for its own builder + button.
// =============================================================================

// Product / article URLs (verbatim from clinic source).
const ND_HANDOUT_URLS = {
  course:    'https://members.nutritiondetective.com/courses/5495233/content',
  office:    'https://members.nutritiondetective.com/groups/5627873/feed',
  vitk:      'https://nutritiondetective.com/collections/membership-collection/products/vitamin-k-vip?variant=51908201021608',
  niacin25:  'https://nutritiondetective.com/collections/membership-collection/products/flush-niacin-25mg-100-capsules-vip?variant=49446830276776',
  niacinArt: 'https://members.nutritiondetective.com/posts/love-your-liver-niacin-aka-nicotinic-acid-guidelines-by-kelsey-kenney',
  magLotion: 'https://nutritiondetective.com/collections/membership-collection/products/magnesium-lotion-vip',
  magArt:    'https://members.nutritiondetective.com/posts/love-your-liver-topical-transdermal-aka-absorbed-through-the-skin-magnesium-approaches',
  salt:      'https://jacobsensalt.com/collections/pure-sea-salt/products/pure-kosher-sea-salt?variant=31656634351639',
  sodiumArt: 'https://members.nutritiondetective.com/posts/love-your-liver-sodium-salt',
  potArt:    'https://members.nutritiondetective.com/posts/love-your-liver-potassium-15793684',
  sel:       'https://nutritiondetective.com/collections/membership-collection/products/selenium-glycinate-150-mcg-100-capsules-vip?variant=50237061267624',
  moly:      'https://nutritiondetective.com/collections/membership-collection/products/molybdenum-glycinate-150-mcg-100-capsules-vip?variant=51791963455656',
  zinc15:    'https://nutritiondetective.com/collections/membership-collection/products/zinc-picolinate-15-mg-100-capsules-vip?variant=50237089611944',
  zinc30:    'https://nutritiondetective.com/collections/membership-collection/products/zinc-picolinate-30-mg-100-capsules-vip?variant=50237098459304',
  km:        'https://nutritiondetective.com/collections/membership-collection/products/keystone-minerals-vip?variant=44606929764520',
  kmNiacin:  'https://nutritiondetective.com/collections/membership-collection/products/keystone-minerals-plus-niacin-60-capsules-vip?variant=49639303905448',
  niacin500: 'https://nutritiondetective.com/collections/membership-collection/products/flush-niacin-500mg-100-capsules-vip',
  lacto:     'https://nutritiondetective.com/collections/membership-collection/products/lactoferrin-vip?variant=44596573405352',
  lactoArt:  'https://members.nutritiondetective.com/posts/love-your-liver-lactoferrin',
  arsenic:   'https://members.nutritiondetective.com/posts/love-your-liver-arsenic-video-rice-water-hair-test-information',
  aluminum:  'https://members.nutritiondetective.com/posts/love-your-liver-aluminum-aka-aluminium'
};

// Shared print path: load HTML into #print-root, print, then clear on afterprint.
function consultPrintDoc(html) {
  const root = document.getElementById('print-root');
  if (!root) return;
  root.innerHTML = html;
  const clear = function () {
    root.innerHTML = '';
    window.removeEventListener('afterprint', clear);
  };
  window.addEventListener('afterprint', clear);
  // Defer one tick so layout settles before the print dialog opens.
  setTimeout(function () { window.print(); }, 0);
}

function consultPatientName(row) {
  const p = (row && row.snapshot && row.snapshot.profile) || {};
  const n = String(p.name || p.display_name || '').trim();
  return n || '____________________';
}

function consultHandoutLink(text, href) {
  return '<a class="pr-link" href="' + consultEsc(href) +
         '" target="_blank" rel="noopener">' + consultEsc(text) + '</a>';
}

// Small builders to keep the catalog readable.
function consultHandoutSec(title) {
  return '<div class="pr-sec">' + consultEsc(title) + '</div>';
}
function consultHandoutItem(headHtml, subsHtml) {
  return '<div class="pr-item"><div class="pr-item-h">' + headHtml + '</div>' +
         (subsHtml || '') + '</div>';
}
function consultHandoutSub(html) {
  return '<div class="pr-sub">' + html + '</div>';
}

function consultHandoutHtml(name, dateStr) {
  const U = ND_HANDOUT_URLS;
  const L = consultHandoutLink;

  const header =
    '<div class="pr-brand">Nutrition Detective</div>' +
    '<div class="pr-title">Supplement Recommendations for ' + consultEsc(name) + '</div>' +
    '<div class="pr-date">Date: ' + consultEsc(dateStr) + '</div>' +
    '<div class="pr-banner">Re-test 3-6 months after starting supplements. ' +
      'Re-testing at regular intervals is crucial to this approach!</div>';

  const intro =
    '<div class="pr-read">Please read these supplement recommendations thoroughly, ' +
      'along with any other information we give you.</div>' +
    '<div class="pr-read">Please read ALL of the information in the Love Your Liver ' +
      'course materials - this is your nutrition and diet information: ' +
      L('Love Your Liver course materials', U.course) + '</div>' +
    '<div class="pr-info"><b>Timing of supplements:</b> Supplements can be taken any ' +
      'time of day. They can be split up or taken all at once. ALL supplements should ' +
      'be taken with SOLID FOOD (not just liquids or smoothies alone).</div>' +
    '<div class="pr-info"><b>For ordering supplements:</b> We will email you a link and ' +
      'information to access the VIP Store after your consultation.</div>' +
    '<div class="pr-info">Troubleshooting and questions are addressed in the Office ' +
      'Hours (Zoom) ' + L('circle', U.office) + '. You get 6 months access with each ' +
      'Testing and Consultation package, and that access begins after your consultation. ' +
      'Julie will email you an invitation to join the Office Hours circle.</div>';

  const optional =
    consultHandoutSec('Optional') +
    consultHandoutItem(
      L('Vitamin K', U.vitk) + ': <span class="pr-dose">1 tablet per day.</span>',
      consultHandoutSub('Helps calcium go where it should and takes it out of where it ' +
        'should not be, modulates coagulation, and reduces risk of arteriosclerosis / ' +
        'atherosclerosis (hardening of the arteries).'));

  const lowNiacin =
    consultHandoutSec('Low-dose nicotinic acid (up to 200 mg/day) aka Flush Niacin') +
    consultHandoutItem(
      L('ND Flush Niacin 25 mg', U.niacin25) + ': <span class="pr-dose">25-200 mg per day as tolerated.</span>',
      consultHandoutSub('Articles: ' + L('Niacin guidelines by Kelsey Kenney', U.niacinArt)));

  const electrolytes =
    consultHandoutSec('Electrolytes') +
    consultHandoutItem(
      'Magnesium (topical) - ' + L('ND Magnesium Lotion', U.magLotion) +
        ': <span class="pr-dose">find at least one that works for you and use it consistently.</span>',
      consultHandoutSub('Magnesium article (please read): ' + L('topical / transdermal magnesium approaches', U.magArt))) +
    consultHandoutItem(
      'Sodium chloride ("salt"): <span class="pr-dose">Salt your food to taste. Use a ' +
        'bright white, single-ingredient salt such as ' + L("Jacobsen's Sea Salt", U.salt) +
        '. Do not purposely restrict salt.</span>',
      consultHandoutSub('Sodium article (please read): ' + L('sodium / salt', U.sodiumArt))) +
    consultHandoutItem(
      'Potassium: <span class="pr-dose">VERY important - you must experiment to see what works for you.</span>',
      consultHandoutSub('Potassium articles (please watch and read): ' + L('potassium', U.potArt)));

  const bigMinerals =
    consultHandoutSec('"Big" minerals') +
    consultHandoutItem(
      L('ND Selenium Glycinate 150 mcg', U.sel) + ': <span class="pr-dose">1-2 tablets per day (150 mcg).</span>',
      consultHandoutSub('Brazil nuts are NOT an adequate selenium option any longer.')) +
    consultHandoutItem(
      L('ND Molybdenum Glycinate 150 mcg', U.moly) + ': <span class="pr-dose">1-2 tablets per day (150 mcg).</span>',
      '') +
    consultHandoutItem(
      'ND Zinc Picolinate (' + L('15 mg', U.zinc15) + ' or ' + L('30 mg', U.zinc30) +
        '): <span class="pr-dose">15-60 mg per day.</span>',
      consultHandoutSub('This dose must be re-assessed and adjusted within a six-month period.') +
      consultHandoutSub('Zinc dose can be further adjusted once Copper and Zinc blood tests are obtained.'));

  const keystone =
    consultHandoutSec('Optional: Keystone Minerals (30 mg zinc, 150 mcg selenium, 150 mcg molybdenum)') +
    consultHandoutItem(
      L('ND Keystone Minerals', U.km) + ': <span class="pr-dose">1 capsule per day.</span> Also available: ' +
        L('ND Keystone Minerals Plus Niacin', U.kmNiacin) + '.',
      consultHandoutSub('Only use KM if you have tested the individual mineral doses in it and know they are OK.') +
      consultHandoutSub('Remember that KM SUBSTITUTES for the minerals above, NOT in addition.'));

  const highNiacin =
    consultHandoutSec('High-dose nicotinic acid aka Flush Niacin') +
    consultHandoutItem(
      L('ND Flush Niacin 500 mg', U.niacin500) + '.',
      consultHandoutSub('Articles: ' + L('Niacin guidelines by Kelsey Kenney', U.niacinArt)));

  const lactoferrin =
    consultHandoutSec('Lactoferrin') +
    consultHandoutItem(
      L('ND Lactoferrin', U.lacto) + ': <span class="pr-dose">Work up SLOWLY toward 1 capsule per day. ' +
        'Read instructions carefully!</span>',
      consultHandoutSub('Lactoferrin instructions: ' + L('lactoferrin instructions', U.lactoArt)));

  const toxins =
    consultHandoutSec('Toxin-related articles') +
    consultHandoutItem('"Rice & Arsenic" video: ' + L('rice / water / hair test information', U.arsenic), '') +
    consultHandoutItem('Aluminum / aluminium video: ' + L('aluminum', U.aluminum), '');

  const foot =
    '<div class="pr-foot">Nutrition Detective - Supplement Recommendations. ' +
      'Generated for ' + consultEsc(name) + ' on ' + consultEsc(dateStr) + '.</div>';

  return '<div class="pr-doc">' + header + intro +
         optional + lowNiacin + electrolytes + bigMinerals +
         keystone + highNiacin + lactoferrin + toxins + foot + '</div>';
}

// Triggered from the finalized-consult view. Resolves the row from the in-memory
// list (same pattern as consultOpen), derives the patient name + date, and prints.
function consultPrintHandout(id) {
  const row = (_consultRows || []).find(function (r) { return String(r.id) === String(id); });
  if (!row) {
    if (typeof toast === 'function') toast('Open a finalized consult to print the handout.');
    return;
  }
  const name = consultPatientName(row);
  const dateStr = row.consult_date || consultDateToday();
  consultPrintDoc(consultHandoutHtml(name, dateStr));
}
