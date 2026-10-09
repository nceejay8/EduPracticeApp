// Hydrates the generated-question pool and reports when it is ready.
//
// Two consumers, two different needs:
//
//   Practice needs to know the pool is *settled* before picking a question,
//   because its memo is keyed on the topic alone. If it picked while the pool was
//   still empty, a topic whose only material is generated would render nothing
//   and — because the memo would not re-run — never recover.
//
//   Layout just wants the fetch started as early as possible, so it completes
//   inside the existing auth loader (ProtectedRoute holds the screen for a minimum
//   three seconds) rather than after it.

import { useEffect, useState } from 'react';
import {
  loadPublishedScenarios,
  subscribeToPublishedScenarios,
  getPublishedScenarios,
} from '../data/publishedScenarios';
import { invalidateCoverage } from '../data/syllabusProgress';

export function usePublishedScenarios() {
  const [published, setPublished] = useState(getPublishedScenarios);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPublishedScenarios((scenarios, loaded) => {
      setPublished(scenarios);
      // `ready` means "stop asking again", not "the pool is non-empty". A
      // successful load that returned nothing is still a settled answer, and
      // treating it as not-ready would block the workboard forever on a topic
      // that legitimately has no generated material.
      setReady(loaded);
    });
    loadPublishedScenarios();
    return unsubscribe;
  }, []);

  // The coverage map is memoised per subject, so every /syllabus count and every
  // topic-exam offer is derived from a snapshot taken before the pool landed.
  // Clearing it here is the one place that sees both the load and the memo.
  useEffect(() => {
    if (ready) invalidateCoverage();
  }, [ready]);

  return { published, ready };
}
