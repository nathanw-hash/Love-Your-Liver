/* ============================================================================
 * intake_form.js — canonical LYL client intake definition (form_version 1)
 *
 * Single source of truth for three things:
 *   1. the client-facing intake UI (sections -> questions),
 *   2. the question_id keys stored in intake_submissions.answers,
 *   3. the promoted-column mirror map (answers -> typed columns).
 *
 * Built verbatim from Dr. Smith's Google questionnaire. A few questions were
 * digitized into more structured inputs than the paper form (see DIGITIZATION
 * NOTES at the bottom). Question order preserves the form — including the
 * clinically intentional interleaving of the bleeding probes between selenium
 * and vitamin K.
 *
 * Field types the renderer understands:
 *   'email'    — email input
 *   'text'     — single-line text
 *   'number'   — numeric (optional unit / unitOptions)
 *   'textarea' — multi-line freetext
 *   'single'   — choose exactly one (radio); options[]
 *   'multi'    — choose many (checkboxes); options[]; optional exclusive option
 *                (selecting it clears the rest) and optional "Other" freetext
 *
 * Question fields: { id, type, label, required?, options?, exclusive?,
 *                    allowOther?, unit?, unitOptions?, prefill?, help? }
 * ==========================================================================*/
(function (root) {
  'use strict';

  var version = 1;

  var sections = [
    {
      id: 'identity',
      title: 'Your details',
      questions: [
        { id: 'email', type: 'email', label: 'Email', required: true, prefill: 'email' },
        { id: 'name',  type: 'text',  label: 'Name', prefill: 'name' }
      ]
    },

    {
      id: 'chief_complaints',
      title: 'Main concerns',
      intro: 'The three main issues/symptoms you are hoping Dr. Smith can help you resolve.',
      questions: [
        { id: 'cc_1', type: 'text', label: 'Main issue / symptom #1', required: true },
        { id: 'cc_2', type: 'text', label: 'Main issue / symptom #2' },
        { id: 'cc_3', type: 'text', label: 'Main issue / symptom #3' }
      ]
    },

    {
      id: 'review_of_systems',
      title: 'Review of systems',
      intro: 'For the last month. Select all that apply.',
      questions: [
        { id: 'ros_general', type: 'multi', allowOther: true, exclusive: 'None of the above',
          label: 'GENERAL: fevers, chills, or significant unintended weight changes?',
          options: ['Fever(s)', 'Chills', 'Significant unintended weight changes (up or down)'] },
        { id: 'ros_ocular', type: 'multi', allowOther: true, exclusive: 'None of the above',
          label: 'OCULAR: abnormal eye fluids/dryness or blurred vision?',
          options: ['Excessive eye fluids/drainage', 'Eye dryness', 'Blurred vision'] },
        { id: 'ros_heent', type: 'multi', allowOther: true, exclusive: 'None of the above',
          label: 'HEENT: sore throat, earache, sinus congestion, and/or neck pain?',
          options: ['Sore Throat', 'Earache', 'Sinus Congestion', 'Neck Pain or Neck Stiffness'] },
        { id: 'ros_cardiovascular', type: 'multi', allowOther: true, exclusive: 'Neither',
          label: 'CARDIOVASCULAR: chest pain or heart rhythm/beat issues?',
          options: ['Chest Pain', 'Heart Rhythm/Beat Issues (ex. Palpitations)'] },
        { id: 'ros_lungs', type: 'multi', allowOther: true, exclusive: 'Neither',
          label: 'LUNGS: shortness of breath or coughing?',
          options: ['Shortness of Breath', 'Coughing'] },
        { id: 'ros_gastrointestinal', type: 'multi', allowOther: true, exclusive: 'None of the above',
          label: 'GASTROINTESTINAL: nausea, vomiting, diarrhea, constipation, or lack of appetite?',
          options: ['Nausea', 'Vomiting', 'Diarrhea',
                    'Constipation (bowel movements once a day or less, or excessive straining)',
                    'Lack of Appetite'] },
        { id: 'ros_genitourinary', type: 'multi', allowOther: true,
          label: 'GENITOURINARY: urinary frequency/urgency, pain or blood when urinating? Ladies: abnormal vaginal discharge or menstrual bleeding?',
          options: ['Urinary frequency', 'Urinary urgency', 'Pain while urinating', 'Blood in the urine',
                    'Ladies - abnormal vaginal discharge', 'Ladies - abnormal menstrual bleeding'] },
        { id: 'ros_musculoskeletal', type: 'multi', allowOther: true, exclusive: 'None of the above',
          label: 'MUSCULOSKELETAL: joint pain(s), stiffness, swelling, or edema?',
          options: ['Joint pain(s)', 'Stiffness', 'Swelling', 'Edema'] },
        { id: 'ros_skin', type: 'multi', allowOther: true, exclusive: 'None of the above',
          label: 'SKIN: rashes, itching, or other skin conditions?',
          options: ['Rashes', 'Itching', 'Other skin conditions'] },
        { id: 'ros_psychiatric', type: 'multi', allowOther: true, exclusive: 'None of the above',
          label: 'PSYCHIATRIC: anxiety, depression, irritability, or other mental-emotional issues?',
          options: ['Anxiety', 'Depression', 'Irritability'] },
        { id: 'ros_endocrine', type: 'multi', allowOther: true, exclusive: 'Neither',
          label: 'ENDOCRINE: excessive urination or excessive thirst?',
          options: ['Excessive urination', 'Excessive thirst'] }
      ]
    },

    {
      id: 'vitals',
      title: 'Vitals',
      intro: 'Measure what you can. If you cannot take a reading, note that in the field.',
      questions: [
        { id: 'vitals_age',    type: 'number', label: 'Current age' },
        { id: 'vitals_height', type: 'text',   label: 'Height' },
        { id: 'vitals_weight', type: 'number', label: 'Current weight',
          unit: 'lbs', unitOptions: ['lbs', 'kg'] },   // mirrored to weight_lbs (kg converted)
        { id: 'vitals_pulse', type: 'number', label: 'Pulse (heart beats per minute)',
          help: { text: 'How To Take Your Pulse', url: '' } },
        { id: 'vitals_respiratory_rate', type: 'number', label: 'Respiratory rate (breaths per minute)',
          help: { text: 'How To Measure Your Respiratory Rate', url: '' } },
        { id: 'vitals_blood_pressure', type: 'text', label: 'Blood pressure (e.g. 120/80) — or note if unable',
          help: { text: 'How To Measure Your Blood Pressure', url: '' } },
        { id: 'vitals_temperature', type: 'text', label: 'Temperature — or note if unable',
          help: { text: 'How To Take A Temperature', url: '' } }
      ]
    },

    {
      id: 'history',
      title: 'Medical history',
      questions: [
        { id: 'allergies',   type: 'textarea', label: 'Known allergies' },
        { id: 'medications', type: 'textarea', label: 'Current pharmaceutical or hormonal medications, with dosages (N/A if none)' },
        { id: 'diagnoses',   type: 'textarea', label: 'Specific medical diagnoses given by other practitioners (include ICD-10 codes only if they gave them to you)' },
        { id: 'surgeries',   type: 'textarea', label: 'Past surgeries, with the year each was performed' }
      ]
    },

    {
      id: 'profile',
      title: 'Sensitivity, supplements & detox profile',
      // Order preserved from the form: sensitivity, then supplement history and
      // the bleeding/alcohol/caffeine probes interleaved as the clinician wrote them.
      questions: [
        { id: 'sens_profile', type: 'single', options: ['Yes', 'No', 'Maybe', 'Not Sure'],
          label: 'Would you consider yourself a SENSITIVE person — do you commonly need lower-than-normal doses, or have overly strong reactions to normal doses, of supplements/medications?' },

        { id: 'supp_vitamin_d', type: 'single', options: ['Yes', 'No'],
          label: 'Any history ever of taking Vitamin D supplements, cod liver oil, or other oral Vitamin D?' },
        { id: 'supp_magnesium', type: 'textarea',
          label: 'Magnesium supplements over the last 6 months (type + dosing strategy, topical and/or oral)' },
        { id: 'supp_potassium', type: 'textarea',
          label: 'Potassium supplements over the last 6 months (type + dosing strategy)' },
        { id: 'supp_zinc', type: 'textarea',
          label: 'Zinc supplements over the last 6 months (type + dosing)' },
        { id: 'supp_selenium', type: 'textarea',
          label: 'Selenium supplements over the last 6 months (type + dosing)' },

        { id: 'bleed_easy_bruiser', type: 'single', options: ['Yes', 'No', 'Maybe'],
          label: 'Would you consider yourself an easy bruiser (bruises appear without a known cause)?' },
        { id: 'bleed_slow_clot', type: 'single', options: ['Yes', 'No', 'Maybe'],
          label: 'With a nosebleed or cut, does it take longer than it should to stop bleeding?' },
        { id: 'bleed_gums', type: 'single', options: ['Yes', 'No', 'Maybe'],
          label: 'Any issues with bleeding gums?' },
        { id: 'bleed_sensitive_teeth', type: 'single', options: ['Yes', 'No', 'Maybe'],
          label: 'Any issues with sensitive teeth?' },
        { id: 'supp_vitamin_k', type: 'textarea',
          label: 'Vitamin K supplements over the last 6 months (type — K1, K2, MK-4, MK-7, etc. — and dosing)' },

        { id: 'sens_alcohol', type: 'single', options: ['Yes', 'No', 'Maybe'],
          label: 'More sensitive than you should be to alcohol (low tolerance, or feeling awful during/after)?' },
        { id: 'sens_wine', type: 'single', options: ['Yes', 'No', 'Maybe'],
          label: 'Does wine give you symptoms other alcohol does not (sleepiness, feeling hot, irritability, flushing, poor sleep)?' },
        { id: 'sens_caffeine', type: 'single', options: ['Yes', 'No', 'Maybe'],
          label: 'More sensitive than you should be to caffeine?' },
        { id: 'hist_fungal', type: 'single', options: ['Yes', 'No', 'Maybe'],
          label: 'Ever in your life had fungal/yeast issues (dandruff, athlete\u2019s foot, toenail fungus, thrush, tinea, jock itch, etc.)?' },
        { id: 'sx_sulfur_gas', type: 'single', options: ['Yes', 'No'],
          label: 'Recently, any gas/flatulence that smells like rotten eggs or sulfur?' },
        { id: 'supp_molybdenum', type: 'textarea',
          label: 'Molybdenum supplements over the last 6 months (type + dosing)' }
      ]
    }
  ];

  // Promoted-column mirror: applied on save to populate the typed columns on
  // intake_submissions. Everything else stays in answers JSONB only.
  var promoted = {
    weight_lbs: {
      from: 'vitals_weight',
      unitFrom: 'vitals_weight_unit',  // 'lbs' (passthrough) or 'kg' (x 2.20462)
      toPounds: true
    },
    sensitivity: {
      from: 'sens_profile',
      map: { 'Yes': 'yes', 'No': 'no', 'Maybe': 'maybe', 'Not Sure': 'not_sure' }
    }
  };

  var api = { version: version, sections: sections, promoted: promoted };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LYL_INTAKE = api;
})(typeof window !== 'undefined' ? window : null);

/* ============================================================================
 * DIGITIZATION NOTES — deliberate departures from the paper form, for review:
 *
 * 1. Chief complaints: the form's single "three main issues" field becomes three
 *    labeled fields (cc_1 required, cc_2 / cc_3 optional). Cleaner structured data.
 * 2. Weight: the form's free-text "pounds or kilograms" becomes a number + unit
 *    toggle so weight_lbs can be computed reliably (kg is converted to lbs).
 * 3. ROS "None of the above" / "Neither" are modeled as EXCLUSIVE options
 *    (selecting one clears the symptom checks), each with an "Other" freetext.
 * 4. Email / Name are prefilled from the logged-in client's profile (editable).
 * 5. GENITOURINARY has no "None"/"Neither" option in the source form — preserved
 *    as-is (only its symptom options + Other). Flag if you want a "None" added.
 *
 * NEEDS YOUR INPUT:
 *  - The four vitals help links (pulse / respiratory rate / BP / temperature)
 *    have empty url:'' — paste the real URLs from the Google Form when handy.
 * ==========================================================================*/
