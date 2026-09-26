// Uganda Exam Structure - UNEB Standards
//
// This module is a compatibility shim. The authoritative subject structure now
// lives in `syllabus.js`; everything exported here is derived from it so the
// topic lists used by Practice, Mock Exams and Search can no longer drift apart
// or drift away from the /syllabus outline.

import { SYLLABUS, getSubject, listChapters } from './syllabus';
import { getTopicCoverage, getSubjectCoverage } from './syllabusProgress';

export const examLevels = {
  ALEVEL: {
    id: 'a-level',
    name: 'A-Level',
    description: 'Uganda Advanced Certificate of Education - S.6',
    color: 'from-purple-500 to-pink-500',
    difficulty: 'Intermediate to Advanced'
  },
  UACE: {
    id: 'uace',
    name: 'UACE',
    description: 'Uganda Advanced Certificate of Education (Alternative)',
    color: 'from-rose-500 to-orange-500',
    difficulty: 'Advanced'
  }
};

// A-Level and UACE currently share one topic tree (mirroring LEVEL_EQUIVALENTS
// in examBank.js), so both keys resolve to the same derived chapters.
const LEVEL_KEYS = ['ALEVEL', 'UACE'];

// Derives the legacy chapter shape from the canonical outline:
//   { id, name, subtopics: string[], questions, difficulty }
//
// `subtopics` stays a flat string array of the official topic names because
// existing consumers (SearchModal description text, MockExams "Covers:" line,
// Practice subject-card chips) all read it as strings.
function deriveChapters(subjectId) {
  return listChapters(subjectId).map(chapter => ({
    id: chapter.id,
    name: chapter.name,
    subtopics: chapter.topics.map(topic => topic.name),
    topicIds: chapter.topics.map(topic => topic.id),
    // Exam questions only. `coverage.total` also counts AI practice scenarios,
    // including chapter-wide ones that every topic in the chapter shares, so it
    // would overstate what a topic exam can actually serve.
    questions: chapter.topics.reduce(
      (sum, topic) => sum + getTopicCoverage(subjectId, topic.id).exam,
      0
    ),
    difficulty: 'Intermediate to Advanced'
  }));
}

function buildSubjectTopics(subjectId) {
  const derived = deriveChapters(subjectId);
  return LEVEL_KEYS.reduce((acc, levelKey) => {
    acc[levelKey] = derived;
    return acc;
  }, {});
}

export const physicsTopics = buildSubjectTopics('physics');
export const mathematicsTopics = buildSubjectTopics('mathematics');

// Convenience passthroughs for new code — prefer these over the level-keyed
// lookups above, which only exist for backwards compatibility.
export const SUBJECTS = { physics: getSubject('physics'), mathematics: getSubject('mathematics') };

export function getSubjectChapters(subjectId) {
  return deriveChapters(subjectId);
}

export function getSubjectContentCount(subjectId) {
  return getSubjectCoverage(subjectId).items;
}

// Uganda-specific practice scenarios
export const ugandaContextScenarios = {
  physics: [
    {
      id: 'nile-rapids-energy',
      title: 'Water Flow in Nile Rapids',
      context: 'Calculate kinetic energy and power of water flowing in Murchison Falls.',
      topic: 'Energy & Power',
      examLevel: 'A-Level',
      difficulty: 'Advanced'
    },
    {
      id: 'uganda-altitude-pressure',
      title: 'Atmospheric Pressure at Rwenzori Mountains',
      context: 'Calculate pressure changes at different altitudes (Rwenzori: 5,109m)',
      topic: 'Gas Laws',
      examLevel: 'A-Level',
      difficulty: 'Advanced'
    }
  ],
  mathematics: [
    {
      id: 'uganda-currency-calculus',
      title: 'Uganda Shilling Exchange Rate Analysis',
      context: 'Use calculus to analyze currency exchange trends (UGX to USD)',
      topic: 'Calculus Applications',
      examLevel: 'A-Level',
      difficulty: 'Advanced'
    }
  ]
};

