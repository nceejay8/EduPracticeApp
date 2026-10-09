// UACE-style multi-part practice scenarios
// Drawn from real past papers (S.6 Physics Paper 1, UACE Math Paper 2 2026 pre-registration)
// Each scenario = one full exam question with mark scheme.

import { normalizeSubject, resolveContentRef, getTopic } from './syllabus';
import { getPublishedScenarios } from './publishedScenarios';

// ─── LocalStorage helpers ──────────────────────────────────────────────────
const CUSTOM_KEY       = 'eduPractice_customScenarios';
const CUSTOM_MOCKS_KEY = 'eduPractice_customMockExams';

export function getCustomScenarios() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); }
  catch { return []; }
}
export function saveCustomScenario(scenario) {
  const list = getCustomScenarios();
  const idx  = list.findIndex(s => s.id === scenario.id);
  if (idx >= 0) list[idx] = scenario; else list.push(scenario);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}
export function deleteCustomScenario(id) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(getCustomScenarios().filter(s => s.id !== id)));
}

export function getCustomMockExams() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_MOCKS_KEY) || '[]'); }
  catch { return []; }
}
export function saveCustomMockExam(exam) {
  const list = getCustomMockExams();
  const idx  = list.findIndex(e => e.id === exam.id);
  if (idx >= 0) list[idx] = exam; else list.push(exam);
  localStorage.setItem(CUSTOM_MOCKS_KEY, JSON.stringify(list));
}
export function deleteCustomMockExam(id) {
  localStorage.setItem(CUSTOM_MOCKS_KEY, JSON.stringify(getCustomMockExams().filter(e => e.id !== id)));
}

// ─── Seeded daily picker ───────────────────────────────────────────────────
// Every scenario available to a student: the 19 hand-authored ones, anything
// created in /admin on this device, and anything the daily generator has published.
//
// Published questions are last so that a scenario id can never collide with a
// built-in and quietly shadow it; the generator namespaces its ids, and this
// ordering means the hand-written content wins if that ever breaks.
function allScenarios() {
  return [...PRACTICE_SCENARIOS, ...getCustomScenarios(), ...getPublishedScenarios()];
}

// Picks a deterministic scenario per (topic, day) so the question changes
// daily but stays stable within a single session.
export function pickScenarioForTopic(subject, topicName) {
  const all     = allScenarios();
  const matches = all.filter(s =>
    s.subject === subject &&
    (s.topic === topicName || (s.topics && s.topics.includes(topicName)))
  );
  const pool = matches.length > 0
    ? matches
    : all.filter(s => s.subject === subject);
  if (pool.length === 0) return null;
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed   = (dayKey + topicName).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xFFFFFF, 0);
  return pool[seed % pool.length];
}

// Picks the scenarios that belong to one canonical topic.
//
// This asks `resolveContentRef` — the same attribution rule the progress engine
// uses in syllabusProgress.js — rather than comparing topic strings itself. That
// matters: a scenario tagged ['Modern Physics', 'Quantum Mechanics'] is
// *specifically* about quantum mechanics, so it must not be served for the
// sibling topics in Modern Physics, and must not be counted towards them either.
// If the picker and the coverage map disagreed on that, the outline would
// promise material the workboard could not deliver.
function scenariosForCanonicalTopic(subjectId, topicId) {
  const subject = normalizeSubject(subjectId);
  const found = getTopic(subjectId, topicId);
  if (!subject || !found) return [];

  const all = allScenarios()
    .filter(s => normalizeSubject(s.subject) === subject);

  // 1. Scenarios that resolve to this exact topic (or one of its subtopics).
  const exact = all.filter(s => {
    const ref = resolveContentRef(subject, s.topic, s.topics);
    return ref && (ref.level === 'topic' || ref.level === 'subtopic') && ref.topicId === topicId;
  });
  if (exact.length > 0) return exact;

  // 2. Otherwise a scenario that resolves to the parent *chapter* and nothing
  //    more specific. Chapter-wide material is genuinely usable for any topic in
  //    that chapter, which is why the coverage map credits it to each of them.
  const chapterId = found.chapter.id;
  return all.filter(s => {
    const ref = resolveContentRef(subject, s.topic, s.topics);
    return ref && ref.level === 'chapter' && ref.chapterId === chapterId;
  });
}

// Deterministic daily pick: the question changes day to day but is stable within
// a session, so "continue where you left off" is not undone by a re-render.
function seededPick(pool, seedKey) {
  if (pool.length === 0) return null;
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = (dayKey + seedKey).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xFFFFFF, 0);
  return pool[seed % pool.length];
}

export function pickScenarioForSyllabusTopic(subjectId, topicId) {
  return seededPick(scenariosForCanonicalTopic(subjectId, topicId), topicId);
}

