/**
 * CodKid teacher blocks: put hidden definitions into targets, and keep their variables alive.
 *
 * Rule: every original target (the stage and each sprite; clones share their sprite's blocks)
 * contains every required definition (registry.requiredKeys()). So a teacher block works wherever
 * a child puts it, and a project saves every definition it may use.
 */
const log = require('../../util/log');
const {buildDefinitionBlocks, copyDefinitionBlocks, ensureStageVariable, ensureVariables} = require('./build');
const {collectScriptBlockIds, findHiddenDefinitions} = require('./hidden');

/**
 * @param {Array.<RenderedTarget>} targets - targets.
 * @returns {Array.<object>} metadata of every hidden definition in them, one per key.
 */
const readEmbeddedMetas = targets => {
    const metas = new Map();
    targets.forEach(target => {
        findHiddenDefinitions(target.blocks).forEach(found => metas.set(found.key, found.meta));
    });
    return Array.from(metas.values());
};

/**
 * Create the stage variables that the required definitions need.
 * @param {TeacherBlockRegistry} registry - the registry.
 * @param {RenderedTarget} stage - the stage.
 * @returns {boolean} whether anything was created.
 */
const ensureRequiredVariables = (registry, stage) => {
    let created = false;
    registry.requiredKeys().forEach(key => {
        const meta = registry.getMeta(key);
        if (meta && ensureVariables(stage, meta)) created = true;
    });
    return created;
};

/**
 * Add the missing required definitions to each target. The body is copied from another target
 * that has the same version, so the project stays consistent; otherwise it is built from the
 * catalog.
 * @param {TeacherBlockRegistry} registry - the registry.
 * @param {Array.<RenderedTarget>} targets - targets to fill (original targets only).
 * @param {RenderedTarget} stage - the stage (for variables).
 * @param {Array.<RenderedTarget>} sources - targets to copy definitions from.
 * @returns {boolean} whether anything was added.
 */
const ensureDefinitions = (registry, targets, stage, sources) => {
    const keys = registry.requiredKeys();
    if (keys.length === 0) return false;
    // Where each key can be copied from: computed once, before anything is added.
    const sourceOf = new Map();
    sources.forEach(source => {
        findHiddenDefinitions(source.blocks).forEach(found => {
            if (!sourceOf.has(found.key)) sourceOf.set(found.key, {blocks: source.blocks, topId: found.topId});
        });
    });

    let added = false;
    targets.forEach(target => {
        const present = new Set(findHiddenDefinitions(target.blocks).map(found => found.key));
        keys.forEach(key => {
            if (present.has(key)) return;
            let blocks = null;
            if (sourceOf.has(key)) {
                const source = sourceOf.get(key);
                blocks = copyDefinitionBlocks(source.blocks, source.topId);
            } else if (registry.getDefinition(key)) {
                blocks = buildDefinitionBlocks(registry.getDefinition(key), stage);
            }
            if (!blocks) {
                log.warn(`CodKid teacher blocks: no definition body for ${key}`);
                return;
            }
            blocks.forEach(block => target.blocks.createBlock(block));
            added = true;
        });
    });
    return added;
};

/**
 * A child can delete a variable from the palette. Blockly only updates the blocks it shows, so
 * hidden definitions would keep the old id, and running them would create a sprite-local copy.
 * Put such variables back on the stage, with the same id and name. If the stage already has a
 * variable with that name and type, link the hidden blocks to it instead.
 * @param {Array.<RenderedTarget>} targets - original targets.
 * @param {RenderedTarget} stage - the stage.
 * @returns {boolean} whether a variable was created.
 */
const restoreMissingVariables = (targets, stage) => {
    let created = false;
    targets.forEach(target => {
        let relinked = false;
        findHiddenDefinitions(target.blocks).forEach(found => {
            collectScriptBlockIds(target.blocks, found.topId).forEach(id => {
                const block = target.blocks.getBlock(id);
                Object.keys(block.fields || {}).forEach(name => {
                    const field = block.fields[name];
                    if (typeof field.variableType !== 'string' || !field.id) return;
                    if (target.lookupVariableById(field.id)) return;
                    const result = ensureStageVariable(stage, field.value, field.variableType, field.id);
                    if (result.created) created = true;
                    if (result.variable.id !== field.id) {
                        field.id = result.variable.id;
                        relinked = true;
                    }
                });
            });
        });
        if (relinked) target.blocks.resetCache();
    });
    return created;
};

module.exports = {
    ensureDefinitions,
    ensureRequiredVariables,
    readEmbeddedMetas,
    restoreMissingVariables
};
