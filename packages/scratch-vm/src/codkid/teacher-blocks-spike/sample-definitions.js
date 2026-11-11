/**
 * CodKid SPIKE (throwaway): sample teacher block definitions.
 * The real definitions will come from the API. The body uses a tiny tree format
 * that inject.js turns into VM blocks:
 *   statement: {op, inputs?, fields?, substack?, mutation?}
 *   input:     number | string | {arg: '<input name>'} | {op, inputs?}
 *   field:     string | {variable: '<variable name>'}
 */

const WALK_V1 = {
    id: 'walk',
    version: 1,
    warp: false,
    text: 'Walk [STEPS] steps',
    inputs: [{name: 'STEPS', type: 'number', default: 1}],
    variables: [],
    body: [
        {op: 'motion_movesteps', inputs: {STEPS: {op: 'operator_multiply', inputs: {NUM1: {arg: 'STEPS'}, NUM2: 10}}}},
        {op: 'looks_nextcostume'}
    ]
};

const ADD_SCORE_V1 = {
    id: 'addScore',
    version: 1,
    warp: false,
    text: 'Add Score [POINTS]',
    inputs: [{name: 'POINTS', type: 'number', default: 1}],
    variables: [{name: 'Score', stage: true}],
    body: [
        {op: 'data_changevariableby', fields: {VARIABLE: {variable: 'Score'}}, inputs: {VALUE: {arg: 'POINTS'}}}
    ]
};

const CRABBY_SAYS_V1 = {
    id: 'crabbySays',
    version: 1,
    warp: false,
    text: 'Start! Crabby says... [MESSAGE]',
    inputs: [{name: 'MESSAGE', type: 'string', default: 'start'}],
    variables: [],
    body: [
        {op: 'looks_sayforsecs', inputs: {MESSAGE: {arg: 'MESSAGE'}, SECS: 2}}
    ]
};

// A newer catalog: Walk is now v2 (new label, x20) and Add Score was deleted.
const WALK_V2 = {
    id: 'walk',
    version: 2,
    warp: false,
    text: 'Walk [STEPS] big steps',
    inputs: [{name: 'STEPS', type: 'number', default: 1}],
    variables: [],
    body: [
        {op: 'motion_movesteps', inputs: {STEPS: {op: 'operator_multiply', inputs: {NUM1: {arg: 'STEPS'}, NUM2: 20}}}},
        {op: 'looks_nextcostume'}
    ]
};

const CATALOGS = {
    v1: [WALK_V1, ADD_SCORE_V1, CRABBY_SAYS_V1],
    next: [WALK_V2, CRABBY_SAYS_V1]
};

module.exports = {
    WALK_V1,
    ADD_SCORE_V1,
    CRABBY_SAYS_V1,
    WALK_V2,
    CATALOGS
};
