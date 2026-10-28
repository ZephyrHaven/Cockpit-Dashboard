// ai-plan.js — Agent 的有界任务计划工具，模型只能更新当前轮步骤状态。

const AI_AGENT_PLAN_LIMIT = 8;

function normalizeCockpitAgentPlan(value) {
  if (!Array.isArray(value) || !value.length || value.length > AI_AGENT_PLAN_LIMIT) throw new Error('A plan must contain 1 to 8 steps.');
  const steps = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Each plan step must be an object.');
    const text = String(item.text || '').replace(/[\0\r\n]+/g, ' ').trim();
    const status = String(item.status || 'pending');
    if (!text || text.length > 160 || !['pending','in_progress','completed'].includes(status)) throw new Error('A plan step has invalid text or status.');
    return { text, status };
  });
  if (steps.filter((step) => step.status === 'in_progress').length > 1) throw new Error('Only one plan step may be in progress.');
  return steps;
}

class CockpitAgentPlanRegistry {
  definitions() {
    return [{ type:'function', function:{
      name:'agent_update_plan',
      description:'Publish or update a concise task plan for a multi-step request. Call again when a step changes state. This does not modify files or task data.',
      parameters:{ type:'object', additionalProperties:false, required:['steps'], properties:{
        steps:{ type:'array', minItems:1, maxItems:AI_AGENT_PLAN_LIMIT, items:{ type:'object', additionalProperties:false, required:['text','status'], properties:{
          text:{ type:'string', minLength:1, maxLength:160 },
          status:{ type:'string', enum:['pending','in_progress','completed'] }
        } } }
      } }
    } }];
  }
  describe(name) { return name === 'agent_update_plan' ? { name, label:'任务计划', description:'更新当前轮的任务步骤', mutates:false } : null; }
  environment() { return 'For multi-step work, call agent_update_plan with short steps before acting and update it as work progresses. Mark only verified steps completed.'; }
  execute(name, args) {
    if (name !== 'agent_update_plan') return null;
    if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some((key) => key !== 'steps')) throw new Error('Invalid plan arguments.');
    return { ok:true, data:{ steps:normalizeCockpitAgentPlan(args.steps) } };
  }
}

function createCockpitAgentPlanRegistry() { return new CockpitAgentPlanRegistry(); }

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { AI_AGENT_PLAN_LIMIT, normalizeCockpitAgentPlan, CockpitAgentPlanRegistry, createCockpitAgentPlanRegistry };
