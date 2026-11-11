/**
 * CodKid teacher blocks (spec S-03): blocks in the "Lesson" category that work in every sprite,
 * and whose insides a child can never see or change.
 *
 * How it works: a teacher block is a block of the Lesson extension (`codkidLesson_<id>_v<n>`).
 * Running it starts a hidden custom block definition in the same target, on the same code path
 * as a My Block. The hidden definitions are put into every target and saved with the project,
 * so a project keeps the version it was made with.
 *
 * Usage: the VM constructor calls installTeacherBlocks(this). The GUI then calls
 * `vm.codkidTeacherBlocks.setDefinitions(json)` with the definitions from the lesson API
 * (format: docs/teacher-block-schema.md).
 *
 * Hook points in upstream files (marked `// CodKid:`):
 * - virtual-machine.js: calls installTeacherBlocks.
 * - extension-support/extension-manager.js: registers the Lesson extension.
 * - engine/thread.js: "stop this script" stops at a teacher block call, like at a My Block call.
 * - engine/blocks.js: toXML leaves hidden definitions out of the workspace.
 * - engine/runtime.js: a running hidden definition glows as the script that called it.
 */
const {EXTENSION_ID} = require('./opcode');
const {TeacherBlockRegistry} = require('./registry');
const {extensionIdsOf, normalizeDefinitions} = require('./definitions');
const {ensureDefinitions, ensureRequiredVariables, restoreMissingVariables} = require('./inject');
const {installVmHooks} = require('./vm-hooks');
const {setController} = require('./controller-map');

class TeacherBlocksController {
    /**
     * @param {VirtualMachine} vm - the VM this controller belongs to.
     */
    constructor (vm) {
        this.vm = vm;
        this.registry = new TeacherBlockRegistry();
        this.definitions = [];
    }

    /**
     * Set the teacher block definitions of the open lesson. Replaces the previous ones. Projects
     * that use a version that is no longer listed keep working: they contain its definition.
     * @param {*} json - `{schemaVersion: 1, definitions: [...]}`, or null for none.
     * @returns {Promise} resolves when the Lesson category and every target are up to date.
     */
    setDefinitions (json) {
        this.definitions = normalizeDefinitions(json);
        this.registry.setCatalog(this.definitions);
        const stage = this.vm.runtime.getTargetForStage();
        const createdVariables = stage ? this.ensureVariables(stage) : false;
        return this.syncExtension().then(() => {
            this.fillProject();
            if (createdVariables && this.vm.editingTarget) this.vm.emitWorkspaceUpdate();
        });
    }

    /**
     * @returns {Array.<object>} the valid definitions from the last setDefinitions call.
     */
    getDefinitions () {
        return this.definitions.slice();
    }

    /**
     * Load the Lesson extension (and extensions that bodies use) when there are teacher blocks,
     * or refresh its blocks when it is already loaded.
     * @returns {Promise} resolves when the extension info is up to date.
     */
    syncExtension () {
        const extensionManager = this.vm.extensionManager;
        if (this.registry.isEmpty() && !extensionManager.isExtensionLoaded(EXTENSION_ID)) {
            return Promise.resolve();
        }
        const ids = new Set();
        this.definitions.forEach(definition => extensionIdsOf(definition).forEach(id => ids.add(id)));
        const loads = Array.from(ids)
            .filter(id => !extensionManager.isExtensionLoaded(id))
            .map(id => extensionManager.loadExtensionURL(id));
        if (extensionManager.isExtensionLoaded(EXTENSION_ID)) {
            return Promise.all(loads).then(() => extensionManager.refreshBlocks());
        }
        return Promise.all(loads.concat(extensionManager.loadExtensionURL(EXTENSION_ID)));
    }

    /**
     * Create the stage variables the required definitions need.
     * @param {RenderedTarget} stage - the stage.
     * @returns {boolean} whether anything was created.
     */
    ensureVariables (stage) {
        return ensureRequiredVariables(this.registry, stage);
    }

    /**
     * @returns {Array.<RenderedTarget>} the stage and every sprite (not clones).
     */
    originalTargets () {
        return this.vm.runtime.targets.filter(target => target.isOriginal);
    }

    /**
     * Put every required definition into every original target.
     * @returns {boolean} whether anything was added.
     */
    fillProject () {
        const stage = this.vm.runtime.getTargetForStage();
        if (!stage) return false;
        this.ensureVariables(stage);
        const targets = this.originalTargets();
        return ensureDefinitions(this.registry, targets, stage, targets);
    }

    /**
     * Put back variables that hidden definitions use but that were deleted.
     * @returns {boolean} whether a variable was created.
     */
    restoreVariables () {
        const stage = this.vm.runtime.getTargetForStage();
        if (!stage) return false;
        const created = restoreMissingVariables(this.originalTargets(), stage);
        if (created && this.vm.editingTarget) this.vm.emitWorkspaceUpdate();
        return created;
    }
}

/**
 * Install teacher blocks on a VM. Sets `vm.codkidTeacherBlocks`.
 * @param {VirtualMachine} vm - the VM.
 * @returns {TeacherBlocksController} the controller.
 */
const installTeacherBlocks = vm => {
    if (vm.codkidTeacherBlocks) return vm.codkidTeacherBlocks;
    const controller = new TeacherBlocksController(vm);
    setController(vm.runtime, controller);
    installVmHooks(vm, controller);
    vm.codkidTeacherBlocks = controller;
    return controller;
};

module.exports = installTeacherBlocks;
