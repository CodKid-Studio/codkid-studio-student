/**
 * CodKid SPIKE (throwaway): inject hidden teacher block definitions into targets,
 * and build caller scripts for tests.
 */
const uid = require('../../util/uid');

const EXTENSION_ID = 'codkidLesson';

const opcodeOf = def => `${def.id}_v${def.version}`;
const fullOpcodeOf = def => `${EXTENSION_ID}_${opcodeOf(def)}`;
const proccodeOf = def => [`codkid ${def.id} v${def.version}`]
    .concat(def.inputs.map(() => '%s'))
    .join(' ');

// The metadata that lets us rebuild the extension block from a project.
const metaOf = def => ({
    id: def.id,
    version: def.version,
    warp: !!def.warp,
    text: def.text,
    inputs: def.inputs
});

const SHADOW_TYPES = {
    MESSAGE: 'text',
    OPERAND1: 'text',
    OPERAND2: 'text',
    TIMES: 'math_whole_number'
};

const fieldNameOf = shadowType => (shadowType === 'text' ? 'TEXT' : 'NUM');

class Builder {
    constructor (runtime) {
        this.runtime = runtime;
        this.blocks = [];
    }

    add (block) {
        const full = Object.assign({
            inputs: {},
            fields: {},
            next: null,
            parent: null,
            shadow: false,
            topLevel: false
        }, block);
        this.blocks.push(full);
        return full;
    }

    shadow (inputName, value, parentId) {
        const type = SHADOW_TYPES[inputName] || 'math_number';
        const fieldName = fieldNameOf(type);
        return this.add({
            id: uid(),
            opcode: type,
            parent: parentId,
            shadow: true,
            fields: {[fieldName]: {name: fieldName, value: String(value)}}
        }).id;
    }

    // Returns {block, shadow} ids for an input.
    input (inputName, node, parentId) {
        if (typeof node === 'number' || typeof node === 'string') {
            const id = this.shadow(inputName, node, parentId);
            return {block: id, shadow: id};
        }
        const shadowId = this.shadow(inputName, '', parentId);
        let reporter;
        if (node.arg) {
            reporter = this.add({
                id: uid(),
                opcode: 'argument_reporter_string_number',
                parent: parentId,
                fields: {VALUE: {name: 'VALUE', value: node.arg}}
            });
        } else {
            reporter = this.statement(node, parentId);
        }
        return {block: reporter.id, shadow: shadowId};
    }

    statement (node, parentId) {
        const block = this.add({id: uid(), opcode: node.op, parent: parentId});
        if (node.mutation) {
            block.mutation = Object.assign({tagName: 'mutation', children: []}, node.mutation);
        }
        for (const [name, value] of Object.entries(node.inputs || {})) {
            const ids = this.input(name, value, block.id);
            block.inputs[name] = {name, block: ids.block, shadow: ids.shadow};
        }
        for (const [name, value] of Object.entries(node.fields || {})) {
            if (value && value.variable) {
                const variable = this.runtime.getTargetForStage().lookupVariableByNameAndType(value.variable, '');
                block.fields[name] = {name, value: value.variable, id: variable.id, variableType: ''};
            } else {
                block.fields[name] = {name, value};
            }
        }
        if (node.substack) {
            const first = this.stack(node.substack, block.id);
            block.inputs.SUBSTACK = {name: 'SUBSTACK', block: first, shadow: null};
        }
        return block;
    }

    // Returns the id of the first block of the stack.
    stack (nodes, parentId) {
        let first = null;
        let prev = null;
        for (const node of nodes) {
            const block = this.statement(node, prev ? prev.id : parentId);
            if (prev) prev.next = block.id;
            else first = block.id;
            prev = block;
        }
        return first;
    }

    commit (target) {
        for (const block of this.blocks) target.blocks.createBlock(block);
    }
}

const ensureVariables = (runtime, def) => {
    const stage = runtime.getTargetForStage();
    for (const variable of def.variables || []) {
        if (!stage.lookupVariableByNameAndType(variable.name, '')) {
            stage.createVariable(uid(), variable.name, '');
        }
    }
};

