const { MODELS } = require("./models");

/*
  Theo AI model router.

  The router is local and does NOT use an AI request
  to decide which model to use.
*/

function classifyMessage(message) {
  const text = String(message || "").toLowerCase();

  /*
    Expert requests:
    Very difficult technical, mathematical, architectural,
    or highly analytical requests.
  */
  const expertPatterns = [
    /\bprove\b/,
    /\bformal proof\b/,
    /\bcomplex algorithm\b/,
    /\barchitecture\b/,
    /\bdebug.*complex\b/,
    /\badvanced.*code\b/,
    /\bsecurity audit\b/,
    /\bdeep analysis\b/,
    /\bvery complex\b/,
    /\bsolve.*difficult\b/
  ];

  if (expertPatterns.some(pattern => pattern.test(text))) {
    return "expert";
  }

  /*
    Reasoning requests:
    Coding, debugging, calculations, comparisons,
    planning, analysis, and technical questions.
  */
  const reasoningPatterns = [
    /\bcode\b/,
    /\bcoding\b/,
    /\bprogram\b/,
    /\bjavascript\b/,
    /\bnode\.?js\b/,
    /\bpython\b/,
    /\btypescript\b/,
    /\bhtml\b/,
    /\bcss\b/,
    /\bapi\b/,
    /\bdatabase\b/,
    /\bsql\b/,
    /\bdebug\b/,
    /\berror\b/,
    /\bcalculate\b/,
    /\bcalculation\b/,
    /\bmath\b/,
    /\bcompare\b/,
    /\bcomparison\b/,
    /\banalyze\b/,
    /\banalysis\b/,
    /\bexplain.*technical\b/,
    /\bstep by step\b/
  ];

  if (reasoningPatterns.some(pattern => pattern.test(text))) {
    return "reasoning";
  }

  return "primary";
}

function getModelForMessage(message) {
  const route = classifyMessage(message);

  return {
    route,
    model: MODELS[route]
  };
}

function getFallbackModels(route) {
  const fallbackOrder = {
    primary: [
      MODELS.primary,
      MODELS.reasoning,
      MODELS.expert
    ],

    reasoning: [
      MODELS.reasoning,
      MODELS.primary,
      MODELS.expert
    ],

    expert: [
      MODELS.expert,
      MODELS.reasoning,
      MODELS.primary
    ]
  };

  return fallbackOrder[route] || fallbackOrder.primary;
}

module.exports = {
  classifyMessage,
  getModelForMessage,
  getFallbackModels
};
