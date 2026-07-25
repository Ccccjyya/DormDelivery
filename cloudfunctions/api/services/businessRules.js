const { fail } = require('../common/response');

const DEFAULT_RULES = Object.freeze({
  _id: 'business-rules',
  contributionRewardDefault: 5,
  contributionRewardMin: 1,
  contributionRewardMax: 30,
  upheldComplaintPenalty: 25,
  initialContributionScore: 60,
  contributionMin: 0,
  contributionMax: 100,
  rewardTimeLimitMinutes: 10,
  inactivityThresholdWeeks: 2,
  inactiveExtraPenalty: 10,
  version: 2
});

function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw fail('VALIDATION_ERROR', `${name}必须为${min}到${max}的整数`);
  return value;
}

function normalizeRules(raw = {}) {
  return {
    ...DEFAULT_RULES,
    ...raw,
    _id: 'business-rules',
    contributionRewardDefault: integer(Number(raw.contributionRewardDefault ?? DEFAULT_RULES.contributionRewardDefault), 1, 30, '默认贡献值投入'),
    contributionRewardMin: 1,
    contributionRewardMax: 30,
    upheldComplaintPenalty: integer(Number(raw.upheldComplaintPenalty ?? DEFAULT_RULES.upheldComplaintPenalty), 0, 100, '投诉处罚'),
    inactiveExtraPenalty: integer(Number(raw.inactiveExtraPenalty ?? DEFAULT_RULES.inactiveExtraPenalty), 0, 100, '连续无配送处罚'),
    initialContributionScore: 60,
    contributionMin: 0,
    contributionMax: 100,
    rewardTimeLimitMinutes: 10,
    inactivityThresholdWeeks: 2,
    version: Math.max(2, Number(raw.version) || 2)
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

function ruleSnapshot(rules) {
  return {
    contributionRewardDefault: rules.contributionRewardDefault,
    upheldComplaintPenalty: rules.upheldComplaintPenalty,
    inactiveExtraPenalty: rules.inactiveExtraPenalty,
    contributionMin: 0,
    contributionMax: 100,
    rewardTimeLimitMinutes: 10,
    ruleVersion: rules.version
  };
}

module.exports = { DEFAULT_RULES, normalizeRules, loadRules, ruleSnapshot };
