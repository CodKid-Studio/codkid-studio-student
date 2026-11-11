/**
 * CodKid SPIKE (throwaway): does a teacher block (extension block that calls a hidden procedure definition)
 * behave exactly like a native My Block (procedures_call)?
 *
 * Every scenario runs twice — once with procedures_call, once with the teacher block — and compares the
 * sprite state after every frame.
 */
const path = require('path');
const test = require('tap').test;
const VirtualMachine = require('../../src/virtual-machine');
const RenderedTarget = require('../../src/sprites/rendered-target');
const makeTestStorage = require('../fixtures/make-test-storage');
const readFileToBuffer = require('../fixtures/readProjectFile').readFileToBuffer;
const spike = require('../../src/codkid/teacher-blocks-spike');

const {registry, inject, samples} = spike;
const project = readFileToBuffer(path.resolve(__dirname, '../fixtures/default.sb3'));

// Headless there is no renderer, so nothing requests a redraw and non-warp loops never yield.
// Emulate the GUI: moving a visible sprite requests a redraw.
const originalSetXY = RenderedTarget.prototype.setXY;
RenderedTarget.prototype.setXY = function (...args) {
    originalSetXY.apply(this, args);
    this.runtime.requestRedraw();
};

const changeX = dx => ({op: 'motion_changexby', inputs: {DX: dx}});
const changeY = dy => ({op: 'motion_changeyby', inputs: {DY: dy}});
const stopThisScript = {op: 'control_stop', fields: {STOP_OPTION: 'this script'}, mutation: {hasnext: 'false'}};
const ifXGreaterThan = (n, substack) => ({
    op: 'control_if',
    inputs: {CONDITION: {op: 'operator_gt', inputs: {OPERAND1: {op: 'motion_xposition'}, OPERAND2: n}}},
    substack
});
const testDef = (id, warp, body) => ({id, version: 1, warp, text: id, inputs: [], variables: [], body});

const repeat10 = substack => ({op: 'control_repeat', inputs: {TIMES: 10}, substack});
const LOOP_NO_WARP = testDef('loopNoWarp', false, [repeat10([changeX(10)])]);
const LOOP_WARP = testDef('loopWarp', true, [repeat10([changeX(10)])]);
const STOP_PLAIN = testDef('stopPlain', false, [changeX(10), stopThisScript, changeX(100)]);
const STOP_IN_IF = testDef('stopInIf', false, [changeX(10), ifXGreaterThan(5, [stopThisScript]), changeX(100)]);
const STOP_IN_WARP_LOOP = testDef('stopInWarpLoop', true, [
    {op: 'control_repeat', inputs: {TIMES: 10}, substack: [changeX(10), ifXGreaterThan(50, [stopThisScript])]},
    changeX(1000)
]);
const TEST_DEFS = [LOOP_NO_WARP, LOOP_WARP, STOP_PLAIN, STOP_IN_IF, STOP_IN_WARP_LOOP];
const ALL_DEFS = TEST_DEFS.concat(samples.CATALOGS.v1);

const setup = async () => {
    const vm = new VirtualMachine();
    vm.attachStorage(makeTestStorage());
    vm.setCompatibilityMode(true);
    // Normally set by runtime.start(); without it the sequencer's work time is 0.
    vm.runtime.currentStepTime = 1000 / 30;
    await vm.loadProject(project);
    registry.setCatalog(ALL_DEFS);
    registry.setProjectDefinitions([]);
    await vm.extensionManager.loadExtensionURL(inject.EXTENSION_ID);
    inject.injectAll(vm.runtime, ALL_DEFS);
    const sprite = vm.runtime.targets.find(t => t.isSprite() && t.isOriginal);
    return {vm, sprite};
};

const snapshot = (vm, sprite) => {
    const score = vm.runtime.getTargetForStage().lookupVariableByNameAndType('Score', '');
    return {
        x: sprite.x,
        y: sprite.y,
        costume: sprite.currentCostume,
        score: score ? score.value : null,
        threads: vm.runtime.threads.length
    };
};

// Run frame by frame (one runtime._step = one 30fps frame) and record the state after each frame.
const runFrames = async (def, native, args) => {
    const {vm, sprite} = await setup();
    inject.addCallerScript(vm.runtime, sprite, def, {native, args, after: [changeY(5)]});
    vm.greenFlag();
    const frames = [];
    for (let i = 0; i < 60; i++) {
        vm.runtime._step();
        frames.push(snapshot(vm, sprite));
        if (vm.runtime.threads.length === 0) break;
    }
    vm.quit();
    return frames;
};

const compare = async (t, def, args) => {
    const nativeFrames = await runFrames(def, true, args);
    const teacherFrames = await runFrames(def, false, args);
    t.comment(`${def.id} native : ${JSON.stringify(nativeFrames.map(f => [f.x, f.y]))}`);
    t.comment(`${def.id} teacher: ${JSON.stringify(teacherFrames.map(f => [f.x, f.y]))}`);
    return {nativeFrames, teacherFrames};
};

test('1-a warp: same frames as a native My Block', async t => {
    spike.setStopThisScriptPatch(false);
    for (const def of [LOOP_NO_WARP, LOOP_WARP]) {
        const {nativeFrames, teacherFrames} = await compare(t, def);
        t.same(teacherFrames, nativeFrames, `${def.id}: frame by frame equal`);
    }
    const warp = await runFrames(LOOP_WARP, false);
    const noWarp = await runFrames(LOOP_NO_WARP, false);
    t.equal(warp[0].x, 100, 'warp: whole loop runs in the first frame');
    t.ok(noWarp[0].x < 100, `no warp: loop spreads over frames (first frame x=${noWarp[0].x})`);
});

