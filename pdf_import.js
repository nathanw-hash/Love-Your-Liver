// PDF IMPORT
let pdfExtractedData = {};

async function importPDF(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  document.getElementById('pdf-modal').style.display = 'block';
  document.getElementById('pdf-modal-body').style.display = 'none';
  const status = document.getElementById('pdf-modal-status');
  status.textContent = 'Reading PDF — this may take 10-20 seconds...';
  status.style.background = '#e8f4ee';
  status.style.color = '#2d6a4f';
  try {
    const base64 = await fileToBase64(file);
    const prompt = `Extract lab values from this medical PDF. Return ONLY valid JSON with this structure (null for missing values):\n{"lab_type":"labcorp or tei","date":"YYYY-MM-DD or null","serum_retinol":null,"ferritin":null,"blood_copper":null,"blood_zinc":null,"hair_calcium":null,"hair_magnesium":null,"hair_phosphorus":null,"hair_copper":null,"hair_zinc":null,"hair_selenium":null,"hair_molybdenum":null,"hair_mercury":null,"hair_lead":null,"hair_cadmium":null,"hair_arsenic":null,"hair_aluminum":null,"hair_uranium":null}\nFor LabCorp: find Vitamin A/Retinol, Copper, Zinc, Ferritin values.\nFor Trace Elements Lab: read numeric values at bottom of each bar chart column. Ca=calcium, Mg=magnesium, P=phosphorus, Cu=copper, Zn=zinc, Se=selenium, Mo=molybdenum, Hg=mercury, Pb=lead, Cd=cadmium, As=arsenic, Al=aluminum, U=uranium.`;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: prompt }
        ]}]
      })
    });
    const result = await response.json();
    const text = result.content[0].text.trim().replace(/```json|```/g, '').trim();
    pdfExtractedData = JSON.parse(text);
    renderPdfModal(pdfExtractedData);
    document.getElementById('pdf-modal-body').style.display = 'block';
    status.textContent = 'Detected: ' + (pdfExtractedData.lab_type === 'labcorp' ? 'LabCorp/Quest blood work' : pdfExtractedData.lab_type === 'tei' ? 'Trace Elements Lab hair analysis' : 'Lab report') + '. Review values below.';
  } catch(err) {
    status.textContent = 'Error: ' + err.message;
    status.style.background = '#fef2f2';
    status.style.color = '#b91c1c';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PDF_FIELD_LABELS = { date:'Test date', serum_retinol:'Serum retinol (mcg/dL)', ferritin:'Ferritin (ng/mL)', blood_copper:'Blood copper (mcg/dL)', blood_zinc:'Blood zinc (mcg/dL)', hair_calcium:'Hair calcium', hair_magnesium:'Hair magnesium', hair_phosphorus:'Hair phosphorus', hair_copper:'Hair copper', hair_zinc:'Hair zinc', hair_selenium:'Hair selenium', hair_molybdenum:'Hair molybdenum', hair_mercury:'Mercury (Hg)', hair_lead:'Lead (Pb)', hair_cadmium:'Cadmium (Cd)', hair_arsenic:'Arsenic (As)', hair_aluminum:'Aluminum (Al)', hair_uranium:'Uranium (U)' };
const PDF_FIELD_MAP = { date:'l-date', serum_retinol:'l-retinol', ferritin:'l-ferritin', blood_copper:'l-bcopper', blood_zinc:'l-bzinc', hair_calcium:'l-ca', hair_magnesium:'l-mg', hair_phosphorus:'l-p', hair_copper:'l-cu', hair_zinc:'l-zn', hair_selenium:'l-se', hair_molybdenum:'l-mo', hair_mercury:'l-hg', hair_lead:'l-pb', hair_cadmium:'l-cd', hair_arsenic:'l-as', hair_aluminum:'l-al', hair_uranium:'l-ur' };

function renderPdfModal(data) {
  let extractedHtml = '', editHtml = '';
  Object.entries(PDF_FIELD_LABELS).forEach(([key, label]) => {
    const val = data[key];
    if (val === null || val === undefined) return;
    extractedHtml += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0ede6;"><span style="color:#6b6660">' + label + '</span><strong>' + val + '</strong></div>';
    editHtml += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#6b6660;display:block;margin-bottom:2px;">' + label + '</label><input type="' + (key === 'date' ? 'date' : 'number') + '" step="any" id="pdf-edit-' + key + '" value="' + val + '" style="width:100%;padding:6px 10px;border:1.5px solid #e2ddd6;border-radius:6px;font-family:DM Sans,sans-serif;font-size:13px;"></div>';
  });
  document.getElementById('pdf-extracted-values').innerHTML = extractedHtml || '<p style="color:#9e9890">No values found</p>';
  document.getElementById('pdf-edit-fields').innerHTML = editHtml;
}

function applyPdfValues() {
  Object.entries(PDF_FIELD_MAP).forEach(([key, fieldId]) => {
    const editEl = document.getElementById('pdf-edit-' + key);
    if (!editEl || !editEl.value) return;
    const formEl = document.getElementById(fieldId);
    if (formEl) formEl.value = editEl.value;
  });
  closePdfModal();
  toast('Lab values applied — review and save when ready');
}

function closePdfModal() {
  document.getElementById('pdf-modal').style.display = 'none';
  pdfExtractedData = {};
}
