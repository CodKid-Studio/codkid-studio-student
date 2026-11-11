/**
 * CodKid teacher blocks: validate the definitions JSON and normalize it.
 * The format is documented in docs/teacher-block-schema.md (repository root).
 *
 * A broken envelope gives no definitions. A broken definition is skipped with a warning; the
 * others still load.
 */
const log = require('../../util/log');
const Variable = require('../../engine/variable');
const {ID_PATTERN, blockOpcodeOf, isTeacherOpcode} = require('./opcode');

const SCHEMA_VERSION = 1;

/** Input types: spec "数字 / 文字". A block with no inputs has an empty `inputs` list. */
const INPUT_TYPES = ['number', 'string'];
const INPUT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Schema variable type → VM variable type. */
const VARIABLE_TYPES = {
    variable: Variable.SCALAR_TYPE,
    list: Variable.LIST_TYPE,
    broadcast: Variable.BROADCAST_MESSAGE_TYPE
};

/** Extensions that a body may use besides the core blocks. They are loaded with the definitions. */
const BODY_EXTENSIONS = ['pen', 'music'];

/**
 * Hat blocks cannot be in a body. Extension hats are not in BODY_EXTENSIONS.
 * @param {string} opcode - a block opcode.
 * @returns {boolean} whether it is a core hat block.
 */
const isHatOpcode = opcode => opcode.indexOf('event_when') === 0 || opcode === 'control_start_as_clone';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Thrown while checking one definition; the definition is skipped.
 * @param {string} message - what is wrong.
 */
const DefinitionError = function (message) {
    this.message = message;
};
const fail = message => {
    throw new DefinitionError(message);
};

const normalizeInput = input => {
    if (!isPlainObject(input)) fail('every input must be an object');
    if (typeof input.name !== 'string' || !INPUT_NAME_PATTERN.test(input.name)) {
        fail(`input name "${input.name}" must be a letter followed by letters, digits or "_"`);
    }
    if (INPUT_TYPES.indexOf(input.type) < 0) fail(`input "${input.name}": type must be "number" or "string"`);
    let value;
    if (input.type === 'number') {
        value = hasOwn(input, 'default') ? Number(input.default) : 0;
        if (!isFinite(value) || input.default === '' || input.default === null) {
            fail(`input "${input.name}": default must be a number`);
        }
    } else {
        value = hasOwn(input, 'default') ? input.default : '';
        if (typeof value !== 'string') fail(`input "${input.name}": default must be a string`);
    }
    return {name: input.name, type: input.type, default: value};
};

const normalizeVariable = variable => {
    if (!isPlainObject(variable)) fail('every variable must be an object');
    if (typeof variable.name !== 'string' || variable.name.trim() === '') fail('variable name must be a string');
    const type = hasOwn(variable, 'type') ? variable.type : 'variable';
    if (!hasOwn(VARIABLE_TYPES, type)) fail(`variable "${variable.name}": type must be variable, list or broadcast`);
    return {name: variable.name, type};
};

/**
 * Every input appears once in the text as [NAME], and the text has no other [placeholder].
 * @param {string} text - block text, e.g. "Walk [STEPS] steps".
 * @param {Array.<object>} inputs - normalized inputs.
 */
const checkText = (text, inputs) => {
    const placeholders = [];
    text.replace(/\[([^\]]*)\]/g, (match, name) => {
        placeholders.push(name);
        return match;
    });
    const names = inputs.map(input => input.name);
    placeholders.forEach(name => {
        if (names.indexOf(name) < 0) fail(`text has [${name}] but there is no input with that name`);
    });
    names.forEach(name => {
        const count = placeholders.filter(placeholder => placeholder === name).length;
        if (count !== 1) fail(`input "${name}" must appear exactly once in the text as [${name}]`);
    });
};

/**
 * Check the body: sb3 block format, one script, only allowed blocks, and every argument and
 * variable it uses is declared.
 * @param {object} blocks - the body, in .sb3 project.json block format.
 * @param {Array.<object>} inputs - normalized inputs.
 * @param {Array.<object>} variables - normalized variables.
 */
