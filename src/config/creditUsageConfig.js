// Centralized Credit-Based Usage & Restrictions Configuration
// NOTE: Download pricing and credit rates are configurable here because final pricing
// will be confirmed separately with Vinay sir. When confirmed, update the values below.

import { getUserCredits, setUserCredits, addTransactionRecord, getActiveUserId } from '../components/subscription/transactionHistoryStore';
import { getActiveUserPlanTier } from '../components/subscription/topUpStore';
import { API_BASE } from '../utils/api';

export const CREDIT_USAGE_CONFIG = {
  // 1. File Uploads (Audio & Video upload in Upload.jsx)
  uploads: {
    isUnlimited: true,
    creditCost: 20,
    unit: 'Files',
    description: 'Audio & Video file upload and transcription processing.'
  },

  // 1.5. Interview Question Answer Generation
  answers: {
    creditCost: 2,
    unit: 'Answers',
    description: 'AI-generated answer for interviewer questions in live interview.'
  },

  // 2. File Downloads (Transcript, PDF, Audio exports across all pages)
  downloads: {
    includedPerPlan: {
      FREE: 0,
      PRO: 0,
      PRO_PLUS: 0
    },
    creditCostPerDownload: 20,
    unit: 'Downloads',
    description: 'Plan-based download allowance. Every download deducts the configured credits.'
  },

  // 3. AI Copilot Usage
  copilot: {
    includedMinutesPerPlan: {
      FREE: 30,       // 30 minutes (0.5 hours)
      PRO: 600,       // 600 minutes (10 hours)
      PRO_PLUS: 2400  // 2400 minutes (40 hours)
    },
    // Extension block when limit is reached
    blockMinutes: 15,
    // [CONFIGURABLE]: Credit cost per 15-minute Copilot extension block
    creditCostPerBlock: 30,
    hourlyRate: 50,
    creditCostPerMinute: 2,
    unit: 'Minutes',
    description: 'Real-time AI Copilot interview assistance and teleprompter guidance.'
  },

  // 4. Voice Agent Usage
  voice: {
    intervalMinutes: 1,
    creditCost: 2,
    hourlyRate: 50,
    includedMinutesPerPlan: {
      FREE: 10,       // 10 minutes
      PRO: 90,        // 90 minutes (1.5 hours)
      PRO_PLUS: 300   // 300 minutes (5 hours)
    },
    // Extension block when limit is reached
    blockMinutes: 5,
    // [CONFIGURABLE]: Credit cost per 5-minute Voice extension block
    creditCostPerBlock: 25,
    creditCostPerMinute: 2,
    unit: 'Minutes',
    description: 'Interactive voice-to-voice mock interview simulator with live feedback.'
  },

  // 5. Notetaker Usage
  notetaker: {
    intervalMinutes: 1,
    creditCost: 2,
    hourlyRate: 50,
    unit: 'Minutes',
    description: 'Real-time audio recording and automated interview notes generation.'
  }
};

// Storage Keys scoped per active user
function getDownloadsUsedStorageKey() {
  return `copilot_downloads_used_count_v3_${getActiveUserId()}`;
}
function getCopilotMinsUsedStorageKey() {
  return `copilot_minutes_used_count_v3_${getActiveUserId()}`;
}
function getVoiceMinsUsedStorageKey() {
  return `copilot_voice_minutes_used_count_v3_${getActiveUserId()}`;
}

// -------------------------------------------------------------
// DOWNLOAD USAGE HELPERS
// -------------------------------------------------------------

export function getDownloadsUsed() {
  try {
    const val = localStorage.getItem(getDownloadsUsedStorageKey());
    if (val !== null) {
      const num = parseInt(val, 10);
      if (!isNaN(num)) return Math.max(0, num);
    }
  } catch (_) {}
  return 0;
}

export function setDownloadsUsed(count) {
  const safeCount = Math.max(0, parseInt(count, 10) || 0);
  try {
    localStorage.setItem(getDownloadsUsedStorageKey(), String(safeCount));
  } catch (_) {}
  dispatchUsageUpdated();
  return safeCount;
}

export function getDownloadLimitForTier(tier = null) {
  const activeTier = (tier || getActiveUserPlanTier() || 'FREE').toUpperCase();
  const limits = CREDIT_USAGE_CONFIG.downloads.includedPerPlan;
  return limits[activeTier] !== undefined ? limits[activeTier] : limits.FREE;
}

export { getUserCredits, setUserCredits };

