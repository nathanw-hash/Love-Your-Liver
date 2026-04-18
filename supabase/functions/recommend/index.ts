import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token: " + (userError?.message ?? "no user"));

    const { lab_result_id } = await req.json();
    if (!lab_result_id) throw new Error("lab_result_id required");

    const { data: labs, error: labError } = await supabaseAdmin
      .from("lab_results").select("*")
      .eq("id", lab_result_id).eq("user_id", user.id).single();
    if (labError || !labs) throw new Error("Lab result not found");

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("*").eq("user_id", user.id).single();

    const p = profile || {};
    const sex = p.sex || "unknown";
    const weight = p.weight_lbs || 150;
    const findings = [];
    const actions = [];
    const doses = [];

    function status(val, low, high) {
      if (val === null || val === undefined) return null;
      if (val < low) return "low";
      if (val > high) return "high";
      return "optimal";
    }

    if (labs.serum_retinol !== null) {
      const s = status(labs.serum_retinol, 0, 50);
      findings.push({ marker: "Serum retinol", value: labs.serum_retinol, unit: "mcg/dL", status: s === "high" ? "high" : s === "low" ? "low" : "optimal", interpretation: s === "high" ? "Elevated — key driver of cholestasis. Eliminate all vitamin A sources immediately." : s === "low" ? "Low retinol — unusual." : "Within LYL optimal range (< 50 mcg/dL)." });
      if (s === "high") actions.push({ priority: "urgent", title: "Reduce vitamin A intake", body: "Eliminate liver, organ meats, cod liver oil, dairy, and fortified foods. Avoid all vitamin A and fish oil supplements." });
    }
    if (labs.ferritin !== null) {
      const optLow = sex === "male" ? 30 : 50;
      const optHigh = sex === "male" ? 70 : 100;
      const s = status(labs.ferritin, optLow, optHigh);
      findings.push({ marker: "Ferritin", value: labs.ferritin, unit: "ng/mL", status: s === "high" ? "high" : s === "low" ? "low" : "optimal", interpretation: s === "high" ? `High (optimal ${optLow}-${optHigh}). Often indicates inflammation and/or copper toxicity.` : s === "low" ? `Low (optimal ${optLow}-${optHigh}). Address root cause before supplementing iron.` : `Within optimal range (${optLow}-${optHigh} ng/mL).` });
      if (s === "high") actions.push({ priority: "action", title: "Address elevated ferritin", body: "High ferritin typically reflects inflammation or copper toxicity. Work the LYL protocol — do not supplement iron." });
      if (s === "low") actions.push({ priority: "urgent", title: "Investigate low ferritin", body: "Address copper toxicity and cholestasis as root causes before considering iron supplementation." });
    }
    if (labs.ggt !== null) {
      const s = status(labs.ggt, 0, 20);
      findings.push({ marker: "GGT", value: labs.ggt, unit: "U/L", status: s === "high" ? "high" : "optimal", interpretation: s === "high" ? "Elevated above LYL optimal (< 20 U/L). Most sensitive early marker of cholestasis." : "Within LYL optimal range (< 20 U/L)." });
      if (s === "high") actions.push({ priority: "urgent", title: "Elevated GGT — cholestasis indicator", body: "Prioritize bile flow support: niacin, soluble fiber, hydration, Big 6 Lymph Drainage, and daily movement." });
    }
    for (const marker of ["alt", "ast"]) {
      const val = labs[marker];
      if (val !== null && val !== undefined) {
        const s = status(val, 0, 20);
        findings.push({ marker: marker.toUpperCase(), value: val, unit: "U/L", status: s === "high" ? "high" : "optimal", interpretation: s === "high" ? `${marker.toUpperCase()} elevated above LYL optimal (< 20 U/L).` : `${marker.toUpperCase()} within LYL optimal range.` });
      }
    }
    if (labs.blood_copper !== null) {
      findings.push({ marker: "Blood copper", value: labs.blood_copper, unit: "mcg/dL", status: labs.blood_copper > 120 ? "high" : "optimal", interpretation: labs.blood_copper > 120 ? "Elevated — major driver of cholestasis and mineral depletion." : "Within acceptable range." });
      if (labs.blood_copper > 120) actions.push({ priority: "urgent", title: "Address copper toxicity", body: "Eliminate chocolate, nuts, seeds, soy. Check water pipes — use RO filtration. Work the Big Minerals." });
    }
    if (labs.blood_zinc !== null) {
      const s = status(labs.blood_zinc, 80, 130);
      findings.push({ marker: "Blood zinc", value: labs.blood_zinc, unit: "mcg/dL", status: s === "low" ? "low" : s === "high" ? "high" : "optimal", interpretation: s === "low" ? "Low — impairs RBP production and copper displacement from the liver." : s === "high" ? "High — confirm no excessive supplementation." : "Within acceptable range." });
      if (s === "low") {
        const maxDose = Math.min(Math.round((weight * 0.40) / 15) * 15, 100);
        doses.push({ supplement: "Zinc picolinate", dose: `${maxDose}mg/day`, instructions: `Calculated from body weight (40% of ${weight} lbs, capped at 100mg). Start at 15-30mg and increase slowly.` });
        actions.push({ priority: "action", title: "Support zinc levels", body: `Start zinc picolinate — max dose ${maxDose}mg/day. Begin at 15-30mg and increase gradually.` });
      }
    }
    if (labs.hair_calcium !== null) {
      const s = status(labs.hair_calcium, 40, 42);
      findings.push({ marker: "Hair Ca", value: labs.hair_calcium, unit: "", status: s === "low" ? "low" : s === "high" ? "watch" : "optimal", interpretation: s === "high" ? "High hair calcium — often biounavailable, depositing in soft tissues." : s === "low" ? "Below optimal (40-42)." : "Within optimal range (40-42)." });
      if (s === "high") actions.push({ priority: "watch", title: "High hair calcium", body: "Use topical magnesium, reduce vitamin A, get vitamin D from sunlight, consider vitamin K2 MK-4." });
    }
    if (labs.hair_copper !== null) {
      const s = status(labs.hair_copper, 1.5, 2.5);
      findings.push({ marker: "Hair Cu", value: labs.hair_copper, unit: "", status: s === "high" ? "high" : s === "low" ? "low" : "optimal", interpretation: s === "high" ? "Elevated above optimal (1.5-2.5). Confirms copper accumulation in tissues." : s === "low" ? "Low — may reflect copper dumping during detox." : "Within optimal range (1.5-2.5)." });
      if (s === "high") actions.push({ priority: "action", title: "Elevated hair copper", body: "Work copper detox protocol: zinc, selenium, molybdenum, flush niacin, soluble fiber. Eliminate high-copper foods." });
    }
    if (labs.hair_zinc !== null) {
      const s = status(labs.hair_zinc, 17, 20);
      findings.push({ marker: "Hair Zn", value: labs.hair_zinc, unit: "", status: s === "low" ? "low" : s === "high" ? "high" : "optimal", interpretation: s === "low" ? "Below optimal (17-20). Impairs vitamin A detox and copper clearance." : s === "high" ? "Above range — confirm no excessive supplementation." : "Within optimal range (17-20)." });
    }
    if (labs.hair_selenium !== null) {
      const s = status(labs.hair_selenium, 0.11, 0.15);
      findings.push({ marker: "Hair Se", value: labs.hair_selenium, unit: "", status: s === "low" ? "low" : s === "high" ? "high" : "optimal", interpretation: s === "low" ? "Below optimal (0.11-0.15). Required for ALDH enzyme and liver protection." : s === "high" ? "Above optimal range." : "Within optimal range (0.11-0.15)." });
      if (s === "low") {
        doses.push({ supplement: "Selenium glycinate", dose: "150mcg/day", instructions: "Big Minerals rule: reduce or stop if negative reactions within 3-7 days." });
        actions.push({ priority: "action", title: "Support selenium levels", body: "Start selenium glycinate 150mcg/day. Protects liver, supports ALDH enzyme, antagonizes copper and mercury." });
      }
    }
    if (labs.hair_molybdenum !== null) {
      const s = status(labs.hair_molybdenum, 0.004, 999);
      findings.push({ marker: "Hair Mo", value: labs.hair_molybdenum, unit: "", status: s === "low" ? "low" : "optimal", interpretation: s === "low" ? "Below 0.004 — deficiency impairs ALDH and aldehyde oxidase enzymes." : "Above deficiency threshold (0.004)." });
      if (s === "low") {
        doses.push({ supplement: "Molybdenum glycinate", dose: "150mcg/day", instructions: "Big Minerals rule: reduce or stop if negative reactions within 3-7 days." });
        actions.push({ priority: "action", title: "Address molybdenum deficiency", body: "Deficiency impairs ALDH enzyme pathway. Signs include sensitivity to alcohol, wine, caffeine, or sulfur foods." });
      }
    }
    const toxics = labs.hair_toxics || {};
    const toxicFlags = [];
    if (toxics.mercury > 0.05) toxicFlags.push("Mercury elevated — remove amalgam fillings via IAOMT dentist only. Minimize fish intake.");
    if (toxics.lead > 0.15) toxicFlags.push("Lead elevated — identify environmental sources.");
    if (toxics.cadmium > 0.05) toxicFlags.push("Cadmium elevated — common from cigarette smoke.");
    if (toxics.arsenic > 0.06) toxicFlags.push("Arsenic elevated — check drinking water.");
    if (toxics.aluminum > 3.0) toxicFlags.push("Aluminum elevated — eliminate aluminum cookware.");
    if (toxics.uranium > 0.01) toxicFlags.push("Uranium elevated — check well water.");
    if (toxicFlags.length > 0) {
      findings.push({ marker: "Toxic elements", value: "Elevated", unit: "", status: "high", interpretation: toxicFlags.join(" ") });
      actions.unshift({ priority: "urgent", title: "Toxic element burden detected", body: toxicFlags.join("\n") });
    }
    const fixFirst = [];
    if (p.flag_mercury_fillings) fixFirst.push("Mercury fillings present — use IAOMT-trained dentist for removal (iaomt.org).");
    if (p.flag_mold_exposure) fixFirst.push("Mold exposure flagged — eliminate source before detoxing.");
    if (p.flag_copper_pipes) fixFirst.push("Copper pipes flagged — install RO filtration.");
    if (p.flag_low_protein) fixFirst.push("Low protein flagged — minimum 50g/day from all sources.");
    if (fixFirst.length > 0) actions.unshift({ priority: "urgent", title: "Fix These FIRST — blocking recovery", body: fixFirst.join("\n") });
    if (sex === "female" && p.flag_hormonal_issues) {
      actions.push({ priority: "action", title: "Women's hormonal support", body: "Consider vitamin K2 MK-4 (3-5mg/day) for heavy bleeding. Topical magnesium for cramps. Start probiotics with Lactobacillus first." });
    }

    const { data: rec, error: recError } = await supabaseAdmin.from("recommendations").insert({
      user_id: user.id, lab_result_id, findings, priority_actions: actions, supplement_doses: doses, engine_version: "1.2"
    }).select().single();
    if (recError) throw new Error("Failed to store recommendation: " + recError.message);

    return new Response(JSON.stringify({ success: true, recommendation: rec }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
