/**
 * CodKid teacher blocks: test helpers.
 *
 * Teacher block bodies use the .sb3 block format (docs/teacher-block-schema.md). Writing that by
 * hand is long, so tests describe scripts as small trees and `scriptToSb3` turns them into sb3
 * blocks:
 *   statement: {op, inputs?, fields?, substack?, mutation?}
 *   input:     number | string | {arg: '<input name>'} | {op, inputs?, fields?}
 *              A block input gets a number shadow; add `shadow: 'text'` for a text shadow.
 *   field:     string | {variable: '<name>'} | {list: '<name>'} | {broadcast: '<name>'}
 */
const sb3 = require('../../src/serialization/sb3');
const {opcodeOf, proccodeOf} = require('../../src/codkid/teacher-blocks/opcode');

const MATH_NUM = 4;
const TEXT = 10;

class Sb3ScriptBuilder {
    /**
     * @param {string} prefix - block ids are `<prefix><n>`, so output is stable.
     */
    constructor (prefix) {
        this.prefix = prefix;
        this.count = 0;
        this.blocks = {};
    }

    nextId () {
        this.count++;
        return `${this.prefix}${this.count}`;
    }

    add (id, block) {
        this.blocks[id] = Object.assign({
            opcode: block.opcode,
            next: null,
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: false
        }, block);
        return this.blocks[id];
    }

    input (value, parentId) {
        if (typeof value === 'number') return [1, [MATH_NUM, String(value)]];
        if (typeof value === 'string') return [1, [TEXT, value]];
        const id = this.nextId();
        if (value.arg) {
            this.add(id, {
                opcode: 'argument_reporter_string_number',
                parent: parentId,
                fields: {VALUE: [value.arg, null]}
            });
        } else {
            this.statement(value, parentId, id);
        }
        return [3, id, [value.shadow === 'text' ? TEXT : MATH_NUM, '']];
    }

    field (value) {
        if (value && value.variable) return [value.variable, `var-${value.variable}`];
        if (value && value.list) return [value.list, `list-${value.list}`];
        if (value && value.broadcast) return [value.broadcast, `msg-${value.broadcast}`];
        return [value, null];
    }

    statement (node, parentId, optId) {
        const id = optId || this.nextId();
        const block = this.add(id, {opcode: node.op, parent: parentId});
        if (node.mutation) block.mutation = Object.assign({tagName: 'mutation', children: []}, node.mutation);
        Object.keys(node.inputs || {}).forEach(name => {
            block.inputs[name] = this.input(node.inputs[name], id);
        });
        Object.keys(node.fields || {}).forEach(name => {
            block.fields[name] = this.field(node.fields[name]);
        });
        if (node.substack) block.inputs.SUBSTACK = [2, this.stack(node.substack, id)];
        return id;
    }

    stack (nodes, parentId) {
        let first = null;
        let previous = null;
        nodes.forEach(node => {
            const id = this.statement(node, previous || parentId);
            if (previous) this.blocks[previous].next = id;
            else first = id;
            previous = id;
        });
        return first;
    }
}

/**
 * @param {Array.<object>} nodes - statements, as a tree.
 * @param {string} prefix - block id prefix.
 * @param {object=} position - {x, y} of the top block.
 * @returns {{blocks: object, topId: ?string}} sb3 blocks of one top-level script.
 */
const scriptToSb3 = (nodes, prefix, position) => {
    const builder = new Sb3ScriptBuilder(prefix);
    const topId = builder.stack(nodes, null);
    if (topId) {
        Object.assign(builder.blocks[topId], {topLevel: true, x: 0, y: 0}, position || {});
    }
    return {blocks: builder.blocks, topId};
};

/**
 * Build a teacher block definition in the JSON schema format.
 * @param {object} options - {id, version?, text?, inputs?, variables?, warp?, spriteOnly?, deleted?,
 *   body: Array.<statement>}.
 * @returns {object} the definition.
 */