const checkBody = (blocks, inputs, variables) => {
    if (!isPlainObject(blocks)) fail('"blocks" must be an object (sb3 block format)');
    if (Object.keys(blocks).length === 0) return;

    // Required here, not at the top: sb3.js requires engine modules that require this folder.
    const sb3 = require('../../serialization/sb3');
    let deserialized;
    try {
        deserialized = sb3.deserializeBlocks(JSON.parse(JSON.stringify(blocks)));
    } catch (error) {
        fail(`"blocks" could not be read (${error.message})`);
    }
    const all = Object.keys(deserialized).map(id => deserialized[id]);
    const byId = Object.create(null);
    all.forEach(block => {
        if (!isPlainObject(block) || typeof block.opcode !== 'string') fail('every block needs an opcode');
        byId[block.id] = block;
    });

    const tops = all.filter(block => block.topLevel);
    if (tops.length !== 1) fail(`"blocks" must hold exactly one script (found ${tops.length} top-level blocks)`);
    const top = tops[0];
    if (top.shadow || top.parent || typeof top.next === 'undefined') {
        fail('the top-level block must be a stack block with "parent": null');
    }

    // Every block must belong to the script, and every reference must point to a block.
    const reached = Object.create(null);
    const visit = id => {
        if (id === null || typeof id === 'undefined') return;
        if (!byId[id]) fail(`a block refers to a missing block "${id}"`);
        if (reached[id]) return;
        reached[id] = true;
        const block = byId[id];
        Object.keys(block.inputs || {}).forEach(name => {
            visit(block.inputs[name].block);
            visit(block.inputs[name].shadow);
        });
        visit(block.next);
    };
    visit(top.id);
    if (Object.keys(reached).length !== all.length) fail('"blocks" has blocks that are not part of the script');

    const inputNames = inputs.map(input => input.name);
    all.forEach(block => {
        const opcode = block.opcode;
        if (isTeacherOpcode(opcode)) fail('a teacher block cannot use another teacher block');
        if (opcode.indexOf('procedures_') === 0) fail('a teacher block cannot use My Blocks');
        if (opcode === 'argument_reporter_boolean') fail('boolean arguments are not supported');
        if (isHatOpcode(opcode)) fail(`hat block "${opcode}" cannot be in a teacher block`);
        const extensionId = sb3.getExtensionIdForOpcode(opcode);
        if (extensionId && BODY_EXTENSIONS.indexOf(extensionId) < 0) {
            fail(`blocks from the "${extensionId}" extension cannot be in a teacher block`);
        }
        if (opcode === 'argument_reporter_string_number') {
            const field = block.fields && block.fields.VALUE;
            if (!field || inputNames.indexOf(field.value) < 0) {
                fail(`argument reporter "${field && field.value}" does not match an input name`);
            }
        }
        Object.keys(block.fields || {}).forEach(name => {
            const field = block.fields[name];
            if (typeof field.variableType !== 'string') return;
            const declared = variables.some(variable => (
                variable.name === field.value && VARIABLE_TYPES[variable.type] === field.variableType
            ));
            if (!declared) fail(`"${field.value}" is used but not listed in "variables"`);
        });
    });
};

/**
 * @param {object} definition - one raw definition.
 * @returns {object} the normalized definition.
 */
const normalizeDefinition = definition => {
    if (!isPlainObject(definition)) fail('a definition must be an object');
    const {id, version, text} = definition;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
        fail(`id "${id}" must be a letter followed by letters or digits`);
    }
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
        fail(`${id}: version must be a whole number, 1 or more`);
    }
    if (typeof text !== 'string' || text.trim() === '') fail(`${id}: text must not be empty`);
    if (!Array.isArray(definition.inputs || [])) fail(`${id}: inputs must be a list`);
    if (!Array.isArray(definition.variables || [])) fail(`${id}: variables must be a list`);
    ['warp', 'spriteOnly', 'deleted'].forEach(key => {
        if (hasOwn(definition, key) && typeof definition[key] !== 'boolean') {
            fail(`${id}: ${key} must be true or false`);
        }
    });

    const inputs = (definition.inputs || []).map(normalizeInput);
    if (new Set(inputs.map(input => input.name)).size !== inputs.length) fail(`${id}: input names must be unique`);
    const variables = (definition.variables || []).map(normalizeVariable);
    checkText(text, inputs);
    checkBody(hasOwn(definition, 'blocks') ? definition.blocks : {}, inputs, variables);

    return {
        id,
        version,
        text,
        inputs,
        variables,
        warp: !!definition.warp,
        spriteOnly: !!definition.spriteOnly,
        deleted: !!definition.deleted,
        blocks: JSON.parse(JSON.stringify(definition.blocks || {}))
    };
};

/**
 * Validate and normalize a definitions envelope.
 * @param {*} json - `{schemaVersion: 1, definitions: [...]}`, as parsed JSON. null means "none".
 * @returns {Array.<object>} the valid definitions. Invalid ones are skipped with a warning.
 */
const normalizeDefinitions = json => {
    if (json === null || typeof json === 'undefined') return [];
    if (!isPlainObject(json) || json.schemaVersion !== SCHEMA_VERSION || !Array.isArray(json.definitions)) {
        log.warn(`CodKid teacher blocks: expected {schemaVersion: ${SCHEMA_VERSION}, definitions: [...]}; ` +
            'no teacher blocks loaded');
        return [];
    }
    const byKey = new Map();
    json.definitions.forEach((raw, index) => {
        try {
            const definition = normalizeDefinition(raw);
            const key = blockOpcodeOf(definition.id, definition.version);
            if (byKey.has(key)) log.warn(`CodKid teacher blocks: ${key} is listed twice; using the last one`);
            byKey.set(key, definition);
        } catch (error) {
            if (!(error instanceof DefinitionError)) throw error;
            log.warn(`CodKid teacher blocks: skipping definition #${index} (${error.message})`);
        }
    });
    return Array.from(byKey.values());
};

/**
 * @param {object} definition - a normalized definition or metadata.
 * @returns {Array.<string>} extension ids its body uses (only BODY_EXTENSIONS can appear).
 */
const extensionIdsOf = definition => {
    const sb3 = require('../../serialization/sb3');
    const ids = new Set();
    Object.keys(definition.blocks || {}).forEach(blockId => {
        const block = definition.blocks[blockId];
        if (isPlainObject(block) && typeof block.opcode === 'string') {
            const extensionId = sb3.getExtensionIdForOpcode(block.opcode);
            if (extensionId) ids.add(extensionId);
        }
    });
    return Array.from(ids);
};

module.exports = {
    BODY_EXTENSIONS,
    SCHEMA_VERSION,
    VARIABLE_TYPES,
    extensionIdsOf,
    normalizeDefinitions
};