// Restore cached credit rates from localStorage immediately on startup
try {
  if (typeof localStorage !== 'undefined') {
    const cachedDl = localStorage.getItem('kairos_download_credit_cost');
    if (cachedDl) {
      const n = parseInt(cachedDl, 10);
      if (!isNaN(n)) CREDIT_USAGE_CONFIG.downloads.creditCostPerDownload = n;
    }
    const cachedUp = localStorage.getItem('kairos_upload_credit_cost');
    if (cachedUp) {
      const n = parseInt(cachedUp, 10);
      if (!isNaN(n)) CREDIT_USAGE_CONFIG.uploads.creditCost = n;
    }
    const cachedAns = localStorage.getItem('kairos_answer_credit_cost');
    if (cachedAns) {
      const n = parseInt(cachedAns, 10);
      if (!isNaN(n)) CREDIT_USAGE_CONFIG.answers.creditCost = n;
    }
    const cachedVoiceInterval = localStorage.getItem('kairos_voice_interval_mins');
    if (cachedVoiceInterval) {
      const n = parseInt(cachedVoiceInterval, 10);
      if (!isNaN(n)) CREDIT_USAGE_CONFIG.voice.intervalMinutes = Math.max(1, n);
    }
    const cachedVoiceCost = localStorage.getItem('kairos_voice_credit_cost');
    if (cachedVoiceCost) {
      const n = parseInt(cachedVoiceCost, 10);
      if (!isNaN(n)) CREDIT_USAGE_CONFIG.voice.creditCost = Math.max(0, n);
    }
    const cachedNoteInterval = localStorage.getItem('kairos_notetaker_interval_mins');
    if (cachedNoteInterval) {
      const n = parseInt(cachedNoteInterval, 10);
      if (!isNaN(n)) CREDIT_USAGE_CONFIG.notetaker.intervalMinutes = Math.max(1, n);
    }
    const cachedNoteCost = localStorage.getItem('kairos_notetaker_credit_cost');
    if (cachedNoteCost) {
      const n = parseInt(cachedNoteCost, 10);
      if (!isNaN(n)) CREDIT_USAGE_CONFIG.notetaker.creditCost = Math.max(0, n);
    }
  }
} catch (_) {}

export async function fetchDynamicCreditRates() {
  try {
    const res = await fetch(`${API_BASE}/api/platform/credit-rates`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        // Apply admin-managed hourly rates to frontend pricing.
        const hourlyRateMappings = [
          ['copilotHourlyRate', CREDIT_USAGE_CONFIG.copilot],
          ['voiceHourlyRate', CREDIT_USAGE_CONFIG.voice],
          ['notetakerHourlyRate', CREDIT_USAGE_CONFIG.notetaker]
        ];

        for (const [responseKey, config] of hourlyRateMappings) {
          const rate = data[responseKey];
          if (typeof rate === 'number' && Number.isFinite(rate) && rate >= 0) {
            config.hourlyRate = rate;


          }
        }

        if (typeof data.downloadCreditCost === 'number') {
          CREDIT_USAGE_CONFIG.downloads.creditCostPerDownload = data.downloadCreditCost;
          try { localStorage.setItem('kairos_download_credit_cost', String(data.downloadCreditCost)); } catch (_) {}
        }
        if (typeof data.mediaUploadCreditCost === 'number') {
          CREDIT_USAGE_CONFIG.uploads.creditCost = data.mediaUploadCreditCost;
          try { localStorage.setItem('kairos_upload_credit_cost', String(data.mediaUploadCreditCost)); } catch (_) {}
        }
        if (typeof data.questionAnswerCreditCost === 'number') {
          CREDIT_USAGE_CONFIG.answers.creditCost = data.questionAnswerCreditCost;
          try { localStorage.setItem('kairos_answer_credit_cost', String(data.questionAnswerCreditCost)); } catch (_) {}
        }
        if (typeof data.copilotIntervalMinutes === 'number') {
          CREDIT_USAGE_CONFIG.copilot.intervalMinutes = Math.max(1, data.copilotIntervalMinutes);
          try { localStorage.setItem('kairos_copilot_interval_mins', String(data.copilotIntervalMinutes)); } catch (_) {}
        }
        if (typeof data.copilotCreditCost === 'number') {
          CREDIT_USAGE_CONFIG.copilot.creditCost = Math.max(0, data.copilotCreditCost);
          try { localStorage.setItem('kairos_copilot_credit_cost', String(data.copilotCreditCost)); } catch (_) {}
        }
        if (typeof data.copilotBillingUnit === 'string') {
          CREDIT_USAGE_CONFIG.copilot.billingUnit = data.copilotBillingUnit;
          try { localStorage.setItem('kairos_copilot_billing_unit', data.copilotBillingUnit); } catch (_) {}
        }
        if (typeof data.voiceBillingUnit === 'string') {
          CREDIT_USAGE_CONFIG.voice.billingUnit = data.voiceBillingUnit;
          try { localStorage.setItem('kairos_voice_billing_unit', data.voiceBillingUnit); } catch (_) {}
        }
        if (typeof data.notetakerBillingUnit === 'string') {
          CREDIT_USAGE_CONFIG.notetaker.billingUnit = data.notetakerBillingUnit;
          try { localStorage.setItem('kairos_notetaker_billing_unit', data.notetakerBillingUnit); } catch (_) {}
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('copilot-credit-rates-updated', { detail: data }));
        }
        if (typeof data.voiceAgentIntervalMinutes === 'number') {
          CREDIT_USAGE_CONFIG.voice.intervalMinutes = Math.max(1, data.voiceAgentIntervalMinutes);
          try { localStorage.setItem('kairos_voice_interval_mins', String(data.voiceAgentIntervalMinutes)); } catch (_) {}
        }
        if (typeof data.voiceAgentCreditCost === 'number') {
          CREDIT_USAGE_CONFIG.voice.creditCost = Math.max(0, data.voiceAgentCreditCost);
          try { localStorage.setItem('kairos_voice_credit_cost', String(data.voiceAgentCreditCost)); } catch (_) {}
        }
        if (typeof data.notetakerIntervalMinutes === 'number') {
          CREDIT_USAGE_CONFIG.notetaker.intervalMinutes = Math.max(1, data.notetakerIntervalMinutes);
          try { localStorage.setItem('kairos_notetaker_interval_mins', String(data.notetakerIntervalMinutes)); } catch (_) {}
        }
        if (typeof data.notetakerCreditCost === 'number') {
          CREDIT_USAGE_CONFIG.notetaker.creditCost = Math.max(0, data.notetakerCreditCost);
          try { localStorage.setItem('kairos_notetaker_credit_cost', String(data.notetakerCreditCost)); } catch (_) {}
        }
        return data;
      }
    }
  } catch (_) {}
  return {
    downloadCreditCost: CREDIT_USAGE_CONFIG.downloads.creditCostPerDownload,
    mediaUploadCreditCost: CREDIT_USAGE_CONFIG.uploads.creditCost,
    questionAnswerCreditCost: CREDIT_USAGE_CONFIG.answers.creditCost,
    voiceAgentIntervalMinutes: CREDIT_USAGE_CONFIG.voice.intervalMinutes,
    voiceAgentCreditCost: CREDIT_USAGE_CONFIG.voice.creditCost,
    notetakerIntervalMinutes: CREDIT_USAGE_CONFIG.notetaker.intervalMinutes,
    notetakerCreditCost: CREDIT_USAGE_CONFIG.notetaker.creditCost
  };
}

