/**
 * CodKid teacher blocks: the marker on hidden definitions.
 *
 * A teacher block runs a hidden `procedures_definition` script in the same target. Its
 * `procedures_prototype` mutation carries a `codkiddef` attribute: JSON metadata about the
 * definition (see metaOf in build.js). The marker is saved in .sb3 files with the rest of the
 * mutation, so a project keeps the definition version it was made with.
 *
 * engine/blocks.js (toXML) and engine/runtime.js (_updateGlows) require this module, so it must
 * only require modules with no dependencies.
 */
const {blockOpcodeOf} = require('./opcode');

const MARKER = 'codkiddef';

/**
 * @param {Blocks} blocks - a block container.
 * @param {string} blockId - id of a block in it.
 * @returns {?object} the prototype mutation if blockId is a marked definition, else null.
 */
const getMarkedMutation = (blocks, blockId) => {
    const definition = blocks.getBlock(blockId);
    if (!definition || definition.opcode !== 'procedures_definition') return null;
    const customBlock = definition.inputs && definition.inputs.custom_block;
    const prototype = customBlock && blocks.getBlock(customBlock.block);
    const mutation = prototype && prototype.mutation;
    return mutation && typeof mutation[MARKER] === 'string' ? mutation : null;
};

/**
 * Hook for Blocks.toXML and Runtime._updateGlows: hidden definitions never reach the workspace.
 * @param {Blocks} blocks - a block container.
 * @param {string} topBlockId - id of a top-level block.
 * @returns {boolean} whether the script is a hidden teacher block definition.
 */
const isHiddenDefinitionScript = (blocks, topBlockId) => getMarkedMutation(blocks, topBlockId) !== null;

/**
 * @param {object} mutation - a marked prototype mutation.
 * @returns {?object} the parsed metadata, or null if it is broken.
 */
const parseMarker = mutation => {
    try {
        const meta = JSON.parse(mutation[MARKER]);
        if (meta && typeof meta.id === 'string' && typeof meta.version === 'number') return meta;
    } catch (error) {
        // Fall through: a broken marker is treated as "no metadata".
    }
    return null;
};

/**
 * @typedef {object} HiddenDefinition
 * @property {string} topId - id of the procedures_definition block.
 * @property {string} key - registry key, e.g. "walk_v1".
 * @property {string} proccode - the procedure's proccode.
 * @property {object} meta - the parsed `codkiddef` metadata.
 */

/**
 * Find every hidden teacher block definition in a block container. S-13 (export as plain My
 * Blocks) can use this too.
 * @param {Blocks} blocks - a block container.
 * @returns {Array.<HiddenDefinition>} the definitions, in script order.
 */
const findHiddenDefinitions = blocks => {
    const found = [];
    blocks.getScripts().forEach(topId => {
        const mutation = getMarkedMutation(blocks, topId);
        if (!mutation) return;
        const meta = parseMarker(mutation);
        if (!meta) return;
        found.push({topId, key: blockOpcodeOf(meta.id, meta.version), proccode: mutation.proccode, meta});
    });
    return found;
};

/**
 * @param {Blocks} blocks - a block container.
 * @param {string} topId - id of the first block of a script.
 * @returns {Array.<string>} ids of every block in the script: next blocks, inputs and shadows.
 */
const collectScriptBlockIds = (blocks, topId) => {
    const ids = [];
    const seen = Object.create(null);
    const visit = id => {
        if (!id || seen[id]) return;
        const block = blocks.getBlock(id);
        if (!block) return;
        seen[id] = true;
        ids.push(id);
        Object.keys(block.inputs || {}).forEach(name => {
            visit(block.inputs[name].block);
            visit(block.inputs[name].shadow);
        });
        visit(block.next);
    };
    visit(topId);
    return ids;
};

module.exports = {
    MARKER,
    collectScriptBlockIds,
    findHiddenDefinitions,
    isHiddenDefinitionScript
};
