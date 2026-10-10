// scripts/seed.ts — Demo seed data (Person B).
//
// Inserts 1 demo class, 8 demo students, 2 original topics, and 30 simulated
// evaluations. Idempotent: if the demo class already exists it reports counts
// and exits without inserting or deleting anything.
//
// Run from the project root:  npm run db:seed   (or  node scripts/seed.ts)
//
// Student PINs are scrypt-hashed and never stored in plaintext. The demo PIN
// rule is intentionally simple (see the run report / README); it is not
// printed here or persisted anywhere.

import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Load .env.local exactly as Next.js does, BEFORE importing src/lib/db.ts
// (which captures MONGODB_URI at module-load time).
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
loadEnvConfig(projectRoot, true);

// Import the existing helpers AFTER env is loaded (dynamic import).
const { getDb, newId, ensureIndexes } = await import("../src/lib/db.ts");
const { hashPin } = await import("../src/lib/auth/password.ts");

import type {
  Concept,
  Conversation,
  Evaluation,
  Material,
  RubricItem,
  SchoolClass,
  Student,
  Teacher,
  Turn,
  WrongIdea,
} from "../src/lib/types.ts";

const CLASS_CODE = "RAIN7";
const ALIASES = [
  "Aarav",
  "Diya",
  "Rohan",
  "Priya",
  "Arjun",
  "Meera",
  "Kabir",
  "Anaya",
];

type Level = "primary" | "secondary";
type EvalStatus = "understood" | "shaky" | "not_yet";

interface ConceptDef {
  title: string;
  level: Level;
  notes: string;
  rubric: RubricItem[];
  wrongIdeas: WrongIdea[];
}

// ---- Original, self-written educational content (no copyrighted text) ----

const WATER_NOTES = `The water cycle is how water keeps moving around our Earth. The sun's heat warms lakes, rivers, and seas and turns some water into invisible vapour — this is evaporation. That vapour rises, cools high in the sky, and turns back into tiny drops that gather into clouds — this is condensation. When the drops grow heavy, they fall back down as rain or snow — this is precipitation. The fallen water collects again and the cycle starts over.`;

const NEWTON_NOTES = `Newton's third law says that forces always come in pairs. Whenever one object pushes or pulls on another, the second object pushes or pulls back with a force of the same size in the opposite direction. We call one the action and the other the reaction. The important point is that the two forces act on different objects, so they never cancel each other out — that is why a swimmer pushes water backwards and moves forwards.`;

const CONCEPT_DEFS: ConceptDef[] = [
  {
    title: "The Water Cycle",
    level: "primary",
    notes: WATER_NOTES,
    rubric: [
      { point: "Water keeps moving between the land, the sea, and the sky — it is never really lost." },
      { point: "The sun's heat changes liquid water into vapour (evaporation)." },
      { point: "Cooling high in the sky turns vapour back into tiny drops that form clouds (condensation)." },
      { point: "Heavy clouds release the water back down as rain or snow (precipitation)." },
    ],
    wrongIdeas: [
      { label: "Clouds are made of smoke", description: "Believes clouds are smoke or cotton wool rather than tiny drops of water." },
      { label: "Rain is brand-new water", description: "Thinks rain creates new water instead of being the same water cycling around." },
      { label: "Water only evaporates when it boils", description: "Thinks evaporation happens only at boiling, not slowly from puddles and rivers." },
    ],
  },
  {
    title: "Newton's Third Law of Motion",
    level: "secondary",
    notes: NEWTON_NOTES,
    rubric: [
      { point: "Forces always come in pairs: every action has an equal reaction." },
      { point: "The two forces are equal in size and opposite in direction." },
      { point: "The two forces act on different objects, so they do not cancel out." },
      { point: "Action and reaction happen at the same time." },
    ],
    wrongIdeas: [
      { label: "Action and reaction cancel out", description: "Thinks the two equal, opposite forces cancel, forgetting they act on different bodies." },
      { label: "The heavier object pushes harder", description: "Believes the heavier object exerts the bigger force in the pair." },
      { label: "The reaction comes later", description: "Thinks the reaction force happens a moment after the action." },
    ],
  },
];

const REASONS: Record<Level, Record<EvalStatus, string[]>> = {
  primary: {
    understood: [
      "Explained evaporation, condensation, and precipitation in the right order.",
      "Used their own words to describe how water moves around and comes back.",
      "Named all three steps and said clearly where each one happens.",
    ],
    shaky: [
      "Knew the steps but put condensation before evaporation.",
      "Said clouds are smoke, then corrected halfway through.",
      "Described rain but could not say how the vapour gets back up.",
    ],
    not_yet: [
      "Insisted rain is brand-new water each time it falls.",
      "Could not say what the sun's heat does to water.",
      "Repeated the three big words without connecting them.",
    ],
  },
  secondary: {
    understood: [
      "Explained that the forces act on different bodies so they do not cancel.",
      "Used the swimmer example correctly to show action and reaction.",
      "Stated equal and opposite, and gave a correct everyday example.",
    ],
    shaky: [
      "Said the two forces cancel out because they are equal.",
      "Thought the heavier object pushes with a bigger force.",
      "Knew 'equal and opposite' but could not name the two objects involved.",
    ],
    not_yet: [
      "Believed action and reaction happen one after the other.",
      "Could not give a single example of the third law.",
      "Repeated the textbook line with no understanding of 'different bodies'.",
    ],
  },
};