if (typeof window !== 'undefined') {
  fetchDynamicCreditRates();
  window.addEventListener('focus', () => { fetchDynamicCreditRates(); });
}

export function getDownloadStatus(tier = null) {
  const cost = CREDIT_USAGE_CONFIG.downloads.creditCostPerDownload;
  const userBalance = getUserCredits();
  const canAffordWithCredits = userBalance >= cost;

  return {
    limit: 0,
    used: getDownloadsUsed(),
    remaining: 0,
    hasIncluded: false,
    creditCost: cost,
    userBalance,
    canAffordWithCredits,
    activeTier: (tier || getActiveUserPlanTier() || 'FREE').toUpperCase()
  };
}

export async function recordDownloadAction({ fileType = 'Document', fileName = '', token = null } = {}) {
  const cost = CREDIT_USAGE_CONFIG.downloads.creditCostPerDownload;
  const userBalance = getUserCredits();

  // Instant local credit check: if user definitely lacks credits, abort with zero delay
  if (userBalance < cost) {
    return {
      success: false,
      needCredits: true,
      creditsRequired: cost,
      creditsAvailable: userBalance,
      message: `Insufficient credits. Need ${cost} credits, you have ${userBalance}.`
    };
  }

  const effectiveToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null);
  if (effectiveToken) {
    try {
      const res = await fetch(`${API_BASE}/api/credits/deduct/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({ fileType, fileName })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        if (data.needCredits || res.status === 402) {
          return {
            success: false,
            needCredits: true,
            creditsRequired: data.creditsRequired || cost,
            creditsAvailable: data.creditsAvailable !== undefined ? data.creditsAvailable : userBalance,
            message: data.error || `Insufficient credits. Need ${cost} credits.`
          };
        }
      } else if (data.ok) {
        const deducted = data.creditsDeducted || cost;
        const newBal = typeof data.newBalance === 'number' ? data.newBalance : Math.max(0, userBalance - deducted);
        setUserCredits(newBal);
        setDownloadsUsed(getDownloadsUsed() + 1);
        addTransactionRecord({
          type: 'Feature Usage (Credits)',
          planOrPackage: `${fileType} Download`,
          creditsAdded: 0,
          creditsUsed: deducted,
          amount: 0,
          currency: 'USD',
          currencySymbol: '$',
          paymentMethod: 'Credits Balance',
          methodCode: 'credits',
          status: 'Successful',
          referenceId: `DL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance: newBal } }));
        return {
          success: true,
          usedCredits: true,
          creditsDeducted: deducted,
          newBalance: newBal,
          message: `Download processed via credits (${deducted} credits deducted)`
        };
      }
    } catch (_) {}
  }

  // Fallback to local balance check
  if (userBalance < cost) {
    return {
      success: false,
      needCredits: true,
      creditsRequired: cost,
      creditsAvailable: userBalance,
      message: `Insufficient credits. Need ${cost} credits, you have ${userBalance}.`
    };
  }

  const newBalance = setUserCredits(userBalance - cost);
  setDownloadsUsed(getDownloadsUsed() + 1);
  addTransactionRecord({
    type: 'Feature Usage (Credits)',
    planOrPackage: `${fileType} Download`,
    creditsAdded: 0,
    creditsUsed: cost,
    amount: 0,
    currency: 'USD',
    currencySymbol: '$',
    paymentMethod: 'Credits Balance',
    methodCode: 'credits',
    status: 'Successful',
    referenceId: `DL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  });
  window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance } }));

  return {
    success: true,
    usedCredits: true,
    creditsDeducted: cost,
    newBalance,
    message: `Download processed via credits (${cost} credits deducted)`
  };
}

export function getUploadStatus() {
  const cost = CREDIT_USAGE_CONFIG.uploads.creditCost;
  const userBalance = getUserCredits();
  const canAffordWithCredits = userBalance >= cost;
  return {
    creditCost: cost,
    userBalance,
    canAffordWithCredits
  };
}

export async function recordUploadAction({ mediaType = 'audio', fileName = '', token = null } = {}) {
  const cost = CREDIT_USAGE_CONFIG.uploads.creditCost;
  const userBalance = getUserCredits();

  // Instant local credit check: if user definitely lacks credits, abort with zero delay
  if (userBalance < cost) {
    return {
      success: false,
      needCredits: true,
      creditsRequired: cost,
      creditsAvailable: userBalance,
      message: `Insufficient credits. Need ${cost} credits, you have ${userBalance}.`
    };
  }

  const effectiveToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null);
  if (effectiveToken) {
    try {
      const res = await fetch(`${API_BASE}/api/credits/deduct/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({ mediaType, fileName })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        if (data.needCredits || res.status === 402) {
          return {
            success: false,
            needCredits: true,
            creditsRequired: data.creditsRequired || cost,
            creditsAvailable: data.creditsAvailable !== undefined ? data.creditsAvailable : userBalance,
            message: data.error || `Insufficient credits. Need ${cost} credits.`
          };
        }
      } else if (data.ok) {
        const deducted = data.creditsDeducted || cost;
        const newBal = typeof data.newBalance === 'number' ? data.newBalance : Math.max(0, userBalance - deducted);
        setUserCredits(newBal);
        addTransactionRecord({
          type: 'Feature Usage (Credits)',
          planOrPackage: `${mediaType === 'video' ? 'Video' : 'Audio'} Upload`,
          creditsAdded: 0,
          creditsUsed: deducted,
          amount: 0,
          currency: 'USD',
          currencySymbol: '$',
          paymentMethod: 'Credits Balance',
          methodCode: 'credits',
          status: 'Successful',
          referenceId: `UP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance: newBal } }));
        return {
          success: true,
          usedCredits: true,
          creditsDeducted: deducted,
          newBalance: newBal,
          message: `Upload processed via credits (${deducted} credits deducted)`
        };
      }
    } catch (_) {}
  }

  // Fallback to local balance check
  if (userBalance < cost) {
    return {
      success: false,
      needCredits: true,
      creditsRequired: cost,
      creditsAvailable: userBalance,
      message: `Insufficient credits. Need ${cost} credits, you have ${userBalance}.`
    };
  }

  const newBalance = setUserCredits(userBalance - cost);
  addTransactionRecord({
    type: 'Feature Usage (Credits)',
    planOrPackage: `${mediaType === 'video' ? 'Video' : 'Audio'} Upload`,
    creditsAdded: 0,
    creditsUsed: cost,
    amount: 0,
    currency: 'USD',
    currencySymbol: '$',
    paymentMethod: 'Credits Balance',
    methodCode: 'credits',
    status: 'Successful',
    referenceId: `UP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  });
  window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance } }));

  return {
    success: true,
    usedCredits: true,
    creditsDeducted: cost,
    newBalance,
    message: `Upload processed via credits (${cost} credits deducted)`
  };
}

