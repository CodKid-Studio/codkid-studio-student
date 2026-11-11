/**
 * CodKid SPIKE (throwaway): dev tools to check the load order of teacher blocks in the browser.
 * Exposes window.codkidSpike. Dev builds only.
 */
// The VM package has no subpath exports, so import the spike module by path (same file as the VM bundle uses).
import spike from '../../../../scratch-vm/src/codkid/teacher-blocks-spike/index.js';

const EXTENSION_ID = spike.inject.EXTENSION_ID;
const TEACHER_PREFIX = `${EXTENSION_ID}_`;

const unique = list => Array.from(new Set(list));

const toBase64 = async blob => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    bytes.forEach(b => {
        binary += String.fromCharCode(b);
    });
    return window.btoa(binary);
};

const fromBase64 = base64 => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
};

const installTeacherBlocksSpike = (vm, ScratchBlocks) => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined' || window.codkidSpike) return;

    const log = [];
    const errors = [];

    const opcodesOf = info => info.blocks.map(b => b.info && b.info.opcode).filter(Boolean);
    const teacherBlocksInVm = () => {
        const target = vm.editingTarget;
        if (!target) return [];
        return Object.values(target.blocks._blocks)
            .filter(b => b.opcode.startsWith(TEACHER_PREFIX))
            .map(b => b.opcode);
    };

    vm.addListener('EXTENSION_ADDED', info => {
        if (info.id === EXTENSION_ID) log.push({event: 'EXTENSION_ADDED', opcodes: opcodesOf(info)});
    });
    vm.addListener('BLOCKSINFO_UPDATE', info => {
        if (info.id === EXTENSION_ID) log.push({event: 'BLOCKSINFO_UPDATE', opcodes: opcodesOf(info)});
    });
    // Registered after blocks.jsx's own listener, so the workspace has already been loaded here.
    vm.addListener('workspaceUpdate', () => {
        const inVm = teacherBlocksInVm();
        const workspace = ScratchBlocks.getMainWorkspace();
        const onWorkspace = workspace ?
            workspace.getAllBlocks().filter(b => b.type.startsWith(TEACHER_PREFIX)) :
            [];
        log.push({
            event: 'workspaceUpdate',
            target: vm.editingTarget && vm.editingTarget.getName(),
            teacherBlocksInVm: inVm.length,
            teacherBlocksOnWorkspace: onWorkspace.length,
            notDefinedInScratchBlocks: unique(inVm).filter(op => !ScratchBlocks.Blocks[op]),
            labels: unique(onWorkspace.map(b => b.toString()))
        });
    });

    const originalConsoleError = window.console.error;
    window.console.error = (...args) => {
        errors.push(args.map(a => (a && a.message) || String(a)).join(' '));
        originalConsoleError.apply(window.console, args);
    };

    const makeDemo = (defs, callers) => {
        spike.inject.injectAll(vm.runtime, defs);
        const sprite = vm.editingTarget;
        callers.forEach(([def, args], i) => {
            spike.inject.addCallerScript(vm.runtime, sprite, def, {args, x: 40, y: 40 + (i * 140)});
        });
        vm.emitWorkspaceUpdate();
    };

    window.codkidSpike = {
        vm,
        spike,
        log,
        errors,
        clearLog () {
            log.length = 0;
            errors.length = 0;
        },
        setCatalog (name) {
            spike.registry.setCatalog(spike.samples.CATALOGS[name]);
        },
        loadExtension () {
            return vm.extensionManager.loadExtensionURL(EXTENSION_ID);
        },
        isExtensionLoaded () {
            return vm.extensionManager.isExtensionLoaded(EXTENSION_ID);
        },
        setLoadHook (enabled) {
            if (enabled) spike.installLoadHook(vm);
            else spike.uninstallLoadHook(vm);
        },
        // Project A: all three v1 teacher blocks on the editing sprite.
        async makeProjectA () {
            const {WALK_V1, ADD_SCORE_V1, CRABBY_SAYS_V1} = spike.samples;
            spike.registry.setCatalog(spike.samples.CATALOGS.v1);
            await this.loadExtension();
            makeDemo(spike.samples.CATALOGS.v1, [
                [CRABBY_SAYS_V1, {MESSAGE: 'start'}],
                [WALK_V1, {STEPS: 1}],
                [ADD_SCORE_V1, {POINTS: 1}]
            ]);
        },
        // Project B: only Walk v1.
        async makeProjectB () {
            const {WALK_V1} = spike.samples;
            spike.registry.setCatalog(spike.samples.CATALOGS.v1);
            await this.loadExtension();
            makeDemo([WALK_V1], [[WALK_V1, {STEPS: 5}]]);
        },
        async save () {
            return toBase64(await vm.saveProjectSb3());
        },
        load (base64) {
            return vm.loadProject(fromBase64(base64));
        }
    };
};

export default installTeacherBlocksSpike;