const GAP_NOTES: Record<Level, string> = {
  primary: "May need to revisit states of matter and heating/cooling first.",
  secondary: "May need to revisit what a force is and how to name the objects involved.",
};

function confidenceFor(status: EvalStatus, j: number): number {
  if (status === "understood") return 82 + (j % 14); // 82–95
  if (status === "shaky") return 52 + (j % 16); // 52–67
  return 24 + (j % 18); // 24–41
}

function reasonFor(level: Level, status: EvalStatus, j: number): string {
  const pool = REASONS[level][status];
  return pool[j % pool.length];
}

function studentAnswer(level: Level, status: EvalStatus): string {
  if (level === "primary") {
    if (status === "understood")
      return "The sun heats the water, it turns into vapour, rises, and cools into tiny drops that form a cloud.";
    if (status === "shaky")
      return "Water boils and goes up, then turns into smoke inside the cloud, I think.";
    return "Rain is just new water that falls from the sky. I am not sure how it gets up there.";
  }
  if (status === "understood")
    return "The wall pushes back with an equal force but on me, so the two forces act on different objects and do not cancel.";
  if (status === "shaky")
    return "The wall pushes back harder than me, so I stay still because they cancel out.";
  return "The wall does not move, so it does not push back at all.";
}

function makeTurns(level: Level, status: EvalStatus, j: number): Turn[] {
  const base = Date.now() - 1000 * 60 * (j + 1);
  if (level === "primary") {
    return [
      { role: "junior", text: "I forgot — where does the water in a cloud come from?", at: new Date(base) },
      { role: "student", text: studentAnswer(level, status), at: new Date(base + 20_000) },
      { role: "junior", text: "And what makes the water rise up into the sky in the first place?", at: new Date(base + 40_000) },
    ];
  }
  return [
    { role: "junior", text: "If I push a wall, does the wall push back? Why don't I fall over?", at: new Date(base) },
    { role: "student", text: studentAnswer(level, status), at: new Date(base + 20_000) },
    { role: "junior", text: "If the two forces are equal, why don't they cancel each other out?", at: new Date(base + 40_000) },
  ];
}