export async function recordAnswerAction({ question = '', token = null } = {}) {
  const cost = CREDIT_USAGE_CONFIG.answers.creditCost;
  const userBalance = getUserCredits();

  // Instant local credit check: if user definitely lacks credits, abort with zero delay
  if (userBalance < cost) {
    return {
      success: false,
      needCredits: true,
      creditsRequired: cost,
      creditsAvailable: userBalance,
      message: `Insufficient credits for answer generation. Need ${cost} credits, you have ${userBalance}.`
    };
  }

  const effectiveToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null);
  if (effectiveToken) {
    try {
      const res = await fetch(`${API_BASE}/api/credits/deduct/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        if (data.needCredits || res.status === 402) {
          return {
            success: false,
            needCredits: true,
            creditsRequired: data.creditsRequired || cost,
            creditsAvailable: data.creditsAvailable !== undefined ? data.creditsAvailable : userBalance,
            message: data.error || `Insufficient credits. Need ${cost} credits.`
          };
        }
      } else if (data.ok) {
        const deducted = data.creditsDeducted || cost;
        const newBal = typeof data.newBalance === 'number' ? data.newBalance : Math.max(0, userBalance - deducted);
        setUserCredits(newBal);
        addTransactionRecord({
          type: 'Feature Usage (Credits)',
          planOrPackage: 'Interview Answer Generation',
          creditsAdded: 0,
          creditsUsed: deducted,
          amount: 0,
          currency: 'USD',
          currencySymbol: '$',
          paymentMethod: 'Credits Balance',
          methodCode: 'credits',
          status: 'Successful',
          referenceId: `ANS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance: newBal } }));
        return {
          success: true,
          usedCredits: true,
          creditsDeducted: deducted,
          newBalance: newBal,
          message: `Answer generated (${deducted} credits deducted)`
        };
      }
    } catch (_) {}
  }

  // Fallback to local balance deduction
  const newBalance = setUserCredits(Math.max(0, userBalance - cost));
  addTransactionRecord({
    type: 'Feature Usage (Credits)',
    planOrPackage: 'Interview Answer Generation',
    creditsAdded: 0,
    creditsUsed: cost,
    amount: 0,
    currency: 'USD',
    currencySymbol: '$',
    paymentMethod: 'Credits Balance',
    methodCode: 'credits',
    status: 'Successful',
    referenceId: `ANS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  });
  window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance } }));

  return {
    success: true,
    usedCredits: true,
    creditsDeducted: cost,
    newBalance,
    message: `Answer generated (${cost} credits deducted)`
  };
}

// -------------------------------------------------------------
// COPILOT USAGE HELPERS
// -------------------------------------------------------------

export function getCopilotMinutesUsed() {
  try {
    const val = localStorage.getItem(getCopilotMinsUsedStorageKey());
    if (val !== null) {
      const num = parseInt(val, 10);
      if (!isNaN(num)) return Math.max(0, num);
    }
  } catch (_) {}
  return 0;
}

export function setCopilotMinutesUsed(mins) {
  const safeMins = Math.max(0, parseInt(mins, 10) || 0);
  try {
    localStorage.setItem(getCopilotMinsUsedStorageKey(), String(safeMins));
  } catch (_) {}
  dispatchUsageUpdated();
  return safeMins;
}

export function getCopilotStatus(tier = null) {
  const activeTier = (tier || getActiveUserPlanTier() || 'FREE').toUpperCase();
  const limit = CREDIT_USAGE_CONFIG.copilot.includedMinutesPerPlan[activeTier] || 30;
  const used = getCopilotMinutesUsed();
  const hasIncluded = used < limit;
  const remainingMinutes = Math.max(0, limit - used);
  const blockMinutes = CREDIT_USAGE_CONFIG.copilot.blockMinutes;
  const creditCost = CREDIT_USAGE_CONFIG.copilot.creditCostPerBlock;
  const userBalance = getUserCredits();
  const canAffordWithCredits = userBalance >= creditCost;

  return {
    limit,
    used,
    hasIncluded,
    remainingMinutes,
    blockMinutes,
    creditCost,
    userBalance,
    canAffordWithCredits,
    activeTier
  };
}

export function extendCopilotWithCredits({ blockMinutes = null } = {}) {
  const status = getCopilotStatus();
  const cost = status.creditCost;
  const extensionMinutes = blockMinutes || status.blockMinutes;

  if (status.userBalance < cost) {
    return {
      success: false,
      creditsRequired: cost,
      creditsAvailable: status.userBalance,
      message: `Insufficient credits. Need ${cost} credits, you have ${status.userBalance}.`
    };
  }

  const newBalance = setUserCredits(status.userBalance - cost);
  addTransactionRecord({
    type: 'Feature Usage (Credits)',
    planOrPackage: `AI Copilot +${extensionMinutes} Mins Extension`,
    creditsAdded: 0,
    creditsUsed: cost,
    amount: 0,
    currency: 'USD',
    currencySymbol: '$',
    paymentMethod: 'Credits Balance',
    methodCode: 'credits',
    status: 'Successful',
    referenceId: `CP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  });

  return {
    success: true,
    addedMinutes: extensionMinutes,
    creditsDeducted: cost,
    newBalance,
    message: `Added +${extensionMinutes} AI Copilot minutes with ${cost} credits!`
  };
}

