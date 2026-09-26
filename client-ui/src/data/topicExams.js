// The catalogue of topic exams the app can actually offer.
//
// This lives in the data layer rather than in the MockExams page for one
// practical reason: it has to stay in step with the coverage numbers the
// syllabus page shows, and it is worth being able to assert that agreement
// without rendering React.
//
// The rule it enforces — a topic exam is only offered when there is enough
// material to fill the paper, and the paper it offers is exactly the paper
// buildExam will assemble — is the same rule the /syllabus "Topic exam" button
// relies on. If the two ever disagree, students get a link to a paper that is
// shorter than advertised, or no link to a paper that exists.

import { SUBJECT_IDS, getSubject, listChapters } from './syllabus';
import { getTopicCoverage } from './syllabusProgress';

// A topic paper is a short focused drill, not a full sitting.
const MAX_TOPIC_QUESTIONS = 6;
const MAX_TOPIC_SCENARIOS = 2;

export function buildTopicExams(level) {
  if (level !== 'A-Level' && level !== 'UACE') return [];

  const out = [];

  SUBJECT_IDS.forEach(subjectId => {
    const subject = getSubject(subjectId).name;
    listChapters(subjectId).forEach(chapter => {
      chapter.topics.forEach(topic => {
        const coverage = getTopicCoverage(subjectId, topic.id);
        if (coverage.examTotal === 0) return;

        // Uganda-context scenarios stand in for a couple of slots so a topic
        // paper is not purely multiple choice where scenarios exist. The count
        // is also capped by the multiple-choice questions we hold, otherwise the
        // paper asks for more MCQs than exist and the student gets a short paper
        // with no explanation of why.
        const scenarioCount = Math.min(MAX_TOPIC_SCENARIOS, coverage.scenario);
        const count = Math.min(
          coverage.examTotal,
          coverage.exam + scenarioCount,
          MAX_TOPIC_QUESTIONS
        );

        out.push({
          id: `topic-${subjectId}-${topic.id}`,
          title: `${topic.name} — Topic Exam`,
          subject,
          subjectId,
          level,
          topicId: topic.id,
          chapterId: chapter.id,
          chapterName: chapter.name,
          topicName: topic.name,
          topics: [topic.name],
          difficulty: topic.difficulty?.includes('Advanced') ? 'Hard'
                    : topic.difficulty?.includes('Beginner') ? 'Easy' : 'Medium',
          count,
          scenarioCount,
          available: coverage.examTotal,
          subtopics: topic.subtopics.map(s => s.name),
          duration: `${Math.max(5, count * 2)}m`,
          kind: 'topic',
        });
      });
    });
  });

  return out;
}