test('1-b stop this script: upstream thread.js (no workaround)', async t => {
    spike.setStopThisScriptPatch(false);
    for (const def of [STOP_PLAIN, STOP_IN_IF, STOP_IN_WARP_LOOP]) {
        const {nativeFrames, teacherFrames} = await compare(t, def);
        const n = nativeFrames[nativeFrames.length - 1];
        const s = teacherFrames[teacherFrames.length - 1];
        t.equal(n.y, 5, `${def.id}: native My Block returns to the caller (y=5)`);
        t.notSame(teacherFrames, nativeFrames,
            `${def.id}: teacher block differs (x=${s.x}, y=${s.y} vs native x=${n.x}, y=${n.y})`);
    }
});

test('1-d stop this script: with the stopThisScript workaround', async t => {
    spike.setStopThisScriptPatch(true);
    for (const def of [STOP_PLAIN, STOP_IN_IF, STOP_IN_WARP_LOOP]) {
        const {nativeFrames, teacherFrames} = await compare(t, def);
        t.same(teacherFrames, nativeFrames, `${def.id}: frame by frame equal`);
    }
    spike.setStopThisScriptPatch(false);
});

test('1-c lesson examples: Walk, Add Score', async t => {
    const {WALK_V1, ADD_SCORE_V1} = samples;
    const walk = await compare(t, WALK_V1, {STEPS: 3});
    t.same(walk.teacherFrames, walk.nativeFrames, 'Walk: frame by frame equal');
    const lastWalk = walk.teacherFrames[walk.teacherFrames.length - 1];
    t.equal(lastWalk.x, 30, 'Walk 3 moves 30 steps');
    t.equal(lastWalk.costume, 1, 'Walk switches to the next costume');
    t.equal(lastWalk.y, 5, 'Walk returns to the caller');

    const score = await compare(t, ADD_SCORE_V1, {POINTS: 2});
    t.same(score.teacherFrames, score.nativeFrames, 'Add Score: frame by frame equal');
    t.equal(score.teacherFrames[score.teacherFrames.length - 1].score, 2, 'Score goes from 0 to 2');
});

test('1-c Add Score: Score is created as a stage variable when missing', async t => {
    const {vm} = await setup();
    const stage = vm.runtime.getTargetForStage();
    const score = stage.lookupVariableByNameAndType('Score', '');
    t.ok(score, 'Score exists on the stage');
    vm.runtime.targets.filter(x => x.isSprite()).forEach(sprite => {
        t.notOk(Object.values(sprite.variables).some(v => v.name === 'Score'), 'no sprite-local Score');
    });
    vm.quit();
});

// say for 2 secs uses a real setTimeout, so run frames in real time.
const runRealTime = async (def, native, args) => {
    const {vm, sprite} = await setup();
    inject.addCallerScript(vm.runtime, sprite, def, {native, args, after: [changeY(5)]});
    const events = [];
    vm.runtime.on('SAY', (target, type, text) => events.push(`say "${text}"`));
    vm.greenFlag();
    const start = Date.now();
    let lastY = sprite.y;
    while (Date.now() - start < 4000) {
        vm.runtime._step();
        if (sprite.y !== lastY) {
            events.push(`y=${sprite.y} at ~${Math.round((Date.now() - start) / 100) / 10}s`);
            lastY = sprite.y;
        }
        if (vm.runtime.threads.length === 0) break;
        await new Promise(resolve => setTimeout(resolve, 1000 / 30));
    }
    vm.quit();
    return events;
};

test('1-c Start! Crabby says...: waits, then returns to the caller', async t => {
    const nativeEvents = await runRealTime(samples.CRABBY_SAYS_V1, true, {MESSAGE: 'start'});
    const teacherEvents = await runRealTime(samples.CRABBY_SAYS_V1, false, {MESSAGE: 'start'});
    t.comment(`native : ${nativeEvents.join(' → ')}`);
    t.comment(`teacher: ${teacherEvents.join(' → ')}`);
    const strip = events => events.map(e => e.replace(/ at ~.*$/, ''));
    t.same(strip(teacherEvents), strip(nativeEvents), 'same event order');
    // Headless (no renderer) the bubble is cleared without a SAY event, for native My Blocks too.
    t.same(strip(teacherEvents), ['say "start"', 'y=5'], 'say, then the next block');
    const y = teacherEvents.find(e => e.startsWith('y=5'));
    t.ok(Number(y.match(/~([\d.]+)s/)[1]) >= 1.9, `next block runs after ~2 seconds (${y})`);
});

test('extra: embedded metadata survives sb3 save → load, and teacher blocks still run', async t => {
    const {vm, sprite} = await setup();
    inject.addCallerScript(vm.runtime, sprite, samples.WALK_V1, {args: {STEPS: 3}});
    const sb3 = await (await vm.saveProjectSb3()).arrayBuffer();
    const json = JSON.parse(vm.toJSON());
    t.ok(json.extensions.includes(inject.EXTENSION_ID), 'project.json lists the extension');
    vm.quit();

    const vm2 = new VirtualMachine();
    vm2.attachStorage(makeTestStorage());
    vm2.runtime.currentStepTime = 1000 / 30;
    await vm2.loadProject(sb3);
    const embedded = inject.readEmbeddedDefinitions(vm2.runtime.targets);
    t.same(embedded.map(inject.opcodeOf).sort(), ALL_DEFS.map(inject.opcodeOf).sort(),
        'codkiddef metadata is still in the prototype mutations');
    const sprite2 = vm2.runtime.targets.find(x => x.isSprite() && x.isOriginal);
    vm2.greenFlag();
    for (let i = 0; i < 10; i++) vm2.runtime._step();
    t.equal(sprite2.x, 30, 'Walk 3 still moves 30 steps after reload');
    vm2.quit();
});