// -------------------------------------------------------------
// VOICE USAGE HELPERS
// -------------------------------------------------------------

export function getVoiceMinutesUsed() {
  try {
    const val = localStorage.getItem(getVoiceMinsUsedStorageKey());
    if (val !== null) {
      const num = parseInt(val, 10);
      if (!isNaN(num)) return Math.max(0, num);
    }
  } catch (_) {}
  return 0;
}

export function setVoiceMinutesUsed(mins) {
  const safeMins = Math.max(0, parseInt(mins, 10) || 0);
  try {
    localStorage.setItem(getVoiceMinsUsedStorageKey(), String(safeMins));
  } catch (_) {}
  dispatchUsageUpdated();
  return safeMins;
}

export function getVoiceStatus(tier = null) {
  const activeTier = (tier || getActiveUserPlanTier() || 'FREE').toUpperCase();
  const limit = CREDIT_USAGE_CONFIG.voice.includedMinutesPerPlan[activeTier] || 10;
  const used = getVoiceMinutesUsed();
  const hasIncluded = used < limit;
  const remainingMinutes = Math.max(0, limit - used);
  const blockMinutes = CREDIT_USAGE_CONFIG.voice.blockMinutes;
  const creditCost = CREDIT_USAGE_CONFIG.voice.creditCostPerBlock;
  const userBalance = getUserCredits();
  const canAffordWithCredits = userBalance >= creditCost;

  return {
    limit,
    used,
    hasIncluded,
    remainingMinutes,
    blockMinutes,
    creditCost,
    userBalance,
    canAffordWithCredits,
    activeTier
  };
}