// Every scenario that belongs to a canonical topic, for the syllabus page's
// "what's available here" count. Mirrors pickScenarioForSyllabusTopic exactly,
// so the count shown on /syllabus is the count the workboard can actually serve.
export function getScenariosForSyllabusTopic(subjectId, topicId) {
  return scenariosForCanonicalTopic(subjectId, topicId);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICS SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────
const physicsScenarios = [

  // ── Q1: Archimedes / Fluid Mechanics ──────────────────────────────────────
  {
    id: 'phy-fluid-001',
    subject: 'physics',
    topic: 'Classical Mechanics',
    topics: ['Classical Mechanics', 'Fluid Mechanics'],
    level: 'A-Level',
    difficulty: 3,
    source: 'UACE Past Paper — Standard High School Zzana, Physics P510/1',
    totalMarks: 19,
    stem: `A solid body is weighed in air and found to have a mass of 237.5 g. When the solid is totally immersed in a fluid of density 900 kg m⁻³, its apparent weight corresponds to a mass of only 12.5 g (i.e. the fluid exerts an upthrust on it). The solid is then transferred to a second, unknown liquid in which it floats with exactly one fifth (1/5) of its volume exposed above the surface.`,
    parts: [
      {
        label: 'a(i)',
        text: 'State Archimedes\' principle.',
        marks: 1,
      },
      {
        label: 'a(ii)',
        text: 'Describe an experiment you would carry out in the laboratory to determine the relative density of an irregular solid that floats in water. State clearly what measurements you would take and how you would use them.',
        marks: 3,
      },
      {
        label: 'b',
        text: 'Using the data given in the stem, calculate the density of the unknown liquid in which the solid floats with one fifth of its volume exposed. Show all working clearly.',
        marks: 6,
      },
      {
        label: 'c(i)',
        text: 'What is meant by the viscosity of a fluid?',
        marks: 1,
      },
      {
        label: 'c(ii)',
        text: 'Explain, using ideas about molecular forces, how and why the viscosity of a liquid changes when it is heated.',
        marks: 3,
      },
      {
        label: 'd',
        text: 'A bullet of mass 100 g moving horizontally at 420 m s⁻¹ strikes a wooden block of mass 2 000 g that is initially at rest on a smooth horizontal table. The bullet becomes embedded in the block and they move on together. State any principle you use, then calculate the kinetic energy lost in the collision.',
        marks: 5,
      },
    ],
    markScheme: [
      { criterion: 'a(i): "When a body is wholly or partially immersed in a fluid, it experiences an upthrust equal to the weight of the fluid displaced." (both parts required)', marks: 1, max: 1 },
      { criterion: 'a(ii): Weigh solid in air — record W_air', marks: 1, max: 1 },
      { criterion: 'a(ii): Attach sinker, weigh solid+sinker fully immersed — record W_sinker+solid', marks: 1, max: 1 },
      { criterion: 'a(ii): Relative density = W_air / (W_air − W_water). Conclusion stated.', marks: 1, max: 1 },
      { criterion: 'b: Upthrust in first fluid = (237.5 − 12.5) × 10⁻³ × 9.81 = 2.205 N', marks: 1, max: 1 },
      { criterion: 'b: Volume of solid V = upthrust / (ρ_fluid × g) = 2.205 / (900 × 9.81) = 2.5 × 10⁻⁴ m³', marks: 2, max: 2 },
      { criterion: 'b: Volume submerged in second liquid = 4/5 × V = 2.0 × 10⁻⁴ m³', marks: 1, max: 1 },
      { criterion: 'b: At flotation, weight = upthrust: 237.5 × 10⁻³ × g = ρ_L × (4V/5) × g', marks: 1, max: 1 },
      { criterion: 'b: ρ_L = 237.5 × 10⁻³ / (2.0 × 10⁻⁴) = 1 187.5 kg m⁻³ (accept 1 188 kg m⁻³)', marks: 1, max: 1 },
      { criterion: 'c(i): Viscosity is the property of a fluid that resists relative motion between its layers (internal friction).', marks: 1, max: 1 },
      { criterion: 'c(ii): Heating increases molecular kinetic energy / reduces intermolecular forces', marks: 1, max: 1 },
      { criterion: 'c(ii): Layers slide more easily past each other → resistance to flow decreases', marks: 1, max: 1 },
      { criterion: 'c(ii): Therefore viscosity decreases with temperature for a liquid (contrast with gases)', marks: 1, max: 1 },
      { criterion: 'd: States conservation of momentum explicitly', marks: 1, max: 1 },
      { criterion: 'd: v = (m₁u₁)/(m₁+m₂) = (0.1 × 420)/(2.1) = 20 m s⁻¹', marks: 2, max: 2 },
      { criterion: 'd: KE_lost = ½m₁u₁² − ½(m₁+m₂)v² = ½(0.1)(420²) − ½(2.1)(20²) = 8 820 − 420 = 8 400 J', marks: 2, max: 2 },
    ],
  },

  // ── Q2: Friction / Surface Tension ────────────────────────────────────────
  {
    id: 'phy-friction-001',
    subject: 'physics',
    topic: 'Classical Mechanics',
    topics: ['Classical Mechanics'],
    level: 'A-Level',
    difficulty: 2,
    source: 'UACE Past Paper — Standard High School Zzana, Physics P510/1',
    totalMarks: 20,
    stem: `This question covers centre of gravity, laws of solid friction, surface tension, and the behaviour of rain drops falling through air. Use your knowledge of molecular physics to support your answers.`,
    parts: [
      {
        label: 'a(i)',
        text: 'Define the centre of gravity of a body.',
        marks: 1,
      },
      {
        label: 'a(ii)',
        text: 'Describe an experiment to find the centre of gravity of an irregular flat piece of card board.',
        marks: 3,
      },
      {
        label: 'b',
        text: 'Using the molecular theory of matter, explain the laws of solid friction. Your answer should address: (i) friction being independent of apparent area of contact, (ii) friction being proportional to normal reaction, and (iii) static friction being greater than kinetic friction.',
        marks: 7,
      },
      {
        label: 'c(i)',
        text: 'Define surface tension.',
        marks: 1,
      },
      {
        label: 'c(ii)',
        text: 'Explain the molecular origin of surface tension.',
        marks: 3,
      },
      {
        label: 'd',
        text: 'Rain drops fall from clouds that can be several kilometres above the ground. Using ideas about drag forces (air resistance) and terminal velocity, explain why rain drops hit the ground with less force than would be predicted by free-fall under gravity alone.',
        marks: 5,
      },
    ],
    markScheme: [
      { criterion: 'a(i): Point through which the resultant gravitational force on the body acts (for all orientations)', marks: 1, max: 1 },
      { criterion: 'a(ii): Hang card from pin, draw vertical plumb line', marks: 1, max: 1 },
      { criterion: 'a(ii): Repeat from different pin positions — at least two more', marks: 1, max: 1 },
      { criterion: 'a(ii): CoG is at intersection of the plumb lines', marks: 1, max: 1 },
      { criterion: 'b: Real contact area is tiny — at molecular level, surfaces touch only at high points (asperities)', marks: 2, max: 2 },
      { criterion: 'b: Larger normal force → more asperities in contact → same ratio → F ∝ N (law 2)', marks: 2, max: 2 },
      { criterion: 'b: Area of contact doesn\'t change nature of bonds, just number → law 1', marks: 1, max: 1 },
      { criterion: 'b: At rest, cold-welds form between surfaces; breaking these requires more force → static > kinetic (law 3)', marks: 2, max: 2 },
      { criterion: 'c(i): The force per unit length acting along the surface of a liquid, tending to minimise the surface area', marks: 1, max: 1 },
      { criterion: 'c(ii): Molecules in bulk are attracted equally in all directions (no net force)', marks: 1, max: 1 },
      { criterion: 'c(ii): Surface molecules have no neighbours above → net inward force / higher potential energy', marks: 1, max: 1 },
      { criterion: 'c(ii): Surface tries to contract to minimise area ↔ energy minimisation → surface tension', marks: 1, max: 1 },
      { criterion: 'd: As drop falls, drag force (upward) increases with speed', marks: 1, max: 1 },
      { criterion: 'd: Terminal velocity reached when drag = weight', marks: 1, max: 1 },
      { criterion: 'd: At terminal velocity, acceleration = 0 → falls at constant, limited speed', marks: 1, max: 1 },
      { criterion: 'd: Speed at impact (terminal) much less than free-fall speed → smaller momentum/force on impact', marks: 2, max: 2 },
    ],
  },

  // ── Q3: SHM — Spring-Mass System ──────────────────────────────────────────
  {
    id: 'phy-shm-001',
    subject: 'physics',
    topic: 'Classical Mechanics',
    topics: ['Classical Mechanics', 'Waves & Oscillations'],
    level: 'A-Level',
    difficulty: 3,
    source: 'UACE Past Paper — Standard High School Zzana, Physics P510/1',
    totalMarks: 20,
    stem: `A horizontal spring of force constant k = 300 N m⁻¹ is fixed at one end. A mass m = 3 kg is attached to the free end and rests on a smooth horizontal surface. The mass is pulled through a distance A = 5.0 cm from its equilibrium position and released from rest.`,
    parts: [
      {
        label: 'a(i)',
        text: 'What is meant by simple harmonic motion?',
        marks: 1,
      },
      {
        label: 'a(ii)',
        text: 'State four characteristics of simple harmonic motion.',
        marks: 2,
      },
      {
        label: 'b',
        text: 'A mass m is suspended by a string of length X. It is pulled aside so the string makes angle θ with the vertical, then released. Show that the mass executes simple harmonic motion and derive an expression for the period T in terms of X and g.',
        marks: 5,
      },
      {
        label: 'c(i)',
        text: 'For the spring-mass system described in the stem, calculate the angular speed (angular frequency) ω.',
        marks: 2,
      },
      {
        label: 'c(ii)',
        text: 'Calculate the maximum speed attained by the mass.',
        marks: 2,
      },
      {
        label: 'c(iii)',
        text: 'Calculate the magnitude of the acceleration of the mass when it is halfway between its initial position and the equilibrium position.',
        marks: 2,
      },
      {
        label: 'd(i)',
        text: 'What is meant by a couple in mechanics?',
        marks: 1,
      },
      {
        label: 'd(ii)',
        text: 'State the two conditions for the equilibrium of a system of coplanar forces.',
        marks: 2,
      },
      {
        label: 'e',
        text: 'A person standing close to a railway line is sometimes sucked towards the line when a fast-moving train passes. Use Bernoulli\'s principle to explain this observation.',
        marks: 3,
      },
    ],
    markScheme: [
      { criterion: 'a(i): Motion in which acceleration is directed towards a fixed point and proportional to displacement from that point', marks: 1, max: 1 },
      { criterion: 'a(ii): Any four correct — acceleration proportional to displacement; acceleration directed toward equilibrium; periodic/isochronous; restoring force exists; energy exchanges between KE and PE', marks: 2, max: 2 },
      { criterion: 'b: For small θ, net restoring force = −mg sin θ ≈ −mgθ (uses small angle approx)', marks: 1, max: 1 },
      { criterion: 'b: arc length x = Xθ → θ = x/X, so F = −mgx/X', marks: 1, max: 1 },
      { criterion: 'b: F = ma → a = −(g/X)x, which has form a = −ω²x (SHM shown)', marks: 1, max: 1 },
      { criterion: 'b: ω² = g/X → T = 2π/ω = 2π√(X/g)', marks: 2, max: 2 },
      { criterion: 'c(i): ω = √(k/m) = √(300/3) = √100 = 10 rad s⁻¹', marks: 2, max: 2 },
      { criterion: 'c(ii): v_max = ωA = 10 × 0.05 = 0.5 m s⁻¹', marks: 2, max: 2 },
      { criterion: 'c(iii): Halfway to centre: displacement = A/2 = 2.5 cm = 0.025 m; a = ω²x = 100 × 0.025 = 2.5 m s⁻²', marks: 2, max: 2 },
      { criterion: 'd(i): A couple is a pair of equal, parallel, opposite forces whose lines of action do not coincide; it produces pure rotation', marks: 1, max: 1 },
      { criterion: 'd(ii): (1) Sum of all forces in any direction = 0 (translational equilibrium)', marks: 1, max: 1 },
      { criterion: 'd(ii): (2) Sum of moments about any point = 0 (rotational equilibrium)', marks: 1, max: 1 },
      { criterion: 'e: Fast-moving train → air between person and train moves rapidly', marks: 1, max: 1 },
      { criterion: 'e: Bernoulli: high speed → low pressure on train side; static air on far side has higher pressure', marks: 1, max: 1 },
      { criterion: 'e: Net pressure difference pushes / "sucks" person toward the track', marks: 1, max: 1 },
    ],
  },

  // ── Q4: Thermal Conductivity ───────────────────────────────────────────────
  {
    id: 'phy-thermal-001',
    subject: 'physics',
    topic: 'Classical Mechanics',
    topics: ['Thermal Physics', 'Heat Transfer'],
    level: 'A-Level',
    difficulty: 3,
    source: 'UACE Past Paper — Standard High School Zzana, Physics P510/1',
    totalMarks: 17,
    stem: `A double-glazed window consists of two glass sheets, each of thickness 5.0 mm, separated by a stagnant layer of air of thickness 1.2 mm. The two inner (air-facing) glass surfaces have steady temperatures of 25 °C and −5 °C respectively. The thermal conductivity of glass is 0.72 W m⁻¹ K⁻¹ and that of air is 0.025 W m⁻¹ K⁻¹.`,
    parts: [
      {
        label: 'a(i)',
        text: 'Define thermal conductivity.',
        marks: 1,
      },
      {
        label: 'a(ii)',
        text: 'Explain the mechanism by which heat is conducted through a metal.',
        marks: 3,
      },
      {
        label: 'b(i)',
        text: 'Using the data in the stem, find the temperatures of the two outer glass surfaces (the surfaces that face the inside and outside of the room).',
        marks: 3,
      },
      {
        label: 'b(ii)',
        text: 'Calculate the amount of heat that flows across an area of 3 m² of the window in 3 hours.',
        marks: 3,
      },
      {
        label: 'c(i)',
        text: 'What is a perfectly black body?',
        marks: 1,
      },
      {
        label: 'c(ii)',
        text: 'A spherical planet receives energy intensity 1.5 × 10³ W m⁻² from a star of radius 7.0 × 10⁵ km situated 1.4 × 10⁸ km away. Calculate the surface temperature of the star. (Stefan–Boltzmann constant σ = 5.67 × 10⁻⁸ W m⁻² K⁻⁴)',
        marks: 4,
      },
      {
        label: 'd',
        text: 'Explain the greenhouse effect and describe how it is related to global warming.',
        marks: 5,
      },
    ],
    markScheme: [
      { criterion: 'a(i): Rate of heat flow per unit area per unit temperature gradient (Q/t = kA ΔT/d)', marks: 1, max: 1 },
      { criterion: 'a(ii): Free electrons gain kinetic energy at hot end', marks: 1, max: 1 },
      { criterion: 'a(ii): Electrons diffuse/drift toward cooler regions and collide with lattice ions, transferring energy', marks: 1, max: 1 },
      { criterion: 'a(ii): Lattice vibrations (phonons) also contribute but electrons dominate in metals', marks: 1, max: 1 },
      { criterion: 'b(i): In series: rate of flow same through each layer; Q/tA = ΔT_total / Σ(d/k). Total thermal resistance R = 2×(0.005/0.72) + (0.0012/0.025)', marks: 1, max: 1 },
      { criterion: 'b(i): R = 0.01389 + 0.048 = 0.06189 m²KW⁻¹; Flux = (25−(−5))/0.06189 ≈ 484.7 W m⁻²', marks: 1, max: 1 },
      { criterion: 'b(i): Outer glass temps: inner surface + ΔT across glass = 25 − 484.7×0.00694 ≈ 21.6 °C (warm side) and −5 + 484.7×0.00694 ≈ −1.6 °C (cold side)', marks: 1, max: 1 },
      { criterion: 'b(ii): Q = flux × A × t = 484.7 × 3 × (3×3600)', marks: 1, max: 1 },
      { criterion: 'b(ii): Q = 484.7 × 3 × 10 800 ≈ 1.57 × 10⁷ J (accept 15–16 MJ)', marks: 2, max: 2 },
      { criterion: 'c(i): A body that absorbs all radiation incident on it and emits maximum possible radiation at every wavelength at a given temperature', marks: 1, max: 1 },
      { criterion: 'c(ii): Total power from star P = 4πR²σT⁴; intensity at planet I = P/(4πd²)', marks: 1, max: 1 },
      { criterion: 'c(ii): I = σT⁴ × (R/d)²; T⁴ = I × (d/R)² / σ', marks: 1, max: 1 },
      { criterion: 'c(ii): T⁴ = 1500 × (1.4×10¹¹/7×10⁸)² / 5.67×10⁻⁸ = 1500 × 4×10⁴ / 5.67×10⁻⁸', marks: 1, max: 1 },
      { criterion: 'c(ii): T ≈ 5 800 K (accept 5 700–5 900 K)', marks: 1, max: 1 },
      { criterion: 'd: Short-wave solar radiation passes through atmosphere (CO₂, H₂O transparent to visible)', marks: 1, max: 1 },
      { criterion: 'd: Earth absorbs and re-radiates as longer-wave (infra-red) radiation', marks: 1, max: 1 },
      { criterion: 'd: Greenhouse gases absorb/re-radiate IR, trapping energy — natural greenhouse effect', marks: 1, max: 1 },
      { criterion: 'd: Increased burning of fossil fuels raises CO₂ / other GHGs → more trapping → average temperature rises', marks: 1, max: 1 },
      { criterion: 'd: Consequences e.g. melting ice caps, sea level rise, extreme weather events', marks: 1, max: 1 },
    ],
  },

  // ── Q5: Calorimetry ────────────────────────────────────────────────────────
  {
    id: 'phy-calor-001',
    subject: 'physics',
    topic: 'Classical Mechanics',
    topics: ['Thermal Physics', 'Calorimetry'],
    level: 'A-Level',
    difficulty: 2,
    source: 'UACE Past Paper — Standard High School Zzana, Physics P510/1',
    totalMarks: 18,
    stem: `Steam at 100 °C is passed into a copper calorimeter of mass 150 g containing 340 g of water at 15 °C. The steam is condensed until the temperature of the calorimeter and its contents reaches 71 °C. At that point the combined mass of calorimeter and contents is measured to be 525 g. (Specific heat capacity of water = 4 200 J kg⁻¹ K⁻¹; Specific heat capacity of copper = 400 J kg⁻¹ K⁻¹)`,
    parts: [
      {
        label: 'a',
        text: 'Define the specific heat capacity of a substance.',
        marks: 1,
      },
      {
        label: 'b(i)',
        text: 'Describe an electrical method for the determination of the specific heat capacity of a metal. Include a labelled diagram, the measurements to be taken, and how the result is calculated.',
        marks: 6,
      },
      {
        label: 'b(ii)',
        text: 'State two assumptions made in the experiment you described in (b)(i).',
        marks: 2,
      },
      {
        label: 'c',
        text: 'Using the data provided in the stem, calculate the specific latent heat of vaporisation of water (steam to liquid at 100 °C). Show all working, including the mass of steam condensed.',
        marks: 6,
      },
      {
        label: 'd(i)',
        text: 'State two assumptions made in deriving the expression P = ⅓ρ⟨c²⟩ for the pressure of an ideal gas.',
        marks: 2,
      },
      {
        label: 'd(ii)',
        text: 'Use the kinetic theory expression to deduce Dalton\'s law of partial pressures.',
        marks: 3,
      },
    ],
    markScheme: [
      { criterion: 'a: Heat energy required to raise the temperature of 1 kg of a substance by 1 K (or 1 °C)', marks: 1, max: 1 },
      { criterion: 'b(i): Metal block with holes for heater and thermometer; diagram showing heater, thermometer, power supply, ammeter, voltmeter', marks: 2, max: 2 },
      { criterion: 'b(i): Measure mass m of block, record I and V, measure temperature rise ΔT over time t', marks: 2, max: 2 },
      { criterion: 'b(i): c = VIt / (mΔT); correct formula stated', marks: 2, max: 2 },
      { criterion: 'b(ii): Any 2 of: no heat loss to surroundings; constant current; specific heat capacity of heater/thermometer neglected; uniform temperature distribution in block', marks: 2, max: 2 },
      { criterion: 'c: Mass of steam condensed = 525 − (150 + 340) = 35 g = 0.035 kg', marks: 1, max: 1 },
      { criterion: 'c: Heat gained by water: Q_w = 0.340 × 4200 × (71−15) = 79 968 J', marks: 1, max: 1 },
      { criterion: 'c: Heat gained by calorimeter: Q_c = 0.150 × 400 × (71−15) = 3 360 J', marks: 1, max: 1 },
      { criterion: 'c: Total heat gained = 83 328 J', marks: 1, max: 1 },
      { criterion: 'c: Heat from steam = mL + m×c_w×(100−71) = 0.035L + 0.035×4200×29', marks: 1, max: 1 },
      { criterion: 'c: 0.035L + 4 263 = 83 328 → L = (79 065)/0.035 ≈ 2.26 × 10⁶ J kg⁻¹', marks: 1, max: 1 },
      { criterion: 'd(i): Any 2: gas consists of large number of identical molecules; molecules are perfectly elastic point masses; intermolecular forces only during collision; collisions are perfectly elastic; random molecular motion', marks: 2, max: 2 },
      { criterion: 'd(ii): For mixture of gases each species contributes P_i = ⅓ρᵢ⟨cᵢ²⟩ independently', marks: 1, max: 1 },
      { criterion: 'd(ii): Total pressure P = ΣPᵢ (molecules of different species don\'t interact)', marks: 1, max: 1 },
      { criterion: 'd(ii): This is Dalton\'s law: P_total = P₁ + P₂ + P₃ + ... (each partial pressure as if alone)', marks: 1, max: 1 },
    ],
  },

  // ── Q6: Nuclear Physics / Radioactivity ───────────────────────────────────
  {
    id: 'phy-nuclear-001',
    subject: 'physics',
    topic: 'Modern Physics',
    topics: ['Modern Physics', 'Nuclear Physics'],
    level: 'A-Level',
    difficulty: 3,
    source: 'UACE Past Paper — Standard High School Zzana, Physics P510/1',
    totalMarks: 20,
    stem: `This question deals with radioactive decay, nuclear transformations, and the properties of nuclear radiation. A freshly prepared radioactive sample of Uranium-238 is analysed. The decay constant λ of a certain radioisotope is 2.0 × 10⁻⁴ s⁻¹. Consider also a hospital that uses Iodine-131 (half-life 8 days) for thyroid treatment.`,
    parts: [
      {
        label: 'a(i)',
        text: 'Define the following terms as they apply to radioactivity: (α) radioactive decay, (β) half-life, (γ) decay constant.',
        marks: 3,
      },
      {
        label: 'a(ii)',
        text: 'Show that the half-life t₁/₂ of a radioisotope is related to the decay constant λ by: t₁/₂ = ln 2 / λ. Start from the fundamental decay law N = N₀ e^(−λt).',
        marks: 3,
      },
      {
        label: 'b',
        text: 'For the radioisotope with decay constant λ = 2.0 × 10⁻⁴ s⁻¹: (i) Calculate its half-life in seconds and in minutes. (ii) If the initial activity is 4.8 × 10⁶ Bq, calculate the activity after 1 hour.',
        marks: 5,
      },
      {
        label: 'c',
        text: 'A hospital receives a supply of Iodine-131 (t₁/₂ = 8 days) with an activity of 4.0 × 10⁸ Bq. The minimum activity required for a treatment is 5.0 × 10⁷ Bq. Calculate the number of complete days for which the supply remains usable.',
        marks: 4,
      },
      {
        label: 'd',
        text: 'Compare alpha (α), beta (β), and gamma (γ) radiation under the following headings: nature, charge, penetrating power, ionising ability.',
        marks: 5,
      },
    ],
    markScheme: [
      { criterion: 'a(i) decay: Spontaneous disintegration of an unstable nucleus with emission of radiation', marks: 1, max: 1 },
      { criterion: 'a(i) half-life: Time taken for half the radioactive nuclei in a sample to decay', marks: 1, max: 1 },
      { criterion: 'a(i) decay constant: Probability per unit time that a given nucleus will decay (or: λ = −(1/N)(dN/dt))', marks: 1, max: 1 },
      { criterion: 'a(ii): At t = t₁/₂, N = N₀/2 → N₀/2 = N₀ e^(−λt₁/₂)', marks: 1, max: 1 },
      { criterion: 'a(ii): ½ = e^(−λt₁/₂) → ln(½) = −λt₁/₂', marks: 1, max: 1 },
      { criterion: 'a(ii): t₁/₂ = ln 2 / λ  ✓', marks: 1, max: 1 },
      { criterion: 'b(i): t₁/₂ = ln2 / (2.0×10⁻⁴) = 3 466 s ≈ 57.8 minutes', marks: 2, max: 2 },
      { criterion: 'b(ii): t = 3 600 s; A = A₀ e^(−λt) = 4.8×10⁶ × e^(−0.72) = 4.8×10⁶ × 0.487 ≈ 2.34 × 10⁶ Bq', marks: 3, max: 3 },
      { criterion: 'c: A = A₀(½)^(t/8): 5×10⁷ = 4×10⁸ × (½)^(t/8)', marks: 1, max: 1 },
      { criterion: 'c: (½)^(t/8) = 0.125 = (½)³ → t/8 = 3 → t = 24 days', marks: 2, max: 2 },
      { criterion: 'c: Answer: 24 complete days', marks: 1, max: 1 },
      { criterion: 'd: α = helium nucleus (⁴₂He), charge +2, stopped by paper, highly ionising', marks: 1, max: 1 },
      { criterion: 'd: β = fast electron (or positron), charge −1 (or +1), stopped by a few mm Al, moderately ionising', marks: 1, max: 1 },
      { criterion: 'd: γ = electromagnetic radiation (photons), no charge, penetrates many cm Pb, weakly ionising', marks: 1, max: 1 },
      { criterion: 'd: Correct comparison of penetrating power order α < β < γ', marks: 1, max: 1 },
      { criterion: 'd: Correct comparison of ionising ability order α > β > γ', marks: 1, max: 1 },
    ],
  },

  // ── Q7: Uganda-context Optics ──────────────────────────────────────────────
  {
    id: 'phy-optics-001',
    subject: 'physics',
    topic: 'Optics',
    topics: ['Optics'],
    level: 'A-Level',
    difficulty: 2,
    source: 'Uganda-context applied question',
    totalMarks: 20,
    stem: `A fisherman on Lake Victoria looks at a fish below the surface of the water. The fish is at a depth of 1.2 m directly below him. The refractive index of water is 1.33. Separately, a solar cooker at a school in Gulu uses a concave mirror of focal length 0.40 m to focus sunlight onto a cooking pot.`,
    parts: [
      {
        label: 'a(i)',
        text: 'State Snell\'s law of refraction.',
        marks: 1,
      },
      {
        label: 'a(ii)',
        text: 'The fish is at a real depth of 1.2 m. Calculate the apparent depth of the fish as seen by the fisherman looking straight down.',
        marks: 3,
      },
      {
        label: 'a(iii)',
        text: 'Define the critical angle and derive an expression for it in terms of refractive index.',
        marks: 3,
      },
      {
        label: 'b(i)',
        text: 'A concave mirror has focal length f = 0.40 m. An object is placed 0.60 m from the mirror. Using the mirror formula, calculate the image distance and state whether the image is real or virtual.',
        marks: 4,
      },
      {
        label: 'b(ii)',
        text: 'Calculate the linear magnification produced by the mirror in (b)(i). If the object is 5 cm tall, find the height of the image.',
        marks: 3,
      },
      {
        label: 'c',
        text: 'Explain total internal reflection and give one practical application of it (other than optical fibres) relevant to Uganda\'s context (e.g. endoscopy in hospitals, reflective road signs).',
        marks: 3,
      },
      {
        label: 'd',
        text: 'A thin converging lens of focal length 25 cm is used as a magnifying glass. Calculate the angular magnification when the final image is formed at the near point (25 cm from the eye).',
        marks: 3,
      },
    ],
    markScheme: [
      { criterion: 'a(i): n₁ sin θ₁ = n₂ sin θ₂ (ratio of sines = ratio of refractive indices)', marks: 1, max: 1 },
      { criterion: 'a(ii): Apparent depth = Real depth / n = 1.2 / 1.33 = 0.902 m ≈ 0.90 m', marks: 3, max: 3 },
      { criterion: 'a(iii): Angle of incidence (in denser medium) at which refracted ray travels along boundary (θ_r = 90°)', marks: 1, max: 1 },
      { criterion: 'a(iii): n sin C = 1 × sin 90° → sin C = 1/n; C = sin⁻¹(1/n)', marks: 2, max: 2 },
      { criterion: 'b(i): 1/v = 1/f − 1/u = 1/0.4 − 1/0.6 = 2.5 − 1.667 = 0.833 → v = 1.2 m', marks: 3, max: 3 },
      { criterion: 'b(i): v positive (real, inverted image in front of mirror)', marks: 1, max: 1 },
      { criterion: 'b(ii): m = −v/u = −1.2/0.6 = −2; image height = 5 × 2 = 10 cm (inverted)', marks: 3, max: 3 },
      { criterion: 'c: TIR occurs when light travels from dense → less dense medium and angle of incidence > critical angle; reflected internally', marks: 2, max: 2 },
      { criterion: 'c: Valid Uganda application with brief explanation (road signs, surgical instruments, binoculars, etc.)', marks: 1, max: 1 },
      { criterion: 'd: M = 1 + D/f = 1 + 25/25 = 2× (image at near point formula)', marks: 3, max: 3 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MATHEMATICS SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────
const mathematicsScenarios = [

  // ── Item 1: Discrete Probability Distribution ──────────────────────────────
  {
    id: 'mat-prob-001',
    subject: 'mathematics',
    topic: 'Statistics & Probability',
    topics: ['Statistics & Probability', 'Pure Mathematics'],
    level: 'UACE',
    difficulty: 2,
    source: 'UACE Pre-Registration Examination 2026 — Mathematics P425/2, St Kizito SS Bugolobi',
    totalMarks: 15,
    stem: `A mobile network operator is analysing the number of mobile money transaction calls received daily at its Kampala call centre. The random variable Y represents the number of such calls. Based on past data, the probability distribution is partially known:

| Y    |  0   |  1   |  2   |  3   |  4   |
|------|------|------|------|------|------|
| P(Y) | 0.1  | 0.3  |  a   | 0.2  | 0.1  |

The company wants to define this distribution fully so it can staff the call centre appropriately.`,
    parts: [
      {
        label: 'a',
        text: 'Find the value of a, given that the probabilities must sum to 1.',
        marks: 2,
      },
      {
        label: 'b',
        text: 'Calculate the expected number of mobile-money-related calls per day, E(Y).',
        marks: 5,
      },
      {
        label: 'c',
        text: 'Calculate the variance Var(Y), and hence the standard deviation of Y.',
        marks: 8,
      },
    ],
    markScheme: [
      { criterion: 'a: Sum = 1: 0.1 + 0.3 + a + 0.2 + 0.1 = 1 → a = 0.3', marks: 2, max: 2 },
      { criterion: 'b: E(Y) = Σ y·P(y) = 0(0.1)+1(0.3)+2(0.3)+3(0.2)+4(0.1)', marks: 2, max: 2 },
      { criterion: 'b: = 0 + 0.3 + 0.6 + 0.6 + 0.4 = 1.9', marks: 2, max: 2 },
      { criterion: 'b: Units/context: 1.9 calls per day on average', marks: 1, max: 1 },
      { criterion: 'c: E(Y²) = 0²(0.1)+1²(0.3)+2²(0.3)+3²(0.2)+4²(0.1) = 0+0.3+1.2+1.8+1.6 = 4.9', marks: 3, max: 3 },
      { criterion: 'c: Var(Y) = E(Y²) − [E(Y)]² = 4.9 − (1.9)² = 4.9 − 3.61 = 1.29', marks: 3, max: 3 },
      { criterion: 'c: SD = √1.29 ≈ 1.136 calls (accept √1.29)', marks: 2, max: 2 },
    ],
  },

  // ── Item 2: Independent Probability Events ─────────────────────────────────
  {
    id: 'mat-prob-002',
    subject: 'mathematics',
    topic: 'Statistics & Probability',
    topics: ['Statistics & Probability'],
    level: 'UACE',
    difficulty: 2,
    source: 'UACE Pre-Registration Examination 2026 — Mathematics P425/2, St Kizito SS Bugolobi',
    totalMarks: 12,
    stem: `A mobile money agent in Kampala operates two separate queues: one for deposits and one for withdrawals. The probability that a customer arrives for a deposit in any given minute is 0.6. The probability that a customer arrives for a withdrawal in any given minute is 0.4. These two events are independent.`,
    parts: [
      {
        label: 'a',
        text: 'Calculate the probability that at least one customer arrives (either for a deposit or a withdrawal) in a given minute.',
        marks: 4,
      },
      {
        label: 'b',
        text: 'What is the probability that both a deposit customer and a withdrawal customer arrive in the same minute?',
        marks: 3,
      },
      {
        label: 'c',
        text: 'If the two events (deposit arrival and withdrawal arrival) were mutually exclusive instead of independent, how would your answer to part (a) change? Calculate the new probability and explain the difference.',
        marks: 5,
      },
    ],
    markScheme: [
      { criterion: 'a: Method 1 — complement: P(at least one) = 1 − P(none) = 1 − (0.4)(0.6) = 1 − 0.24 = 0.76', marks: 2, max: 2 },
      { criterion: 'a: OR Method 2: P(D) + P(W) − P(D∩W) = 0.6 + 0.4 − 0.24 = 0.76', marks: 2, max: 2 },
      { criterion: 'b: Since independent: P(D and W) = P(D) × P(W) = 0.6 × 0.4 = 0.24', marks: 3, max: 3 },
      { criterion: 'c: If mutually exclusive, P(D∩W) = 0', marks: 1, max: 1 },
      { criterion: 'c: P(at least one) = P(D) + P(W) − 0 = 0.6 + 0.4 = 1.0', marks: 2, max: 2 },
      { criterion: 'c: This would mean a customer always arrives — which is unrealistic if events truly cannot co-occur', marks: 2, max: 2 },
    ],
  },

  // ── Item 3: Dynamics — Atwood-style machine ────────────────────────────────
  {
    id: 'mat-dyn-001',
    subject: 'mathematics',
    topic: 'Applied Mathematics',
    topics: ['Applied Mathematics', 'Statistics & Probability'],
    level: 'UACE',
    difficulty: 2,
    source: 'UACE Pre-Registration Examination 2026 — Mathematics P425/2, St Kizito SS Bugolobi',
    totalMarks: 14,
    stem: `During a physics demonstration at a school in Gulu, a teacher sets up a system on a smooth horizontal table. Mass A (4 kg) sits on the table and is connected by a light, inextricable string to Mass B (6 kg), which hangs vertically over the edge of the table. The string passes over a smooth pulley fixed at the edge. The system is released from rest. Take g = 9.8 m s⁻².`,
    parts: [
      {
        label: 'a',
        text: 'Draw a clear diagram showing all the forces acting on Mass A and on Mass B separately.',
        marks: 2,
      },
      {
        label: 'b',
        text: 'Write down the equation of motion for Mass A and the equation of motion for Mass B. Define the positive direction you are using.',
        marks: 4,
      },
      {
        label: 'c',
        text: 'Solve your equations simultaneously to find: (i) the acceleration of the system, and (ii) the tension in the string.',
        marks: 6,
      },
      {
        label: 'd',
        text: 'Calculate the velocity of Mass B after it has fallen 2 m from rest.',
        marks: 2,
      },
    ],
    markScheme: [
      { criterion: 'a: Mass A: weight downward, normal upward, tension T forward along table', marks: 1, max: 1 },
      { criterion: 'a: Mass B: weight 6g downward, tension T upward', marks: 1, max: 1 },
      { criterion: 'b: Mass A: T = 4a (net force = T, no friction)', marks: 2, max: 2 },
      { criterion: 'b: Mass B: 6g − T = 6a (net downward force)', marks: 2, max: 2 },
      { criterion: 'c(i): Adding equations: 6g = 10a → a = 6(9.8)/10 = 5.88 m s⁻²', marks: 3, max: 3 },
      { criterion: 'c(ii): T = 4a = 4 × 5.88 = 23.52 N', marks: 3, max: 3 },
      { criterion: 'd: v² = u² + 2as = 0 + 2(5.88)(2) = 23.52 → v = √23.52 ≈ 4.85 m s⁻¹', marks: 2, max: 2 },
    ],
  },

  // ── Item 4: Projectile Motion ──────────────────────────────────────────────
  {
    id: 'mat-proj-001',
    subject: 'mathematics',
    topic: 'Applied Mathematics',
    topics: ['Applied Mathematics'],
    level: 'UACE',
    difficulty: 3,
    source: 'UACE Pre-Registration Examination 2026 — Mathematics P425/2, St Kizito SS Bugolobi',
    totalMarks: 16,
    stem: `The Uganda Wildlife Authority (UWA) is testing a new system to tranquilise aggressive elephants from a safe distance in Queen Elizabeth National Park. A ranger fires a tranquiliser dart from a high-pressure gun at an initial speed of 80 m s⁻¹. The target elephant is 150 m away on level ground. Air resistance is to be neglected. Take g = 9.8 m s⁻².`,
    parts: [
      {
        label: 'a',
        text: 'Write down expressions for the horizontal and vertical components of the dart\'s velocity and displacement at time t after firing at angle θ to the horizontal.',
        marks: 4,
      },
      {
        label: 'b',
        text: 'Show that the horizontal range R of a projectile launched at speed u and angle θ is given by R = u² sin 2θ / g.',
        marks: 4,
      },
      {
        label: 'c',
        text: 'Find the two possible launch angles that give a horizontal range of exactly 150 m. Comment on which angle the ranger should use and why.',
        marks: 5,
      },
      {
        label: 'd',
        text: 'For the smaller of the two angles found in (c), calculate the time of flight and the maximum height reached by the dart.',
        marks: 3,
      },
    ],
    markScheme: [
      { criterion: 'a: Horizontal: vₓ = u cos θ, x = ut cos θ', marks: 2, max: 2 },
      { criterion: 'a: Vertical: v_y = u sin θ − gt, y = ut sin θ − ½gt²', marks: 2, max: 2 },
      { criterion: 'b: Range when y = 0: ut sin θ − ½gt² = 0 → t = 2u sin θ / g', marks: 2, max: 2 },
      { criterion: 'b: R = u cos θ × t = u cos θ × 2u sin θ / g = u² sin 2θ / g  ✓', marks: 2, max: 2 },
      { criterion: 'c: sin 2θ = Rg/u² = 150 × 9.8 / 6400 = 0.2297', marks: 2, max: 2 },
      { criterion: 'c: 2θ = 13.28° → θ₁ ≈ 6.6° (flatter) OR 2θ = 166.7° → θ₂ ≈ 83.4° (steeper)', marks: 2, max: 2 },
      { criterion: 'c: Ranger should use smaller angle (≈6.6°) — faster, flatter trajectory, quicker impact; larger angle gives longer flight time allowing animal to move', marks: 1, max: 1 },
      { criterion: 'd: Time of flight (θ ≈ 6.6°): T = 2u sin θ / g = 2×80×sin6.6°/9.8 = 2×80×0.1149/9.8 ≈ 1.88 s', marks: 1, max: 1 },
      { criterion: 'd: Max height H = (u sin θ)² / (2g) = (80×0.1149)² / (2×9.8) = 84.9 / 19.6 ≈ 0.54 m', marks: 2, max: 2 },
    ],
  },

  // ── Item 5: Calculus — Integration application ────────────────────────────
  {
    id: 'mat-calc-001',
    subject: 'mathematics',
    topic: 'Pure Mathematics',
    topics: ['Pure Mathematics', 'Applied Mathematics'],
    level: 'A-Level',
    difficulty: 2,
    source: 'Uganda-context applied question',
    totalMarks: 15,
    stem: `A water tank at Gulu Regional Referral Hospital is filled at a rate r(t) = 6t² + 2 litres per minute, where t is the time in minutes since the pump was switched on. The pump runs for 5 minutes before being shut off.`,
    parts: [
      {
        label: 'a',
        text: 'Write down the definite integral that represents the total volume of water added to the tank during the 5-minute pumping period.',
        marks: 2,
      },
      {
        label: 'b',
        text: 'Evaluate the integral from part (a), showing full antiderivative working and substitution of limits.',
        marks: 5,
      },
      {
        label: 'c',
        text: 'Find the rate of change of r(t) at t = 3 minutes. Interpret this answer in the context of the water tank.',
        marks: 3,
      },
      {
        label: 'd',
        text: 'Find the time t at which the rate of inflow r(t) is exactly 56 litres per minute.',
        marks: 2,
      },
      {
        label: 'e',
        text: 'Sketch the graph of r(t) for 0 ≤ t ≤ 5, labelling the values at t = 0, t = 3, and t = 5.',
        marks: 3,
      },
    ],
    markScheme: [
      { criterion: 'a: ∫₀⁵ (6t² + 2) dt stated correctly with correct limits', marks: 2, max: 2 },
      { criterion: 'b: Antiderivative = 2t³ + 2t', marks: 2, max: 2 },
      { criterion: 'b: [2t³ + 2t]₀⁵ = (2×125 + 10) − 0 = 250 + 10 = 260', marks: 2, max: 2 },
      { criterion: 'b: Answer: 260 litres', marks: 1, max: 1 },
      { criterion: 'c: r\'(t) = 12t; r\'(3) = 36 litres per minute per minute', marks: 2, max: 2 },
      { criterion: 'c: Interpretation: at t = 3 min, the inflow rate is increasing at 36 L/min²', marks: 1, max: 1 },
      { criterion: 'd: 6t² + 2 = 56 → 6t² = 54 → t² = 9 → t = 3 minutes', marks: 2, max: 2 },
      { criterion: 'e: Correct shape (upward parabola); r(0)=2, r(3)=56, r(5)=152 labelled', marks: 3, max: 3 },
    ],
  },

  // ── Item 6: Statistics — A-Level exam scores ───────────────────────────────
  {
    id: 'mat-stats-001',
    subject: 'mathematics',
    topic: 'Statistics & Probability',
    topics: ['Statistics & Probability'],
    level: 'A-Level',
    difficulty: 2,
    source: 'Uganda-context applied question',
    totalMarks: 16,
    stem: `A sample of 120 students sat the UACE Mathematics exam at a school in Mbarara. Their scores (out of 100) were recorded in the following grouped frequency table:

| Score range | 0–20 | 21–40 | 41–60 | 61–80 | 81–100 |
|-------------|------|-------|-------|-------|--------|
| Frequency   |  5   |  12   |  28   |  40   |   35   |`,
    parts: [
      {
        label: 'a',
        text: 'Using class midpoints, calculate the mean score of the 120 students. Show all working.',
        marks: 4,
      },
      {
        label: 'b',
        text: 'Identify the modal class and estimate the mode using the formula: Mode = L + [(f₁−f₀)/(2f₁−f₀−f₂)] × h',
        marks: 3,
      },
      {
        label: 'c',
        text: 'Estimate the median score.',
        marks: 3,
      },
      {
        label: 'd',
        text: 'Calculate the variance and standard deviation of the scores using the grouped data.',
        marks: 4,
      },
      {
        label: 'e',
        text: 'What percentage of students scored above 60? If the pass mark is 40, what percentage passed?',
        marks: 2,
      },
    ],
    markScheme: [
      { criterion: 'a: Midpoints: 10, 30.5, 50.5, 70.5, 90.5', marks: 1, max: 1 },
      { criterion: 'a: Σ(fx) = 5×10+12×30.5+28×50.5+40×70.5+35×90.5 = 50+366+1414+2820+3167.5 = 7817.5', marks: 2, max: 2 },
      { criterion: 'a: Mean = 7817.5/120 ≈ 65.1', marks: 1, max: 1 },
      { criterion: 'b: Modal class = 61–80 (highest frequency = 40)', marks: 1, max: 1 },
      { criterion: 'b: L=61, f₁=40, f₀=28, f₂=35, h=20: Mode = 61 + [(40−28)/(80−28−35)]×20 = 61 + 12/17 × 20 ≈ 75.1', marks: 2, max: 2 },
      { criterion: 'c: Median is 60th value; cumulative: 5, 17, 45, 85... median in 61–80 class', marks: 1, max: 1 },
      { criterion: 'c: Median = 61 + [(60−45)/40]×20 = 61 + 7.5 = 68.5', marks: 2, max: 2 },
      { criterion: 'd: E(x²) = Σfx²/n using midpoints squared', marks: 2, max: 2 },
      { criterion: 'd: Variance = E(x²) − (mean)² ≈ 4704 − 4238 = 466; SD ≈ 21.6 (accept 20–23)', marks: 2, max: 2 },
      { criterion: 'e: Scored above 60: 40+35 = 75 students → 75/120 × 100 = 62.5%', marks: 1, max: 1 },
      { criterion: 'e: Scored above 40 (passed): 28+40+35 = 103 → 103/120 × 100 ≈ 85.8%', marks: 1, max: 1 },
    ],
  },

  // ── Item 7: Applied Mathematics — Trigonometry & Vectors (UACE 2025) ───────────────────────────────
  {
    id: 'mat-trig-001',
    subject: 'mathematics',
    topic: 'Applied Mathematics',
    topics: ['Applied Mathematics', 'Pure Mathematics'],
    level: 'UACE',
    difficulty: 2,
    source: 'UACE 2025 Mathematics Paper 2 - Question 4',
    totalMarks: 18,
    stem: `A surveyor is mapping the boundary of a piece of land in Jinja. From point A, the angle of elevation to the top of a radio mast is 25°. From point B, 200 m horizontally from A, the angle of elevation to the same point is 18°. The mast stands on level ground.

In a separate vector problem, two forces F₁ = 3i + 4j N and F₂ = -2i + 5j N act on a particle. The particle has a mass of 2 kg.`,
    parts: [
      {
        label: 'a(i)',
        text: 'Draw a diagram showing the two observation points A and B, the mast, and the angles of elevation.',
        marks: 2,
      },
      {
        label: 'a(ii)',
        text: 'Let h be the height of the mast and x be the horizontal distance from A to the mast. Write two equations involving h and x using the tangent function.',
        marks: 3,
      },
      {
        label: 'a(iii)',
        text: 'Solve the equations to find the height h of the radio mast.',
        marks: 4,
      },
      {
        label: 'b(i)',
        text: 'Find the resultant force R = F₁ + F₂ in the form ai + bj.',
        marks: 2,
      },
      {
        label: 'b(ii)',
        text: 'Calculate the magnitude of the resultant force and the angle it makes with the positive x-axis.',
        marks: 3,
      },
      {
        label: 'b(iii)',
        text: 'If the particle starts from rest and the resultant force acts for 3 seconds, find the final velocity of the particle.',
        marks: 4,
      },
    ],
    markScheme: [
      { criterion: 'a(i): Clear diagram with mast, points A and B, angles 25° and 18°, horizontal distances', marks: 2, max: 2 },
      { criterion: 'a(ii): tan 25° = h/x and tan 18° = h/(x+200)', marks: 3, max: 3 },
      { criterion: 'a(iii): h = x tan 25°; substitute into second equation: x tan 25° = (x+200) tan 18°', marks: 1, max: 1 },
      { criterion: 'a(iii): x(tan 25° - tan 18°) = 200 tan 18°; x = 200 tan 18°/(tan 25° - tan 18°)', marks: 1, max: 1 },
      { criterion: 'a(iii): x ≈ 200 × 0.3249/(0.4663 - 0.3249) ≈ 459.6 m', marks: 1, max: 1 },
      { criterion: 'a(iii): h = 459.6 × tan 25° ≈ 214.3 m', marks: 1, max: 1 },
      { criterion: 'b(i): R = (3-2)i + (4+5)j = i + 9j', marks: 2, max: 2 },
      { criterion: 'b(ii): |R| = √(1² + 9²) = √82 ≈ 9.06 N', marks: 1, max: 1 },
      { criterion: 'b(ii): θ = tan⁻¹(9/1) ≈ 83.7°', marks: 2, max: 2 },
      { criterion: 'b(iii): F = ma → a = 9.06/2 = 4.53 m s⁻²', marks: 1, max: 1 },
      { criterion: 'b(iii): v = u + at = 0 + 4.53 × 3 = 13.6 m s⁻¹', marks: 3, max: 3 },
    ],
  },

  // ── Item 8: Pure Mathematics — Calculus (UACE 2025) ─────────────────────────────────────────────
  {
    id: 'mat-calc-002',
    subject: 'mathematics',
    topic: 'Pure Mathematics',
    topics: ['Pure Mathematics'],
    level: 'UACE',
    difficulty: 3,
    source: 'UACE 2025 Mathematics Paper 1 - Question 6',
    totalMarks: 20,
    stem: `The profit function of a small business in Kampala is given by P(x) = -2x³ + 15x² - 24x + 10, where x is the number of units sold (in hundreds) and P is the profit (in millions of Ugandan shillings).

The cost function for producing x units is C(x) = x² + 8x + 5, where C is in millions of shillings.`,
    parts: [
      {
        label: 'a(i)',
        text: 'Find the derivative P′(x) and determine the critical points of the profit function.',
        marks: 3,
      },
      {
        label: 'a(ii)',
        text: 'Use the second derivative test to classify each critical point as a maximum, minimum, or point of inflection.',
        marks: 4,
      },
      {
        label: 'a(iii)',
        text: 'What is the maximum profit and how many units must be sold to achieve this maximum?',
        marks: 3,
      },
      {
        label: 'b(i)',
        text: 'Find the marginal cost function C′(x) and evaluate it when x = 3.',
        marks: 2,
      },
      {
        label: 'b(ii)',
        text: 'Calculate the average cost per unit when 400 units are produced (x = 4).',
        marks: 3,
      },
      {
        label: 'b(iii)',
        text: 'Find the value of x where the average cost is minimized.',
        marks: 5,
      },
    ],
    markScheme: [
      { criterion: 'a(i): P′(x) = -6x² + 30x - 24', marks: 1, max: 1 },
      { criterion: 'a(i): Set P′(x) = 0: -6x² + 30x - 24 = 0 → 6x² - 30x + 24 = 0', marks: 1, max: 1 },
      { criterion: 'a(i): Critical points: x = 1 and x = 4', marks: 1, max: 1 },
      { criterion: 'a(ii): P′′(x) = -12x + 30', marks: 1, max: 1 },
      { criterion: 'a(ii): At x = 1: P′′(1) = 18 > 0 → local minimum', marks: 1, max: 1 },
      { criterion: 'a(ii): At x = 4: P′′(4) = -18 < 0 → local maximum', marks: 1, max: 1 },
      { criterion: 'a(ii): Classification clearly stated', marks: 1, max: 1 },
      { criterion: 'a(iii): Maximum occurs at x = 4 (400 units)', marks: 1, max: 1 },
      { criterion: 'a(iii): P(4) = -2(64) + 15(16) - 24(4) + 10 = -128 + 240 - 96 + 10 = 26', marks: 1, max: 1 },
      { criterion: 'a(iii): Maximum profit = 26 million UGX', marks: 1, max: 1 },
      { criterion: 'b(i): C′(x) = 2x + 8; C′(3) = 2(3) + 8 = 14 million UGX per hundred units', marks: 2, max: 2 },
      { criterion: 'b(ii): Average cost = C(x)/x = (x² + 8x + 5)/x', marks: 1, max: 1 },
      { criterion: 'b(ii): At x = 4: AC = (16 + 32 + 5)/4 = 53/4 = 13.25 million UGX per hundred units', marks: 2, max: 2 },
      { criterion: 'b(iii): AC = x + 8 + 5/x; d(AC)/dx = 1 - 5/x²', marks: 2, max: 2 },
      { criterion: 'b(iii): Set d(AC)/dx = 0: 1 - 5/x² = 0 → x² = 5 → x = √5', marks: 2, max: 2 },
      { criterion: 'b(iii): Second derivative positive → minimum at x = √5 ≈ 2.24 (224 units)', marks: 1, max: 1 },
    ],
  },

  // ── Item 9: Pure Maths — Complex Numbers ──────────────────────────────────
  {
    id: 'mat-complex-001',
    subject: 'mathematics',
    topic: 'Pure Mathematics',
    topics: ['Pure Mathematics'],
    level: 'UACE',
    difficulty: 3,
    source: 'Uganda-context applied question',
    totalMarks: 16,
    stem: `An engineer at the National Water and Sewerage Corporation in Kampala is modelling AC circuit impedances using complex numbers. The total impedance is Z = (3 + 4i) + (1 − 2i). She also needs to analyse the roots of the equation z² − 4z + 13 = 0, where z is complex.`,
    parts: [
      {
        label: 'a',
        text: 'Compute Z = (3 + 4i) + (1 − 2i). Find the modulus |Z| and argument arg(Z).',
        marks: 4,
      },
      {
        label: 'b',
        text: 'Find the complex conjugate of Z and compute Z × Z̄. Comment on your result.',
        marks: 3,
      },
      {
        label: 'c',
        text: 'Solve z² − 4z + 13 = 0, giving your answer in the form a + bi. Show all working.',
        marks: 5,
      },
      {
        label: 'd',
        text: 'For the roots found in (c), verify that their sum equals 4 and their product equals 13. Hence state Vieta\'s formulae for a quadratic az² + bz + c = 0.',
        marks: 4,
      },
    ],
    markScheme: [
      { criterion: 'a: Z = (3+1) + (4−2)i = 4 + 2i', marks: 1, max: 1 },
      { criterion: 'a: |Z| = √(16+4) = √20 = 2√5 ≈ 4.47', marks: 1, max: 1 },
      { criterion: 'a: arg(Z) = arctan(2/4) = arctan(0.5) ≈ 26.6°', marks: 2, max: 2 },
      { criterion: 'b: Z̄ = 4 − 2i', marks: 1, max: 1 },
      { criterion: 'b: Z × Z̄ = (4+2i)(4−2i) = 16 + 4 = 20 = |Z|² (always real)', marks: 2, max: 2 },
      { criterion: 'c: Discriminant = 16 − 52 = −36; √(−36) = 6i', marks: 2, max: 2 },
      { criterion: 'c: z = (4 ± 6i)/2 = 2 ± 3i', marks: 2, max: 2 },
      { criterion: 'c: z₁ = 2+3i and z₂ = 2−3i stated', marks: 1, max: 1 },
      { criterion: 'd: Sum = (2+3i)+(2−3i) = 4 ✓; Product = (2+3i)(2−3i) = 4+9 = 13 ✓', marks: 2, max: 2 },
      { criterion: 'd: Vieta\'s: sum of roots = −b/a; product of roots = c/a', marks: 2, max: 2 },
    ],
  },

  // ── Q8: Electricity & Circuits (UACE 2025 Paper 1) ───────────────────────────
  {
    id: 'phy-electric-002',
    subject: 'physics',
    topic: 'Electricity & Magnetism',
    topics: ['Electricity & Magnetism'],
    level: 'A-Level',
    difficulty: 3,
    source: 'UACE 2025 Physics Paper 1 - Question 3',
    totalMarks: 20,
    stem: `A student sets up an electrical circuit to investigate the relationship between current and potential difference for a filament lamp. The circuit consists of a 12V battery, a variable resistor, the filament lamp, an ammeter, and a voltmeter connected across the lamp. The student records the following data:

| Current (A) | 0.10 | 0.20 | 0.30 | 0.40 | 0.50 |
|-------------|------|------|------|------|------|
| Voltage (V) | 1.2  | 2.8  | 4.5  | 6.0  | 7.2  |

The filament lamp has a resistance of 40 Ω when it is not operating (cold).`,
    parts: [
      {
        label: 'a(i)',
        text: 'Draw a circuit diagram for this experiment, showing the correct placement of all components.',
        marks: 3,
      },
      {
        label: 'a(ii)',
        text: 'Explain why the resistance of the filament lamp increases as the current increases.',
        marks: 3,
      },
      {
        label: 'b',
        text: 'Plot a graph of voltage against current using the given data. Use your graph to determine the resistance of the lamp when the current is 0.35 A.',
        marks: 6,
      },
      {
        label: 'c(i)',
        text: 'Calculate the electrical power dissipated by the lamp when the current is 0.40 A.',
        marks: 2,
      },
      {
        label: 'c(ii)',
        text: 'If the lamp operates at this power for 2 hours, calculate the electrical energy consumed in kWh.',
        marks: 3,
      },
      {
        label: 'd',
        text: 'Explain why the I-V characteristic of a filament lamp is non-linear, unlike that of a metallic conductor at constant temperature.',
        marks: 3,
      },
    ],
    markScheme: [
      { criterion: 'a(i): Complete circuit with battery, variable resistor, lamp, ammeter in series, voltmeter parallel to lamp', marks: 3, max: 3 },
      { criterion: 'a(ii): Temperature increases with current; resistance of metal filament increases with temperature', marks: 2, max: 2 },
      { criterion: 'a(ii): Increased atomic vibrations impede electron flow more at higher temperatures', marks: 1, max: 1 },
      { criterion: 'b: Correct axes labels and scales; points plotted accurately; smooth curve through points', marks: 3, max: 3 },
      { criterion: 'b: Tangent drawn at I = 0.35 A; gradient calculated correctly', marks: 2, max: 2 },
      { criterion: 'b: Resistance = V/I from graph ≈ 18 Ω (accept 16-20 Ω)', marks: 1, max: 1 },
      { criterion: 'c(i): P = VI = 6.0 × 0.40 = 2.4 W', marks: 2, max: 2 },
      { criterion: 'c(ii): Energy = Pt = 2.4 × 2 = 4.8 Wh = 0.0048 kWh', marks: 3, max: 3 },
      { criterion: 'd: Filament temperature changes significantly with current; resistance not constant', marks: 2, max: 2 },
      { criterion: 'd: Metallic conductor at constant temperature has constant resistance (Ohm\'s law applies)', marks: 1, max: 1 },
    ],
  },

  // ── Q9: Waves & Sound (UACE 2025 Paper 2) ────────────────────────────────────
  {
    id: 'phy-waves-001',
    subject: 'physics',
    topic: 'Waves & Oscillations',
    topics: ['Waves & Oscillations'],
    level: 'A-Level',
    difficulty: 2,
    source: 'UACE 2025 Physics Paper 2 - Question 5',
    totalMarks: 18,
    stem: `A stationary wave is formed on a stretched string fixed at both ends. The string has a length of 1.20 m and a linear mass density of 2.5 × 10⁻³ kg m⁻¹. When the string vibrates in its second harmonic mode, the frequency is 80 Hz.

In a separate experiment, a pipe organ at Kampala Cathedral produces a fundamental frequency of 256 Hz when the temperature is 20°C. The speed of sound in air varies with temperature according to v = 331 + 0.6T, where T is the temperature in °C.`,
    parts: [
      {
        label: 'a(i)',
        text: 'Define the term node and antinode as applied to stationary waves.',
        marks: 2,
      },
      {
        label: 'a(ii)',
        text: 'Calculate the wavelength of the stationary wave on the string when it vibrates in the second harmonic.',
        marks: 3,
      },
      {
        label: 'a(iii)',
        text: 'Calculate the tension in the string.',
        marks: 4,
      },
      {
        label: 'b(i)',
        text: 'Calculate the speed of sound in air at 20°C.',
        marks: 2,
      },
      {
        label: 'b(ii)',
        text: 'If the pipe organ is open at both ends, calculate the length of the pipe that produces the fundamental frequency of 256 Hz.',
        marks: 3,
      },
      {
        label: 'b(iii)',
        text: 'What would be the frequency of the third harmonic of this pipe?',
        marks: 2,
      },
      {
        label: 'c',
        text: 'Explain why the quality of sound from a pipe organ differs from that of a tuning fork, even when they have the same fundamental frequency.',
        marks: 2,
      },
    ],
    markScheme: [
      { criterion: 'a(i): Node - point of zero amplitude; Antinode - point of maximum amplitude', marks: 2, max: 2 },
      { criterion: 'a(ii): Second harmonic has 2 loops; L = λ → λ = 1.20 m', marks: 3, max: 3 },
      { criterion: 'a(iii): v = fλ = 80 × 1.20 = 96 m s⁻¹; T = μv² = 2.5×10⁻³ × 96² = 23.0 N', marks: 4, max: 4 },
      { criterion: 'b(i): v = 331 + 0.6×20 = 331 + 12 = 343 m s⁻¹', marks: 2, max: 2 },
      { criterion: 'b(ii): For open pipe, L = λ/2; λ = v/f = 343/256 = 1.34 m; L = 0.67 m', marks: 3, max: 3 },
      { criterion: 'b(iii): Third harmonic frequency = 3f₁ = 3 × 256 = 768 Hz', marks: 2, max: 2 },
      { criterion: 'c: Different harmonics present (overtones); different waveforms produce different timbre/quality', marks: 2, max: 2 },
    ],
  },

  // ── Q10: Modern Physics (UACE 2025 Paper 1) ───────────────────────────────────
  {
    id: 'phy-modern-001',
    subject: 'physics',
    topic: 'Modern Physics',
    topics: ['Modern Physics', 'Nuclear Physics'],
    level: 'A-Level',
    difficulty: 3,
    source: 'UACE 2025 Physics Paper 1 - Question 8',
    totalMarks: 17,
    stem: `A radioactive isotope used in medical imaging has a half-life of 6.0 hours. A hospital in Entebbe receives a sample containing 8.0 × 10¹⁰ atoms of this isotope for use in patient diagnostics.

In a separate experiment, electrons are accelerated through a potential difference of 2.0 kV and directed at a crystal to demonstrate electron diffraction. The spacing between atomic planes in the crystal is 2.5 × 10⁻¹⁰ m. (Planck\'s constant h = 6.63 × 10⁻³⁴ J s; mass of electron mₑ = 9.11 × 10⁻³¹ kg; electronic charge e = 1.60 × 10⁻¹⁹ C)`,
    parts: [
      {
        label: 'a(i)',
        text: 'Define half-life and explain why it is independent of external conditions like temperature and pressure.',
        marks: 3,
      },
      {
        label: 'a(ii)',
        text: 'Calculate the decay constant of this isotope.',
        marks: 2,
      },
      {
        label: 'a(iii)',
        text: 'How many atoms of the isotope will remain after 24 hours?',
        marks: 3,
      },
      {
        label: 'b(i)',
        text: 'Calculate the wavelength of the accelerated electrons using the de Broglie equation.',
        marks: 3,
      },
      {
        label: 'b(ii)',
        text: 'If these electrons are diffracted by the crystal, calculate the first-order diffraction angle using Bragg\'s law.',
        marks: 3,
      },
      {
        label: 'c',
        text: 'Explain how electron diffraction provides evidence for the wave nature of electrons.',
        marks: 3,
      },
    ],
    markScheme: [
      { criterion: 'a(i): Time for half the nuclei to decay; nuclear process unaffected by external conditions', marks: 2, max: 2 },
      { criterion: 'a(i): Depends on nuclear stability, not electron arrangements', marks: 1, max: 1 },
      { criterion: 'a(ii): λ = ln 2 / t₁/₂ = 0.693 / (6×3600) = 3.21 × 10⁻⁵ s⁻¹', marks: 2, max: 2 },
      { criterion: 'a(iii): N = N₀e⁻λt; t = 24h = 4 half-lives; N = 8.0×10¹⁰ × (1/2)⁴ = 5.0×10⁹ atoms', marks: 3, max: 3 },
      { criterion: 'b(i): λ = h / √(2mₑeV) = 6.63×10⁻³⁴ / √(2×9.11×10⁻³¹×1.60×10⁻¹⁹×2000)', marks: 2, max: 2 },
      { criterion: 'b(i): λ = 2.74 × 10⁻¹¹ m', marks: 1, max: 1 },
      { criterion: 'b(ii): 2d sin θ = nλ; sin θ = λ/(2d) = 2.74×10⁻¹¹/(2×2.5×10⁻¹⁰) = 0.0548', marks: 2, max: 2 },
      { criterion: 'b(ii): θ = 3.14° (first order)', marks: 1, max: 1 },
      { criterion: 'c: Diffraction is wave phenomenon; electrons produce interference patterns; wavelength comparable to atomic spacing', marks: 3, max: 3 },
    ],
  },

];

// ─── Objective questions (multiple-choice and numeric) ─────────────────────
// Same scenario shape as the written ones, plus `type`/`options`/`answer`
// (and `tolerance` for numeric). Practice renders these as selectable options
// or a number field and marks them locally — instant, and no AI quota spent.
// For a multiple-choice item, `answer` is the correct option string, matching
// examBank.js.
const objectiveScenarios = [
  {
    id: 'phy-mcq-001',
    subject: 'physics',
    topic: 'Classical Mechanics',
    topics: ['Classical Mechanics'],
    level: 'UACE',
    difficulty: 2,
    type: 'mcq',
    totalMarks: 2,
    source: 'UACE Physics — objective practice',
    stem: 'A body moves in a circle of radius 2 m at a constant speed of 4 m s⁻¹. What is its centripetal acceleration?',
    options: ['2 m s⁻²', '4 m s⁻²', '8 m s⁻²', '16 m s⁻²'],
    answer: '8 m s⁻²',
    explanation: 'a = v² / r = 4² / 2 = 8 m s⁻².',
  },
  {
    id: 'phy-mcq-002',
    subject: 'physics',
    topic: 'Modern Physics',
    topics: ['Modern Physics'],
    level: 'UACE',
    difficulty: 2,
    type: 'mcq',
    totalMarks: 2,
    source: 'UACE Physics — objective practice',
    stem: 'Who proposed that energy is emitted and absorbed in discrete packets (quanta)?',
    options: ['Newton', 'Planck', 'Einstein', 'Bohr'],
    answer: 'Planck',
    explanation: 'Max Planck introduced energy quantisation, E = hf, in 1900.',
  },
  {
    id: 'phy-num-001',
    subject: 'physics',
    topic: 'Optics',
    topics: ['Optics'],
    level: 'UACE',
    difficulty: 2,
    type: 'numeric',
    totalMarks: 3,
    source: 'UACE Physics — objective practice',
    stem: 'Light travels from air (n = 1.0) into glass (n = 1.5) at an angle of incidence of 30°. Calculate the angle of refraction in degrees, to 1 decimal place.',
    answer: 19.5,
    tolerance: 0.5,
    explanation: 'Snell\'s law: sin 30° = 1.5 sin θ ⇒ sin θ = 1/3 ⇒ θ ≈ 19.5°.',
  },
  {
    id: 'mat-mcq-001',
    subject: 'mathematics',
    topic: 'Pure Mathematics',
    topics: ['Pure Mathematics'],
    level: 'UACE',
    difficulty: 1,
    type: 'mcq',
    totalMarks: 2,
    source: 'UACE Mathematics — objective practice',
    stem: 'What is the modulus of the complex number z = 3 + 4i?',
    options: ['3', '4', '5', '7'],
    answer: '5',
    explanation: '|z| = √(3² + 4²) = √25 = 5.',
  },
  {
    id: 'mat-num-001',
    subject: 'mathematics',
    topic: 'Statistics & Probability',
    topics: ['Statistics & Probability'],
    level: 'UACE',
    difficulty: 2,
    type: 'numeric',
    totalMarks: 3,
    source: 'UACE Mathematics — objective practice',
    stem: 'In a standard normal distribution, what percentage of values lie within one standard deviation of the mean? Give a number.',
    answer: 68,
    tolerance: 1,
    explanation: 'The 68–95–99.7 rule: about 68% of values lie within 1σ of the mean.',
  },
  {
    id: 'mat-mcq-002',
    subject: 'mathematics',
    topic: 'Pure Mathematics',
    topics: ['Pure Mathematics'],
    level: 'UACE',
    difficulty: 2,
    type: 'mcq',
    totalMarks: 2,
    source: 'UACE Mathematics — objective practice',
    stem: 'Evaluate ∫₀⁴ (2x + 3) dx.',
    options: ['11', '22', '28', '44'],
    answer: '28',
    explanation: '∫(2x + 3)dx = x² + 3x; (16 + 12) − 0 = 28.',
  },
];

// ─── Master export ─────────────────────────────────────────────────────────
export const PRACTICE_SCENARIOS = [...physicsScenarios, ...mathematicsScenarios, ...objectiveScenarios];
