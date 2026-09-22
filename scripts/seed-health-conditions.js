import "dotenv/config";
import { connectDB, closeDB } from "../config/db.js";
import HealthCondition from "../models/health-condition.model.js";

const conditions = [
  {
    name: "Gestational Diabetes",
    slug: "gestational-diabetes",
    description: "Pregnancy health assessment for gestational diabetes risk factors.",
    category: "pregnancy_health",
    active: true,
    sort_order: 1,
    assessment: {
      enabled: true,
      title: "Gestational Diabetes Assessment",
      description: "Assessment questions shown in the approved pregnancy health flow.",
      questions: [
        { key: "previous_gestational_diabetes", prompt: "Have you previously had gestational diabetes?", type: "boolean", required: true, sort_order: 1 },
        { key: "previous_baby_over_4_1kg", prompt: "Have you previously delivered a baby weighing more than 4.1 kg?", type: "boolean", required: true, sort_order: 2 },
        { key: "family_history_of_diabetes", prompt: "Do you have a family history of diabetes?", type: "boolean", required: true, sort_order: 3 },
        { key: "previous_prediabetes", prompt: "Have you previously been told that you had pre-diabetes?", type: "boolean", required: true, sort_order: 4 },
        { key: "persistent_uti_or_vaginal_infections", prompt: "Have you had persistent urinary tract infections or vaginal infections?", type: "boolean", required: true, sort_order: 5 },
        { key: "excessive_tiredness", prompt: "Have you experienced excessive tiredness?", type: "boolean", required: true, sort_order: 6 },
        { key: "physical_activity_frequency", prompt: "How frequently do you engage in physical activity?", type: "text", required: true, sort_order: 7 },
      ],
    },
    recommendation_keys: [],
  },
  {
    name: "High Blood Pressure",
    slug: "high-blood-pressure",
    description: "Pregnancy health assessment for high blood pressure warning signs.",
    category: "pregnancy_health",
    active: true,
    sort_order: 2,
    assessment: {
      enabled: true,
      title: "High Blood Pressure Assessment",
      description: "Assessment questions shown in the approved pregnancy health flow.",
      questions: [
        { key: "persistent_or_severe_headaches", prompt: "Have you experienced persistent or severe headaches?", type: "boolean", required: true, sort_order: 1 },
        { key: "swelling_or_edema", prompt: "Have you experienced swelling or edema?", type: "boolean", required: true, sort_order: 2 },
        { key: "severe_nausea_or_vomiting", prompt: "Have you experienced severe nausea or vomiting?", type: "boolean", required: true, sort_order: 3 },
      ],
    },
    recommendation_keys: [],
  },
  {
    name: "Venous Thromboembolism",
    slug: "venous-thromboembolism",
    description: "Pregnancy health assessment for venous thromboembolism risk factors.",
    category: "pregnancy_health",
    active: true,
    sort_order: 3,
    assessment: {
      enabled: true,
      title: "Venous Thromboembolism Assessment",
      description: "Assessment questions shown in the approved pregnancy health flow.",
      questions: [
        { key: "previous_blood_clots", prompt: "Have you previously had blood clots?", type: "boolean", required: true, sort_order: 1 },
        { key: "previous_births", prompt: "How many births have you previously had?", type: "number", required: true, sort_order: 2 },
        { key: "prolonged_immobility_or_bed_rest", prompt: "Have you experienced prolonged immobility or bed rest?", type: "boolean", required: true, sort_order: 3 },
        { key: "severe_infection", prompt: "Have you experienced a severe infection?", type: "boolean", required: true, sort_order: 4 },
        { key: "previous_or_recent_heart_failure", prompt: "Have you previously had or recently experienced heart failure?", type: "boolean", required: true, sort_order: 5 },
        { key: "edema", prompt: "Have you experienced edema?", type: "boolean", required: true, sort_order: 6 },
        { key: "family_history_of_vte", prompt: "Do you have a family history of venous thromboembolism?", type: "boolean", required: true, sort_order: 7 },
      ],
    },
    recommendation_keys: [],
  },
  {
    name: "Anxiety & Depression",
    slug: "anxiety-depression",
    description: "Pregnancy health assessment covering emotional wellbeing and support factors.",
    category: "pregnancy_health",
    active: true,
    sort_order: 4,
    assessment: {
      enabled: true,
      title: "Anxiety & Depression Assessment",
      description: "Assessment questions shown in the approved pregnancy health flow.",
      questions: [
        { key: "challenging_or_loss_experiences", prompt: "Have you experienced challenging or loss-related experiences?", type: "boolean", required: true, sort_order: 1 },
        { key: "feelings_about_pregnancy", prompt: "How do you feel about your pregnancy?", type: "text", required: true, sort_order: 2 },
        { key: "partner_support", prompt: "Do you feel supported by your partner?", type: "boolean", required: true, sort_order: 3 },
        { key: "family_or_friend_support", prompt: "Do you feel supported by family or friends?", type: "boolean", required: true, sort_order: 4 },
        { key: "previous_anxiety_depression_panic_treatment", prompt: "Have you previously received treatment for anxiety, depression, or panic?", type: "boolean", required: true, sort_order: 5 },
        { key: "violence_or_threats_at_home", prompt: "Have you experienced violence or threats at home?", type: "boolean", required: true, sort_order: 6 },
        { key: "fear_of_pregnancy_loss", prompt: "Do you have fears related to miscarriage, stillbirth, or child loss?", type: "boolean", required: true, sort_order: 7 },
      ],
    },
    recommendation_keys: [],
  },
];

try {
  await connectDB();

  for (const condition of conditions) {
    await HealthCondition.updateOne(
      { slug: condition.slug },
      { $set: condition },
      { upsert: true }
    );
  }

  console.log(`Health condition catalogue ready: ${conditions.length} default conditions configured.`);
} catch (error) {
  console.error("Failed to seed health conditions:", error.message);
  process.exitCode = 1;
} finally {
  await closeDB();
}
