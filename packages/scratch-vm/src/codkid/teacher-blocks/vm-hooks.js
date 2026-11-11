/**
 * CodKid teacher blocks: wrap VirtualMachine methods so every way a target enters the project
 * gets the hidden definitions. Upstream files are not changed for this; the wrappers are set on
 * the VM instance by installTeacherBlocks (index.js).
 *
 * - installTargets: project load / new project (wholeProject = true) and every sprite add
 *   (library, upload of .sprite2/.sprite3, paint, surprise, backpack sprite, undo of a sprite
 *   delete). duplicateSprite does not use it: Sprite.duplicate copies every block, hidden
 *   definitions included.
 * - shareBlocksToTarget: dragging a script onto another sprite or the stage, and dropping a
 *   backpack script.
 * - PROJECT_CHANGED: puts back variables that hidden definitions need (see restoreMissingVariables).
 */
const log = require('../../util/log');
const {blockOpcodeOf, parseTeacherOpcode} = require('./opcode');
const {readEmbeddedMetas} = require('./inject');

/**
 * @param {Array.<object>} blocks - VM blocks.
 * @returns {Array.<string>} the registry keys of the teacher blocks among them.
 */
const teacherKeysOf = blocks => {
    const keys = new Set();
    blocks.forEach(block => {
        const parts = parseTeacherOpcode(block && block.opcode);
        if (parts) keys.add(blockOpcodeOf(parts.id, parts.version));
    });
    return Array.from(keys);
};

/**
 * @param {VirtualMachine} vm - the VM.
 * @param {TeacherBlocksController} controller - its teacher blocks controller.
 */
const installVmHooks = (vm, controller) => {
    const registry = controller.registry;

    const originalInstallTargets = vm.installTargets;
    vm.installTargets = function (targets, extensions, wholeProject) {
        const incoming = (targets || []).filter(target => !!target);
        const metas = readEmbeddedMetas(incoming);
        if (wholeProject) registry.setEmbedded(metas);
        else registry.addEmbedded(metas);

        // Before the original: the Lesson extension must know every teacher block in the incoming
        // targets before the workspace loads them, and the variables must exist before a sprite's
        // variable references are fixed up (Target.fixUpVariableReferences merges them by name).
        const stage = wholeProject ?
            incoming.find(target => target.isStage) :
            vm.runtime.getTargetForStage();
        if (stage) controller.ensureVariables(stage);
        return controller.syncExtension()
            .then(() => originalInstallTargets.call(this, targets, extensions, wholeProject))
            .then(result => {
                controller.fillProject();
                return result;
            });
    };

    const originalShareBlocksToTarget = vm.shareBlocksToTarget;
    vm.shareBlocksToTarget = function (blocks, targetId, optFromTargetId) {
        const keys = teacherKeysOf(blocks || []);
        if (keys.length > 0) {
            const unknown = keys.filter(key => !registry.knows(key));
            if (unknown.length > 0) {
                // Blockly cannot show a block type nobody defines, so refuse the whole drop.
                log.warn(`CodKid teacher blocks: not adding blocks that use unknown teacher blocks: ${unknown}`);
                return Promise.resolve();
            }
            // A version that is not in the project yet (e.g. an old one from the backpack) joins it.
            const required = new Set(registry.requiredKeys());
            registry.addEmbedded(keys.filter(key => !required.has(key)).map(key => registry.getMeta(key)));
            controller.fillProject();
        }
        return originalShareBlocksToTarget.call(this, blocks, targetId, optFromTargetId);
    };

    let restoreScheduled = false;
    vm.runtime.on('PROJECT_CHANGED', () => {
        if (restoreScheduled) return;
        restoreScheduled = true;
        Promise.resolve().then(() => {
            restoreScheduled = false;
            controller.restoreVariables();
        });
    });
};

module.exports = {installVmHooks, teacherKeysOf};