const teacherDef = options => {
    const version = options.version || 1;
    const inputs = options.inputs || [];
    const definition = {
        id: options.id,
        version,
        text: options.text || [options.id].concat(inputs.map(input => `[${input.name}]`)).join(' '),
        inputs,
        variables: options.variables || [],
        blocks: scriptToSb3(options.body || [], `${options.id}-v${version}-`).blocks
    };
    ['warp', 'spriteOnly', 'deleted'].forEach(key => {
        if (Object.prototype.hasOwnProperty.call(options, key)) definition[key] = options[key];
    });
    return definition;
};

/**
 * @param {Array.<object>} definitions - schema definitions.
 * @returns {object} a definitions envelope.
 */
const envelope = definitions => ({schemaVersion: 1, definitions});

let scriptCount = 0;

/**
 * Add `when flag clicked → <call> → ...after` to a target.
 * @param {RenderedTarget} target - where to add the script.
 * @param {object} def - the teacher block definition to call.
 * @param {object=} options - {native: call with procedures_call (a native My Block call),
 *   args: {name: value}, after: [statements], x, y}.
 * @returns {string} id of the hat block.
 */
const addCallerScript = (target, def, options = {}) => {
    const args = options.args || {};
    const inputs = {};
    def.inputs.forEach(input => {
        const value = Object.prototype.hasOwnProperty.call(args, input.name) ? args[input.name] : input.default;
        inputs[input.name] = input.type === 'string' ? String(value) : Number(value);
    });
    const call = options.native ?
        {
            op: 'procedures_call',
            inputs,
            mutation: {
                proccode: proccodeOf(def.id, def.version, def.inputs.length),
                argumentids: JSON.stringify(def.inputs.map(input => input.name)),
                warp: String(!!def.warp)
            }
        } :
        {op: opcodeOf(def.id, def.version), inputs};
    scriptCount++;
    const script = scriptToSb3(
        [{op: 'event_whenflagclicked'}, call].concat(options.after || []),
        `caller${scriptCount}-`,
        {x: options.x || 0, y: options.y || 0}
    );
    const blocks = sb3.deserializeBlocks(script.blocks);
    Object.keys(blocks).forEach(id => target.blocks.createBlock(blocks[id]));
    return script.topId;
};

// The spec's example teacher blocks (docs/student-app-spec.md).
const WALK_V1 = teacherDef({
    id: 'walk',
    version: 1,
    text: 'Walk [STEPS] steps',
    inputs: [{name: 'STEPS', type: 'number', default: 1}],
    body: [
        {op: 'motion_movesteps', inputs: {STEPS: {op: 'operator_multiply', inputs: {NUM1: {arg: 'STEPS'}, NUM2: 10}}}},
        {op: 'looks_nextcostume'}
    ]
});

// A newer version: x20 instead of x10.
const WALK_V2 = teacherDef({
    id: 'walk',
    version: 2,
    text: 'Walk [STEPS] steps',
    inputs: [{name: 'STEPS', type: 'number', default: 1}],
    body: [
        {op: 'motion_movesteps', inputs: {STEPS: {op: 'operator_multiply', inputs: {NUM1: {arg: 'STEPS'}, NUM2: 20}}}},
        {op: 'looks_nextcostume'}
    ]
});

const ADD_SCORE_V1 = teacherDef({
    id: 'addScore',
    version: 1,
    text: 'Add Score [POINTS]',
    inputs: [{name: 'POINTS', type: 'number', default: 1}],
    variables: [{name: 'Score', type: 'variable'}],
    body: [
        {op: 'data_changevariableby', fields: {VARIABLE: {variable: 'Score'}}, inputs: {VALUE: {arg: 'POINTS'}}}
    ]
});

const CRABBY_SAYS_V1 = teacherDef({
    id: 'crabbySays',
    version: 1,
    text: 'Start! Crabby says... [MESSAGE]',
    inputs: [{name: 'MESSAGE', type: 'string', default: 'start'}],
    body: [
        {op: 'looks_sayforsecs', inputs: {MESSAGE: {arg: 'MESSAGE', shadow: 'text'}, SECS: 2}}
    ]
});

const samples = {WALK_V1, WALK_V2, ADD_SCORE_V1, CRABBY_SAYS_V1};

module.exports = {
    addCallerScript,
    envelope,
    samples,
    scriptToSb3,
    teacherDef
};