async function main(): Promise<void> {
  const db = await getDb();
  await ensureIndexes();

  // Idempotency: skip if the demo class already exists.
  const existingClass = await db.collection("classes").findOne({ classCode: CLASS_CODE });
  if (existingClass) {
    const counts = {
      teachers: await db.collection("teachers").countDocuments(),
      classes: await db.collection("classes").countDocuments(),
      students: await db.collection("students").countDocuments(),
      materials: await db.collection("materials").countDocuments(),
      concepts: await db.collection("concepts").countDocuments(),
      conversations: await db.collection("conversations").countDocuments(),
      evaluations: await db.collection("evaluations").countDocuments({ isSimulated: true }),
    };
    console.log("Seed already present — skipping (nothing inserted or deleted).");
    console.log("Existing counts:", JSON.stringify(counts));
    return;
  }

  const now = new Date();

  // 1. Teacher (placeholder Clerk identity; link to a real Clerk user later).
  const teacher: Teacher = {
    id: newId(),
    clerkUserId: "demo-teacher-clerk-id",
    email: "demo.teacher@example.invalid",
    name: "Demo Teacher",
    createdAt: now,
  };
  await db.collection("teachers").insertOne(teacher);

  // 2. Demo class.
  const schoolClass: SchoolClass = {
    id: newId(),
    teacherId: teacher.id,
    name: "Class 7 — Demo School (Simulated)",
    grade: 7,
    classCode: CLASS_CODE,
    defaultLanguage: "en",
    createdAt: now,
  };
  await db.collection("classes").insertOne(schoolClass);

  // 3. Students (8). PINs are scrypt-hashed; plaintext is never persisted.
  const students: Student[] = [];
  for (let roll = 1; roll <= 8; roll++) {
    const pin = String(1000 + roll); // demo PIN rule (documented in run report)
    students.push({
      id: newId(),
      classId: schoolClass.id,
      rollNumber: roll,
      alias: ALIASES[roll - 1],
      pinHash: await hashPin(pin),
      active: true,
      isSimulated: true,
      createdAt: now,
    });
  }
  await db.collection("students").insertMany(students);

  // 4. Materials + Concepts (2 original topics).
  const concepts: Concept[] = [];
  for (const def of CONCEPT_DEFS) {
    const material: Material = {
      id: newId(),
      classId: schoolClass.id,
      teacherId: teacher.id,
      label: "taught",
      sourceType: "text",
      rawText: def.notes,
      confirmedText: def.notes,
      status: "confirmed",
      createdAt: now,
      confirmedAt: now,
    };
    await db.collection("materials").insertOne(material);

    const concept: Concept = {
      id: newId(),
      classId: schoolClass.id,
      materialId: material.id,
      title: def.title,
      level: def.level,
      language: "en",
      rubric: def.rubric,
      wrongIdeas: def.wrongIdeas,
      prereqConceptId: null,
      status: "approved",
      approvedAt: now,
      createdAt: now,
    };
    await db.collection("concepts").insertOne(concept);
    concepts.push(concept);
  }

  // 5. Conversations + Evaluations (30, all isSimulated).
  const STATUS_CYCLE: EvalStatus[] = ["understood", "shaky", "not_yet", "understood", "shaky"];
  const conversations: Conversation[] = [];
  const evaluations: Evaluation[] = [];

  for (let i = 0; i < 30; i++) {
    const concept = concepts[i < 15 ? 0 : 1]; // 15 water + 15 newton
    const level = CONCEPT_DEFS[i < 15 ? 0 : 1].level;
    const j = i % 15;
    const student = students[j % 8];
    const status = STATUS_CYCLE[j % STATUS_CYCLE.length];
    const turns = makeTurns(level, status, j);

    const conversation: Conversation = {
      id: newId(),
      conceptId: concept.id,
      studentId: student.id,
      language: "en",
      level: concept.level,
      turns,
      turnCount: turns.length,
      status: "done",
      endedReason: "completed",
      createdAt: new Date(now.getTime() - 1000 * 60 * (j + 1)),
      endedAt: new Date(now.getTime() - 1000 * 60 * j),
    };
    conversations.push(conversation);

    evaluations.push({
      id: newId(),
      conversationId: conversation.id,
      conceptId: concept.id,
      studentId: student.id,
      status,
      reason: reasonFor(level, status, j),
      confidence: confidenceFor(status, j),
      misconceptionTag:
        status === "understood" ? null : concept.wrongIdeas[j % concept.wrongIdeas.length].label,
      prereqGapNote: status === "not_yet" ? GAP_NOTES[level] : null,
      source: "ai",
      originalStatus: null,
      overriddenBy: null,
      overrideReason: null,
      isSimulated: true,
      createdAt: now,
    });
  }

  await db.collection("conversations").insertMany(conversations);
  await db.collection("evaluations").insertMany(evaluations);

  // 6. Verify + report.
  const evalDocs = await db.collection("evaluations").find({ isSimulated: true }).toArray();
  const convIds = [...new Set(evalDocs.map((e) => String(e.conversationId)))];
  const conceptIds = [...new Set(evalDocs.map((e) => String(e.conceptId)))];
  const studentIds = [...new Set(evalDocs.map((e) => String(e.studentId)))];

  const convRef = await db.collection("conversations").countDocuments({ id: { $in: convIds } });
  const conceptRef = await db.collection("concepts").countDocuments({ id: { $in: conceptIds } });
  const studentRef = await db.collection("students").countDocuments({ id: { $in: studentIds } });

  const studentDocs = await db.collection("students").find().toArray();
  const allHashed = studentDocs.every(
    (s) => typeof s.pinHash === "string" && s.pinHash.startsWith("scrypt:16384:8:1:"),
  );

  const statusCounts: Record<string, number> = {};
  for (const e of evalDocs) {
    const k = String(e.status);
    statusCounts[k] = (statusCounts[k] ?? 0) + 1;
  }

  console.log("Seed complete.");
  console.log("Demo class code:", CLASS_CODE);
  console.log(
    "Counts:",
    JSON.stringify({
      teachers: 1,
      classes: 1,
      students: students.length,
      materials: CONCEPT_DEFS.length,
      concepts: concepts.length,
      conversations: conversations.length,
      evaluations: evaluations.length,
    }),
  );
  console.log("Verification:");
  console.log("  evaluations -> conversations referenced:", convRef, "/", convIds.length);
  console.log("  evaluations -> concepts referenced:", conceptRef, "/", conceptIds.length);
  console.log("  evaluations -> students referenced:", studentRef, "/", studentIds.length);
  console.log("  all student PINs scrypt-hashed (no plaintext):", allHashed);
  console.log("  evaluations by status:", JSON.stringify(statusCounts));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err && err.name ? err.name : "unknown error");
    process.exit(1);
  });