export function extendVoiceWithCredits({ blockMinutes = null } = {}) {
  const status = getVoiceStatus();
  const cost = status.creditCost;
  const extensionMinutes = blockMinutes || status.blockMinutes;

  if (status.userBalance < cost) {
    return {
      success: false,
      creditsRequired: cost,
      creditsAvailable: status.userBalance,
      message: `Insufficient credits. Need ${cost} credits, you have ${status.userBalance}.`
    };
  }

  const newBalance = setUserCredits(status.userBalance - cost);
  addTransactionRecord({
    type: 'Feature Usage (Credits)',
    planOrPackage: `Voice Simulator +${extensionMinutes} Mins Extension`,
    creditsAdded: 0,
    creditsUsed: cost,
    amount: 0,
    currency: 'USD',
    currencySymbol: '$',
    paymentMethod: 'Credits Balance',
    methodCode: 'credits',
    status: 'Successful',
    referenceId: `VC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  });

  return {
    success: true,
    addedMinutes: extensionMinutes,
    creditsDeducted: cost,
    newBalance,
    message: `Added +${extensionMinutes} Voice minutes with ${cost} credits!`
  };
}

// -------------------------------------------------------------
// EVENT DISPATCHER
// -------------------------------------------------------------

function dispatchUsageUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('copilot-usage-updated', {
      detail: {
        timestamp: Date.now()
      }
    }));
  }
}

/**
 * Dynamically updates plan limits in CREDIT_USAGE_CONFIG when fetched from live API.
 */
export function updateDynamicPlanLimits(plans) {
  if (!Array.isArray(plans)) return;
  plans.forEach((p) => {
    const raw = String(p.code || p.tier || p.id || '').toUpperCase();
    const tier = (raw === 'FREE' || raw.startsWith('FREE')) ? 'FREE' : (raw === 'PRO_PLUS' || raw === 'PROPLUS' || raw.includes('PRO_PLUS') || raw.includes('PRO PLUS')) ? 'PRO_PLUS' : (raw === 'PRO' || raw.startsWith('PRO')) ? 'PRO' : raw;
    if (!tier) return;
    if (p.downloadLimit !== undefined && p.downloadLimit !== null) {
      CREDIT_USAGE_CONFIG.downloads.includedPerPlan[tier] = Number(p.downloadLimit);
    } else if (p.downloadsIncluded !== undefined && p.downloadsIncluded !== null) {
      CREDIT_USAGE_CONFIG.downloads.includedPerPlan[tier] = Number(p.downloadsIncluded);
    }
    if (p.copilotMinutes !== undefined && p.copilotMinutes !== null) {
      CREDIT_USAGE_CONFIG.copilot.includedMinutesPerPlan[tier] = Number(p.copilotMinutes);
    }
    if (p.voiceMinutes !== undefined && p.voiceMinutes !== null) {
      CREDIT_USAGE_CONFIG.voice.includedMinutesPerPlan[tier] = Number(p.voiceMinutes);
    }
  });
  dispatchUsageUpdated();
}

export function getVoiceIntervalMinutes() {
  return CREDIT_USAGE_CONFIG.voice.intervalMinutes || 1;
}

export function getVoiceCreditCost() {
  return typeof CREDIT_USAGE_CONFIG.voice.creditCost === 'number' ? CREDIT_USAGE_CONFIG.voice.creditCost : 2;
}

export async function recordVoiceUsageAction({
  minutesElapsed = 1,
  sessionId = null,
  elapsedSeconds = null,
  token = null,
} = {}) {
  const intervalMins = getVoiceIntervalMinutes();
  const costPerInterval = getVoiceCreditCost();
  const minutes = Math.max(1, Number(minutesElapsed) || intervalMins);
  const intervals = Math.max(1, Math.floor(minutes / intervalMins));
  const cost = intervals * costPerInterval;
  const userBalance = getUserCredits();

  // Instant local credit check: if user definitely lacks credits, abort with zero delay
  if (userBalance < cost) {
    return {
      success: false,
      needCredits: true,
      creditsRequired: cost,
      creditsAvailable: userBalance,
      message: `Insufficient credits for Voice Agent session. Need ${cost} credits, you have ${userBalance}.`
    };
  }

  const effectiveToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null);
  if (effectiveToken) {
    try {
      const res = await fetch(`${API_BASE}/api/credits/deduct/voice-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          minutesElapsed: minutes,
          sessionId,
          elapsedSeconds,
        })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        if (data.needCredits || res.status === 402) {
          return {
            success: false,
            needCredits: true,
            creditsRequired: data.creditsRequired || cost,
            creditsAvailable: data.creditsAvailable !== undefined ? data.creditsAvailable : userBalance,
            message: data.error || `Insufficient credits. Need ${cost} credits.`
          };
        }
      } else if (data.ok) {
        const deducted = data.creditsDeducted !== undefined ? data.creditsDeducted : cost;
        const newBal = typeof data.newBalance === 'number' ? data.newBalance : Math.max(0, userBalance - deducted);
        setUserCredits(newBal);
        addTransactionRecord({
          type: 'Feature Usage (Credits)',
          planOrPackage: `Voice Agent Mock Interview (${minutes} min${minutes === 1 ? '' : 's'})`,
          creditsAdded: 0,
          creditsUsed: deducted,
          amount: 0,
          currency: 'USD',
          currencySymbol: '$',
          paymentMethod: 'Credits Balance',
          methodCode: 'credits',
          status: 'Successful',
          referenceId: `VOX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance: newBal } }));
        return {
          success: true,
          usedCredits: true,
          creditsDeducted: deducted,
          newBalance: newBal,
          message: `Voice Agent session (${deducted} credits deducted)`
        };
      }
    } catch (_) {}
  }

  // Fallback to local balance deduction
  const newBalance = setUserCredits(Math.max(0, userBalance - cost));
  addTransactionRecord({
    type: 'Feature Usage (Credits)',
    planOrPackage: `Voice Agent Mock Interview (${minutes} min${minutes === 1 ? '' : 's'})`,
    creditsAdded: 0,
    creditsUsed: cost,
    amount: 0,
    currency: 'USD',
    currencySymbol: '$',
    paymentMethod: 'Credits Balance',
    methodCode: 'credits',
    status: 'Successful',
    referenceId: `VOX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  });
  window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance } }));

  return {
    success: true,
    usedCredits: true,
    creditsDeducted: cost,
    newBalance,
    message: `Voice Agent session (${cost} credits deducted)`
  };
}

