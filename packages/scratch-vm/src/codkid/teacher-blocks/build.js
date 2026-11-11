/**
 * CodKid teacher blocks: build the VM blocks of a hidden definition.
 *
 * The result is a normal custom block definition (`procedures_definition` + `procedures_prototype`
 * + the body), so it runs on exactly the same code path as a My Block. The prototype mutation
 * carries the `codkiddef` marker (hidden.js), which keeps it off the workspace.
 */
const uid = require('../../util/uid');
const newBlockIds = require('../../util/new-block-ids');
const {MARKER, collectScriptBlockIds} = require('./hidden');
const {VARIABLE_TYPES} = require('./definitions');
const {proccodeOf} = require('./opcode');
const {metaOf} = require('./registry');

/**
 * Find a stage variable by name and type, or create it.
 * @param {RenderedTarget} stage - the stage.
 * @param {string} name - variable name.
 * @param {string} vmType - VM variable type ('', 'list' or 'broadcast_msg').
 * @param {string=} optId - id to use when it has to be created.
 * @returns {{variable: Variable, created: boolean}} the variable, and whether it is new.
 */
const ensureStageVariable = (stage, name, vmType, optId) => {
    const existing = stage.lookupVariableByNameAndType(name, vmType);
    if (existing) return {variable: existing, created: false};
    const id = optId || uid();
    stage.createVariable(id, name, vmType);
    return {variable: stage.variables[id], created: true};
};

/**
 * Create the stage variables, lists and broadcast messages a definition needs.
 * @param {RenderedTarget} stage - the stage.
 * @param {object} meta - definition or metadata (uses `variables`).
 * @returns {boolean} whether anything was created.
 */
const ensureVariables = (stage, meta) => {
    let created = false;
    (meta.variables || []).forEach(variable => {
        if (ensureStageVariable(stage, variable.name, VARIABLE_TYPES[variable.type]).created) created = true;
    });
    return created;
};

/**
 * createBlock and sb3 serialization expect null, not undefined, for missing links.
 * @param {object} block - a VM block; changed in place.
 */
const tidyLinks = block => {
    if (typeof block.next === 'undefined') block.next = null;
    if (typeof block.parent === 'undefined') block.parent = null;
    Object.keys(block.inputs).forEach(name => {
        const input = block.inputs[name];
        if (typeof input.block === 'undefined') input.block = null;
        if (typeof input.shadow === 'undefined') input.shadow = null;
    });
};

/**
 * Link every variable field of the blocks to the stage variable with the same name and type.
 * @param {Array.<object>} blocks - VM blocks.
 * @param {RenderedTarget} stage - the stage.
 */
const linkVariables = (blocks, stage) => {
    blocks.forEach(block => {
        Object.keys(block.fields).forEach(name => {
            const field = block.fields[name];
            if (typeof field.variableType !== 'string') return;
            const {variable} = ensureStageVariable(stage, field.value, field.variableType);
            field.id = variable.id;
        });
    });
};

/**
 * Build the blocks of a hidden definition from a catalog definition.
 * @param {object} definition - a normalized definition (definitions.js).
 * @param {RenderedTarget} stage - the stage. Variable fields are linked to its variables by name;
 *   missing ones are created.
 * @returns {Array.<object>} VM blocks, the procedures_definition first. Ready for createBlock.
 */
const buildDefinitionBlocks = (definition, stage) => {
    // Required here: sb3.js requires engine modules that require this folder (see hidden.js).
    const sb3 = require('../../serialization/sb3');
    const bodyById = sb3.deserializeBlocks(JSON.parse(JSON.stringify(definition.blocks)));
    const body = Object.keys(bodyById).map(id => bodyById[id]);
    newBlockIds(body);
    body.forEach(tidyLinks);
    const top = body.find(block => block.topLevel) || null;

    const names = definition.inputs.map(input => input.name);
    const definitionId = uid();
    const prototypeId = uid();
    const definitionBlock = {
        id: definitionId,
        opcode: 'procedures_definition',
        inputs: {custom_block: {name: 'custom_block', block: prototypeId, shadow: prototypeId}},
        fields: {},
        next: top ? top.id : null,
        parent: null,
        shadow: false,
        topLevel: true,
        x: 0,
        y: 0
    };
    const prototypeBlock = {
        id: prototypeId,
        opcode: 'procedures_prototype',
        inputs: {},
        fields: {},
        next: null,
        parent: definitionId,
        shadow: true,
        topLevel: false,
        mutation: {
            tagName: 'mutation',
            children: [],
            proccode: proccodeOf(definition.id, definition.version, names.length),
            // Argument ids are the input names: the Lesson extension passes its arguments by name.
            argumentids: JSON.stringify(names),
            argumentnames: JSON.stringify(names),
            argumentdefaults: JSON.stringify(definition.inputs.map(input => String(input.default))),
            warp: String(!!definition.warp),
            [MARKER]: JSON.stringify(metaOf(definition))
        }
    };
    const reporters = names.map(name => {
        const reporter = {
            id: uid(),
            opcode: 'argument_reporter_string_number',
            inputs: {},
            fields: {VALUE: {name: 'VALUE', value: name}},
            next: null,
            parent: prototypeId,
            shadow: true,
            topLevel: false
        };
        prototypeBlock.inputs[name] = {name, block: reporter.id, shadow: reporter.id};
        return reporter;
    });
    if (top) {
        top.parent = definitionId;
        top.topLevel = false;
        delete top.x;
        delete top.y;
    }
    linkVariables(body, stage);
    return [definitionBlock, prototypeBlock].concat(reporters, body);
};

/**
 * Copy a hidden definition from a block container, with new block ids. Variable fields keep
 * their ids: they point to stage variables, which every target shares.
 * @param {Blocks} sourceBlocks - the container that has the definition.
 * @param {string} topId - id of its procedures_definition block.
 * @returns {Array.<object>} VM blocks, ready for createBlock.
 */
const copyDefinitionBlocks = (sourceBlocks, topId) => {
    const blocks = collectScriptBlockIds(sourceBlocks, topId)
        .map(id => JSON.parse(JSON.stringify(sourceBlocks.getBlock(id))));
    newBlockIds(blocks);
    blocks.forEach(tidyLinks);
    return blocks;
};

module.exports = {
    buildDefinitionBlocks,
    copyDefinitionBlocks,
    ensureStageVariable,
    ensureVariables,
    linkVariables
};