// Additional Mock Exams based on UACE 2025 Past Papers
export const additionalMockExams = [
  {
    id: 'uace-physics-2025-p1',
    title: 'UACE Physics Paper 1 2025 Mock',
    subject: 'Physics',
    level: 'UACE',
    difficulty: 'Hard',
    duration: '2h 30min',
    totalQuestions: 12,
    scenarioQuestions: 3,
    description: 'Complete mock exam based on UACE 2025 Physics Paper 1 with emphasis on Electricity, Modern Physics, and Thermal Physics.',
    icon: 'solar:atom-bold',
    tone: 'sky',
    topics: [
      'Electricity & Magnetism',
      'Modern Physics', 
      'Thermal Physics',
      'Waves & Oscillations',
      'Classical Mechanics'
    ],
    questionBreakdown: {
      'Electricity & Circuits': 3,
      'Modern Physics': 2,
      'Thermal Physics': 2,
      'Waves & Sound': 2,
      'Mechanics': 3
    }
  },
  {
    id: 'uace-physics-2025-p2',
    title: 'UACE Physics Paper 2 2025 Mock',
    subject: 'Physics',
    level: 'UACE',
    difficulty: 'Hard',
    duration: '2h 30min',
    totalQuestions: 10,
    scenarioQuestions: 4,
    description: 'Mock exam based on UACE 2025 Physics Paper 2 focusing on Waves, Optics, and practical applications.',
    icon: 'solar:target-bold',
    tone: 'violet',
    topics: [
      'Waves & Oscillations',
      'Optics',
      'Classical Mechanics',
      'Electricity & Magnetism'
    ],
    questionBreakdown: {
      'Waves & Sound': 3,
      'Optics': 2,
      'Mechanics': 3,
      'Electricity': 2
    }
  },
  {
    id: 'uace-mathematics-2025-p1',
    title: 'UACE Mathematics Paper 1 2025 Mock',
    subject: 'Mathematics',
    level: 'UACE',
    difficulty: 'Hard',
    duration: '2h 30min',
    totalQuestions: 11,
    scenarioQuestions: 3,
    description: 'Mock exam based on UACE 2025 Mathematics Paper 1 covering Pure Mathematics and Calculus.',
    icon: 'solar:calculator-bold',
    tone: 'amber',
    topics: [
      'Pure Mathematics',
      'Calculus',
      'Complex Numbers',
      'Trigonometry'
    ],
    questionBreakdown: {
      'Pure Mathematics': 4,
      'Calculus': 3,
      'Complex Numbers': 2,
      'Trigonometry': 2
    }
  },
  {
    id: 'uace-mathematics-2025-p2',
    title: 'UACE Mathematics Paper 2 2025 Mock',
    subject: 'Mathematics',
    level: 'UACE',
    difficulty: 'Hard',
    duration: '2h 30min',
    totalQuestions: 10,
    scenarioQuestions: 4,
    description: 'Mock exam based on UACE 2025 Mathematics Paper 2 focusing on Applied Mathematics and Statistics.',
    icon: 'solar:book-2-bold',
    tone: 'emerald',
    topics: [
      'Applied Mathematics',
      'Statistics & Probability',
      'Mechanics',
      'Vectors'
    ],
    questionBreakdown: {
      'Applied Mathematics': 3,
      'Statistics & Probability': 3,
      'Mechanics': 2,
      'Vectors': 2
    }
  },
  {
    id: 'uace-comprehensive-2025',
    title: 'UACE Comprehensive Mock 2025',
    subject: 'Combined',
    level: 'UACE',
    difficulty: 'Hard',
    duration: '3h',
    totalQuestions: 20,
    scenarioQuestions: 6,
    description: 'Comprehensive mock exam combining Physics and Mathematics based on 2025 UACE papers.',
    icon: 'solar:star-bold',
    tone: 'rose',
    topics: [
      'Physics: All Topics',
      'Mathematics: All Topics'
    ],
    questionBreakdown: {
      'Physics': 10,
      'Mathematics': 10
    }
  }
];

export { SYLLABUS };