export function getNotetakerIntervalMinutes() {
  return CREDIT_USAGE_CONFIG.notetaker?.intervalMinutes || 1;
}

export function getNotetakerCreditCost() {
  return typeof CREDIT_USAGE_CONFIG.notetaker?.creditCost === 'number' ? CREDIT_USAGE_CONFIG.notetaker.creditCost : 2;
}

export async function recordNotetakerUsageAction({
  minutesElapsed = 1,
  sessionId = null,
  elapsedSeconds = null,
  token = null,
} = {}) {
  const intervalMins = getNotetakerIntervalMinutes();
  const costPerInterval = getNotetakerCreditCost();
  const minutes = Math.max(1, Number(minutesElapsed) || intervalMins);
  const intervals = Math.max(1, Math.floor(minutes / intervalMins));
  const cost = intervals * costPerInterval;
  const userBalance = getUserCredits();

  // Instant local credit check: if user definitely lacks credits, abort with zero delay
  if (userBalance < cost) {
    return {
      success: false,
      needCredits: true,
      creditsRequired: cost,
      creditsAvailable: userBalance,
      message: `Insufficient credits for Notetaker session. Need ${cost} credits, you have ${userBalance}.`
    };
  }

  const effectiveToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null);
  if (effectiveToken) {
    try {
      const res = await fetch(`${API_BASE}/api/credits/deduct/notetaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          minutesElapsed: minutes,
          sessionId,
          elapsedSeconds,
        })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        if (data.needCredits || res.status === 402) {
          return {
            success: false,
            needCredits: true,
            creditsRequired: data.creditsRequired || cost,
            creditsAvailable: data.creditsAvailable !== undefined ? data.creditsAvailable : userBalance,
            message: data.error || `Insufficient credits. Need ${cost} credits.`
          };
        }
      } else if (data.ok) {
        const deducted = data.creditsDeducted !== undefined ? data.creditsDeducted : cost;
        const newBal = typeof data.newBalance === 'number' ? data.newBalance : Math.max(0, userBalance - deducted);
        setUserCredits(newBal);
        addTransactionRecord({
          type: 'Feature Usage (Credits)',
          planOrPackage: `Notetaker Session (${minutes} min${minutes === 1 ? '' : 's'})`,
          creditsAdded: 0,
          creditsUsed: deducted,
          amount: 0,
          currency: 'USD',
          currencySymbol: '$',
          paymentMethod: 'Credits Balance',
          methodCode: 'credits',
          status: 'Successful',
          referenceId: `NOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance: newBal } }));
        return {
          success: true,
          usedCredits: true,
          creditsDeducted: deducted,
          newBalance: newBal,
          message: `Notetaker session (${deducted} credits deducted)`
        };
      }
    } catch (_) {}
  }

  // Fallback to local balance deduction
  if (sessionId && Number.isSafeInteger(elapsedSeconds)) {
    return {
      success: false,
      needCredits: false,
      message: 'Session billing could not be confirmed by the server. Please retry.',
    };
  }
  const newBalance = setUserCredits(Math.max(0, userBalance - cost));
  addTransactionRecord({
    type: 'Feature Usage (Credits)',
    planOrPackage: `Notetaker Session (${minutes} min${minutes === 1 ? '' : 's'})`,
    creditsAdded: 0,
    creditsUsed: cost,
    amount: 0,
    currency: 'USD',
    currencySymbol: '$',
    paymentMethod: 'Credits Balance',
    methodCode: 'credits',
    status: 'Successful',
    referenceId: `NOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  });
  window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance } }));

  return {
    success: true,
    usedCredits: true,
    creditsDeducted: cost,
    newBalance,
    message: `Notetaker session (${cost} credits deducted)`
  };
}





export function getCopilotIntervalMinutes() {
  return CREDIT_USAGE_CONFIG.copilot?.intervalMinutes || 1;
}

export function getCopilotCreditCost() {
  return typeof CREDIT_USAGE_CONFIG.copilot?.creditCost === 'number' ? CREDIT_USAGE_CONFIG.copilot.creditCost : 2;
}

export function getFeatureBillingConfig(featureKey = 'copilot') {
  const cfg = CREDIT_USAGE_CONFIG[featureKey] || CREDIT_USAGE_CONFIG.copilot || {};
  const billingUnit = String(cfg.billingUnit || 'hours').toLowerCase();
  const interval = Math.max(1, Number(cfg.intervalMinutes) || 1);
  let creditCost = 50;
  if (billingUnit === 'minutes') {
    creditCost = typeof cfg.creditCost === 'number' ? cfg.creditCost : 2;
  } else {
    creditCost = typeof cfg.hourlyRate === 'number' ? cfg.hourlyRate : (typeof cfg.creditCost === 'number' ? cfg.creditCost : 50);
  }
  const unitLabelSingular = billingUnit === 'minutes' ? 'Minute' : billingUnit === 'days' ? 'Day' : 'Hour';
  const unitLabelPlural = billingUnit === 'minutes' ? 'Minutes' : billingUnit === 'days' ? 'Days' : 'Hours';
  const unitShort = billingUnit === 'minutes' ? 'min' : billingUnit === 'days' ? 'day' : 'hr';
  const unitMinutesMultiplier = billingUnit === 'minutes' ? 1 : billingUnit === 'days' ? 1440 : 60;

  return {
    billingUnit,
    interval,
    creditCost,
    unitLabelSingular,
    unitLabelPlural,
    unitShort,
    unitMinutesMultiplier
  };
}

export async function recordCopilotUsageAction({
  minutesElapsed = 1,
  sessionId = null,
  elapsedSeconds = null,
  token = null
} = {}) {
  const intervalMins = getCopilotIntervalMinutes();
  const costPerInterval = getCopilotCreditCost();
  const minutes = Math.max(1, Number(minutesElapsed) || intervalMins);
  const intervals = Math.max(1, Math.floor(minutes / intervalMins));
  const cost = intervals * costPerInterval;
  const userBalance = getUserCredits();

  if ((!sessionId || !Number.isSafeInteger(elapsedSeconds)) && userBalance < cost) {
    return {
      success: false,
      needCredits: true,
      creditsRequired: cost,
      creditsAvailable: userBalance,
      message: `Insufficient credits for AI Copilot session. Need ${cost} credits, you have ${userBalance}.`
    };
  }

  const effectiveToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null);
  if (effectiveToken) {
    try {
      const res = await fetch(`${API_BASE}/api/credits/deduct/copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          minutesElapsed: minutes,
          sessionId,
          elapsedSeconds
        })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        if (data.needCredits || res.status === 402) {
          return {
            success: false,
            needCredits: true,
            creditsRequired: data.creditsRequired || cost,
            creditsAvailable: data.creditsAvailable !== undefined ? data.creditsAvailable : userBalance,
            message: data.error || `Insufficient credits. Need ${cost} credits.`
          };
        }
      } else if (data.ok) {
        const deducted = data.creditsDeducted !== undefined ? data.creditsDeducted : cost;
        const newBal = typeof data.newBalance === 'number' ? data.newBalance : Math.max(0, userBalance - deducted);
        setUserCredits(newBal);
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance: newBal } }));
        return {
          success: true,
          usedCredits: true,
          creditsDeducted: deducted,
          newBalance: newBal,
          message: `Copilot session (${deducted} credits deducted)`
        };
      }
    } catch (_) {}
  }

  if (sessionId && Number.isSafeInteger(elapsedSeconds)) {
    return {
      success: false,
      needCredits: false,
      message: 'Session billing could not be confirmed by the server. Please retry.'
    };
  }

  const newBalance = setUserCredits(Math.max(0, userBalance - cost));
  window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { newBalance } }));
  return {
    success: true,
    usedCredits: true,
    creditsDeducted: cost,
    newBalance,
    message: `Copilot session (${cost} credits deducted)`
  };
}