const injectDefinition = (runtime, target, def, y) => {
    const proccode = proccodeOf(def);
    if (target.blocks.getProcedureDefinition(proccode)) return false;

    const b = new Builder(runtime);
    const defBlock = b.add({id: uid(), opcode: 'procedures_definition', topLevel: true, x: -3000, y});
    const proto = b.add({
        id: uid(),
        opcode: 'procedures_prototype',
        parent: defBlock.id,
        shadow: true,
        mutation: {
            tagName: 'mutation',
            children: [],
            proccode,
            argumentids: JSON.stringify(def.inputs.map(i => i.name)),
            argumentnames: JSON.stringify(def.inputs.map(i => i.name)),
            argumentdefaults: JSON.stringify(def.inputs.map(i => i.default)),
            warp: String(!!def.warp),
            codkiddef: JSON.stringify(metaOf(def))
        }
    });
    for (const input of def.inputs) {
        const reporter = b.add({
            id: uid(),
            opcode: 'argument_reporter_string_number',
            parent: proto.id,
            shadow: true,
            fields: {VALUE: {name: 'VALUE', value: input.name}}
        });
        proto.inputs[input.name] = {name: input.name, block: reporter.id, shadow: reporter.id};
    }
    defBlock.inputs.custom_block = {name: 'custom_block', block: proto.id, shadow: proto.id};
    defBlock.next = b.stack(def.body, defBlock.id);
    b.commit(target);
    return true;
};

/**
 * Inject the definitions into every original target (stage + sprites). Clones share the sprite's blocks.
 * @param {Runtime} runtime - the runtime.
 * @param {Array<object>} defs - teacher block definitions.
 */
const injectAll = (runtime, defs) => {
    defs.forEach(def => ensureVariables(runtime, def));
    runtime.targets.filter(t => t.isOriginal).forEach(target => {
        defs.forEach((def, i) => injectDefinition(runtime, target, def, i * 300));
    });
};

/**
 * Add `when flag clicked → <call> → ...after` to a target.
 * @param {Runtime} runtime - the runtime.
 * @param {RenderedTarget} target - where to add the script.
 * @param {object} def - the teacher block definition to call.
 * @param {object} options - {native: use procedures_call, args: {name: value}, after: [statement nodes], x, y}
 * @returns {string} id of the hat block.
 */
const addCallerScript = (runtime, target, def, options = {}) => {
    const b = new Builder(runtime);
    const hat = b.add({
        id: uid(), opcode: 'event_whenflagclicked', topLevel: true, x: options.x || 0, y: options.y || 0
    });
    const args = options.args || {};
    let call;
    if (options.native) {
        call = b.add({
            id: uid(),
            opcode: 'procedures_call',
            parent: hat.id,
            mutation: {
                tagName: 'mutation',
                children: [],
                proccode: proccodeOf(def),
                argumentids: JSON.stringify(def.inputs.map(i => i.name)),
                warp: String(!!def.warp)
            }
        });
    } else {
        call = b.add({id: uid(), opcode: fullOpcodeOf(def), parent: hat.id});
    }
    for (const input of def.inputs) {
        const value = Object.prototype.hasOwnProperty.call(args, input.name) ? args[input.name] : input.default;
        const shadowId = b.add({
            id: uid(),
            opcode: input.type === 'string' ? 'text' : 'math_number',
            parent: call.id,
            shadow: true,
            fields: input.type === 'string' ?
                {TEXT: {name: 'TEXT', value: String(value)}} :
                {NUM: {name: 'NUM', value: String(value)}}
        }).id;
        call.inputs[input.name] = {name: input.name, block: shadowId, shadow: shadowId};
    }
    hat.next = call.id;
    if (options.after && options.after.length) {
        call.next = b.stack(options.after, call.id);
    }
    b.commit(target);
    return hat.id;
};

/**
 * Read the teacher block metadata embedded in hidden definitions.
 * @param {Array<RenderedTarget>} targets - targets, e.g. freshly deserialized ones.
 * @returns {Array<object>} unique definitions' metadata.
 */
const readEmbeddedDefinitions = targets => {
    const found = new Map();
    targets.forEach(target => {
        const all = target.blocks._blocks;
        Object.keys(all).forEach(id => {
            const block = all[id];
            if (block.opcode === 'procedures_prototype' && block.mutation && block.mutation.codkiddef) {
                const meta = JSON.parse(block.mutation.codkiddef);
                found.set(opcodeOf(meta), meta);
            }
        });
    });
    return Array.from(found.values());
};

module.exports = {
    EXTENSION_ID,
    opcodeOf,
    fullOpcodeOf,
    proccodeOf,
    injectAll,
    addCallerScript,
    readEmbeddedDefinitions
};
