// =============================================================================
// PDF deliverables - patient supplement handout as PDF + provider-sent email
// (Milestone 4, slice 4d). Generates the handout as a real PDF via pdfMake
// (reusing the catalog URLs ND_HANDOUT_URLS and consultPatientName from 4b, and
// consultPdfReady/consultPdfFilename/CONSULT_PDF_STYLES from 4c). "Email to
// client" generates the PDF and opens the provider's mail client pre-addressed
// to the client (email resolved from client_id -> clients) with a ready subject
// and body; the provider attaches the downloaded PDF and sends. The app never
// sends mail itself. Lives before const MARKER_ORDER - engine block untouched.
// =============================================================================

function consultPdfLink(text, href) {
  return { text: text, link: href, color: '#1a5fb4', decoration: 'underline' };
}

function consultHandoutPdfItem(headInline, subs) {
  const stack = [{ text: headInline, margin: [0, 5, 0, 0] }];
  (subs || []).forEach(function (s) {
    stack.push({ text: s, fontSize: 9, color: '#555', margin: [12, 1, 0, 0] });
  });
  return { stack: stack, margin: [0, 1, 0, 1] };
}

function consultHandoutDocDef(name, dateStr) {
  const U = ND_HANDOUT_URLS;
  const L = consultPdfLink;
  const item = consultHandoutPdfItem;

  const content = [];
  content.push({ text: 'Nutrition Detective', style: 'brand' });
  content.push({ text: 'Supplement Recommendations for ' + name, style: 'title' });
  content.push({ text: 'Date: ' + dateStr, fontSize: 10.5, color: '#333', margin: [0, 0, 0, 8] });

  content.push({
    table: { widths: ['*'], body: [[{
      text: 'Re-test 3-6 months after starting supplements. Re-testing at regular intervals is crucial to this approach!',
      bold: true, color: '#1d4d2a'
    }]] },
    layout: {
      fillColor: function () { return '#eef6f0'; },
      hLineColor: function () { return '#2f6f3e'; }, vLineColor: function () { return '#2f6f3e'; },
      hLineWidth: function () { return 1; }, vLineWidth: function () { return 1; },
      paddingTop: function () { return 6; }, paddingBottom: function () { return 6; },
      paddingLeft: function () { return 8; }, paddingRight: function () { return 8; }
    },
    margin: [0, 8, 0, 12]
  });

  content.push({ text: 'Please read these supplement recommendations thoroughly, along with any other information we give you.', margin: [0, 3, 0, 3] });
  content.push({ text: ['Please read ALL of the information in the Love Your Liver course materials - this is your nutrition and diet information: ', L('Love Your Liver course materials', U.course)], margin: [0, 3, 0, 3] });
  content.push({ text: [{ text: 'Timing of supplements: ', bold: true }, 'Supplements can be taken any time of day. They can be split up or taken all at once. ALL supplements should be taken with SOLID FOOD (not just liquids or smoothies alone).'], fontSize: 10, margin: [0, 3, 0, 3] });
  content.push({ text: [{ text: 'For ordering supplements: ', bold: true }, 'We will email you a link and information to access the VIP Store after your consultation.'], fontSize: 10, margin: [0, 3, 0, 3] });
  content.push({ text: ['Troubleshooting and questions are addressed in the Office Hours (Zoom) ', L('circle', U.office), '. You get 6 months access with each Testing and Consultation package, and that access begins after your consultation. Julie will email you an invitation to join the Office Hours circle.'], fontSize: 10, margin: [0, 3, 0, 3] });

  content.push({ text: 'Optional', style: 'sec' });
  content.push(item([L('Vitamin K', U.vitk), ': 1 tablet per day.'],
    ['Helps calcium go where it should and takes it out of where it should not be, modulates coagulation, and reduces risk of arteriosclerosis / atherosclerosis (hardening of the arteries).']));

  content.push({ text: 'Low-dose nicotinic acid (up to 200 mg/day) aka Flush Niacin', style: 'sec' });
  content.push(item([L('ND Flush Niacin 25 mg', U.niacin25), ': 25-200 mg per day as tolerated.'],
    [['Articles: ', L('Niacin guidelines by Kelsey Kenney', U.niacinArt)]]));

  content.push({ text: 'Electrolytes', style: 'sec' });
  content.push(item(['Magnesium (topical) - ', L('ND Magnesium Lotion', U.magLotion), ': find at least one that works for you and use it consistently.'],
    [['Magnesium article (please read): ', L('topical / transdermal magnesium approaches', U.magArt)]]));
  content.push(item(['Sodium chloride ("salt"): Salt your food to taste. Use a bright white, single-ingredient salt such as ', L("Jacobsen's Sea Salt", U.salt), '. Do not purposely restrict salt.'],
    [['Sodium article (please read): ', L('sodium / salt', U.sodiumArt)]]));
  content.push(item(['Potassium: VERY important - you must experiment to see what works for you.'],
    [['Potassium articles (please watch and read): ', L('potassium', U.potArt)]]));

  content.push({ text: '"Big" minerals', style: 'sec' });
  content.push(item([L('ND Selenium Glycinate 150 mcg', U.sel), ': 1-2 tablets per day (150 mcg).'],
    ['Brazil nuts are NOT an adequate selenium option any longer.']));
  content.push(item([L('ND Molybdenum Glycinate 150 mcg', U.moly), ': 1-2 tablets per day (150 mcg).']));
  content.push(item(['ND Zinc Picolinate (', L('15 mg', U.zinc15), ' or ', L('30 mg', U.zinc30), '): 15-60 mg per day.'],
    ['This dose must be re-assessed and adjusted within a six-month period.',
     'Zinc dose can be further adjusted once Copper and Zinc blood tests are obtained.']));

  content.push({ text: 'Optional: Keystone Minerals (30 mg zinc, 150 mcg selenium, 150 mcg molybdenum)', style: 'sec' });
  content.push(item([L('ND Keystone Minerals', U.km), ': 1 capsule per day. Also available: ', L('ND Keystone Minerals Plus Niacin', U.kmNiacin), '.'],
    ['Only use KM if you have tested the individual mineral doses in it and know they are OK.',
     'Remember that KM SUBSTITUTES for the minerals above, NOT in addition.']));

  content.push({ text: 'High-dose nicotinic acid aka Flush Niacin', style: 'sec' });
  content.push(item([L('ND Flush Niacin 500 mg', U.niacin500), '.'],
    [['Articles: ', L('Niacin guidelines by Kelsey Kenney', U.niacinArt)]]));

  content.push({ text: 'Lactoferrin', style: 'sec' });
  content.push(item([L('ND Lactoferrin', U.lacto), ': Work up SLOWLY toward 1 capsule per day. Read instructions carefully!'],
    [['Lactoferrin instructions: ', L('lactoferrin instructions', U.lactoArt)]]));

  content.push({ text: 'Toxin-related articles', style: 'sec' });
  content.push(item(['"Rice & Arsenic" video: ', L('rice / water / hair test information', U.arsenic)]));
  content.push(item(['Aluminum / aluminium video: ', L('aluminum', U.aluminum)]));

  content.push({ text: 'Nutrition Detective - Supplement Recommendations. Generated for ' + name + ' on ' + dateStr + '.', style: 'foot' });

  return {
    pageSize: 'LETTER',
    pageMargins: [54, 54, 54, 54],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.2, color: '#111' },
    styles: CONSULT_PDF_STYLES,
    content: content
  };
}

