/**
 * CodKid SPIKE (throwaway): entry point for tests and the GUI dev tools.
 */
const Thread = require('../../engine/thread');
const registry = require('./registry');
const inject = require('./inject');
const samples = require('./sample-definitions');

const TEACHER_OPCODE_PREFIX = `${inject.EXTENSION_ID}_`;

/*
 * Workaround (b) for "stop this script": also stop unwinding at a teacher block call.
 * Same loop as Thread.prototype.stopThisScript (engine/thread.js), plus one condition.
 */
const originalStopThisScript = Thread.prototype.stopThisScript;
/* eslint-disable no-invalid-this */
const patchedStopThisScript = function () {
    let blockID = this.peekStack();
    while (blockID !== null) {
        const block = this.target.blocks.getBlock(blockID);
        if (typeof block !== 'undefined' &&
            (block.opcode === 'procedures_call' || block.opcode.startsWith(TEACHER_OPCODE_PREFIX))) {
            break;
        }
        this.popStack();
        blockID = this.peekStack();
    }
    if (this.stack.length === 0) {
        this.requestScriptGlowInFrame = false;
        this.status = Thread.STATUS_DONE;
    }
};
/* eslint-enable no-invalid-this */
const setStopThisScriptPatch = enabled => {
    Thread.prototype.stopThisScript = enabled ? patchedStopThisScript : originalStopThisScript;
};

/*
 * Workaround for load order: before the original installTargets loads extensions and emits
 * workspaceUpdate, read the definitions embedded in the project and refresh the extension.
 */
const installLoadHook = vm => {
    if (vm.codkidOriginalInstallTargets) return;
    const original = vm.installTargets;
    vm.codkidOriginalInstallTargets = original;
    vm.installTargets = function (targets, extensions, wholeProject) {
        // Only whole-project loads replace the embedded set (sprite upload would add to it; out of spike scope).
        if (wholeProject) {
            registry.setProjectDefinitions(inject.readEmbeddedDefinitions(targets.filter(t => !!t)));
        }
        const ready = this.extensionManager.isExtensionLoaded(inject.EXTENSION_ID) ?
            this.extensionManager.refreshBlocks() :
            Promise.resolve();
        return ready.then(() => original.call(this, targets, extensions, wholeProject));
    };
};

const uninstallLoadHook = vm => {
    if (!vm.codkidOriginalInstallTargets) return;
    vm.installTargets = vm.codkidOriginalInstallTargets;
    delete vm.codkidOriginalInstallTargets;
};

module.exports = {
    registry,
    inject,
    samples,
    setStopThisScriptPatch,
    installLoadHook,
    uninstallLoadHook
};
