const { fail } = require('../common/response');

const FIXED_BANDS = [
  [0, 9, 0, 0], [10, 19, 1, 0], [20, 29, 2, 1], [30, 39, 3, 1],
  [40, 49, 5, 2], [50, 59, 5, 2], [60, 69, 9, 3], [70, 79, 14, 4],
  [80, 89, 19, 5], [90, 100, 23, 6]
];

const DEFAULT_RULES = Object.freeze({
  _id: 'business-rules',
  completionReward: 5,
  upheldComplaintPenalty: 25,
  initialContributionScore: 60,
  initialPostingQuota: 3,
  newUserProtectionDays: 7,
  rewardTimeLimitMinutes: 10,
  inactivityThresholdWeeks: 2,
  inactiveExtraPenalty: 10,
  contributionMin: 0,
  contributionMax: 100,
  contributionBands: FIXED_BANDS.map(([min, max, weeklyDeduction, weeklyPostingQuota]) => ({ min, max, weeklyDeduction, weeklyPostingQuota })),
  version: 1
});

function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw fail('VALIDATION_ERROR', `${name}必须为${min}到${max}的整数`);
  return value;
}

function validateBands(bands) {
  if (!Array.isArray(bands) || bands.length !== FIXED_BANDS.length) throw fail('VALIDATION_ERROR', '必须完整配置十个贡献值档位');
  return bands.map((band, index) => {
    const [min, max] = FIXED_BANDS[index];
    if (Number(band?.min) !== min || Number(band?.max) !== max) throw fail('VALIDATION_ERROR', '贡献值档位边界不可修改');
    return {
      min,
      max,
      weeklyDeduction: integer(Number(band.weeklyDeduction), 0, 100, '每周扣除贡献值'),
      weeklyPostingQuota: integer(Number(band.weeklyPostingQuota), 0, 20, '每周发单次数')
    };
  });
}

function normalizeRules(raw = {}) {
  return {
    ...DEFAULT_RULES,
    ...raw,
    _id: 'business-rules',
    completionReward: integer(Number(raw.completionReward ?? DEFAULT_RULES.completionReward), 0, 100, '配送奖励'),
    upheldComplaintPenalty: integer(Number(raw.upheldComplaintPenalty ?? DEFAULT_RULES.upheldComplaintPenalty), 0, 100, '投诉处罚'),
    inactiveExtraPenalty: integer(Number(raw.inactiveExtraPenalty ?? DEFAULT_RULES.inactiveExtraPenalty), 0, 100, '连续无配送处罚'),
    initialContributionScore: 60,
    initialPostingQuota: 3,
    newUserProtectionDays: 7,
    rewardTimeLimitMinutes: 10,
    inactivityThresholdWeeks: 2,
    contributionMin: 0,
    contributionMax: 100,
    contributionBands: validateBands(raw.contributionBands || DEFAULT_RULES.contributionBands),
    version: Math.max(1, Number(raw.version) || 1)
  };
}

async function loadRules(db) {
  try {
    const data = (await db.collection('systemRules').doc('business-rules').get()).data;
    return normalizeRules(data || {});
  } catch (error) {
    const message = String(error?.message || error?.errMsg || '').toLowerCase();
    if (message.includes('not exist') || message.includes('-502005') || message.includes('not found')) return normalizeRules();
    throw error;
  }
}

function bandForScore(rules, score) {
  const bounded = Math.max(0, Math.min(100, Number(score) || 0));
  return rules.contributionBands.find((band) => bounded >= band.min && bounded <= band.max) || rules.contributionBands[0];
}

function ruleSnapshot(rules) {
  return {
    completionReward: rules.completionReward,
    upheldComplaintPenalty: rules.upheldComplaintPenalty,
    inactiveExtraPenalty: rules.inactiveExtraPenalty,
    contributionBands: rules.contributionBands,
    newUserProtectionDays: 7,
    rewardTimeLimitMinutes: 10,
    contributionMin: 0,
    contributionMax: 100,
    ruleVersion: rules.version
  };
}

module.exports = { DEFAULT_RULES, normalizeRules, loadRules, bandForScore, ruleSnapshot };