function consultDownloadHandout(id) {
  const row = (_consultRows || []).find(function (r) { return String(r.id) === String(id); });
  if (!row) { if (typeof toast === 'function') toast('Open a finalized consult to download.'); return false; }
  if (!consultPdfReady()) { if (typeof toast === 'function') toast('PDF library still loading - try again in a moment.'); return false; }
  const name = consultPatientName(row);
  const fname = consultPdfFilename('Supplement-Recommendations', name, row.consult_date);
  try {
    pdfMake.createPdf(consultHandoutDocDef(name, row.consult_date)).download(fname);
    return true;
  } catch (e) {
    console.error('[consult] handout pdf failed:', e);
    if (typeof toast === 'function') toast('Could not generate the handout PDF.');
    return false;
  }
}

async function consultEmailHandout(id) {
  const row = (_consultRows || []).find(function (r) { return String(r.id) === String(id); });
  if (!row) { if (typeof toast === 'function') toast('Open a finalized consult.'); return; }
  // Generate + download the handout PDF for the provider to attach.
  if (!consultDownloadHandout(id)) return;
  const name = consultPatientName(row);
  let email = '';
  try {
    if (row.client_id) {
      const res = await dbSelect('clients', { id: 'eq.' + row.client_id });
      const c = Array.isArray(res.data) ? res.data[0] : res.data;
      if (c) email = String(c.email || '').trim();
    }
  } catch (e) { console.warn('[consult] client email lookup failed:', e); }
  const subject = 'Your Nutrition Detective Supplement Recommendations';
  const body = [
    'Hi ' + name + ',',
    '',
    'Attached are your personalized supplement recommendations from your consultation on ' + (row.consult_date || '') + '.',
    '',
    'Please read them thoroughly. Re-testing in 3-6 months is an important part of this approach.',
    '',
    'Best,',
    'Nutrition Detective'
  ].join('\n');
  const mailto = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  window.location.href = mailto;
  if (typeof toast === 'function') toast('Handout downloaded - attach it to the email that just opened.');
}
