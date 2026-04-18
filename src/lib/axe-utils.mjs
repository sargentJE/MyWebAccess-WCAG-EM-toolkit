export function classifyRule(rule, reportingConfig = {}) {
  const tags = new Set(rule.tags || []);
  const bestPractice = tags.has('best-practice');
  return {
    bestPractice,
    classification:
      bestPractice && reportingConfig.groupBestPracticeSeparately !== false
        ? 'best-practice-or-manual-review'
        : 'primary-automated-finding',
  };
}
