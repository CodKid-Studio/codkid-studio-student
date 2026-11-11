/**
 * CodKid teacher blocks: every way a target enters the project gets the hidden definitions, and
 * a project keeps the definition version it was made with.
 */
const path = require('path');
const test = require('tap').test;
const VirtualMachine = require('../../src/virtual-machine');
const RenderedTarget = require('../../src/sprites/rendered-target');
const makeTestStorage = require('../fixtures/make-test-storage');
const readFileToBuffer = require('../fixtures/readProjectFile').readFileToBuffer;
const {addCallerScript, envelope, samples} = require('../fixtures/codkid-teacher-blocks');
const {collectScriptBlockIds, findHiddenDefinitions} = require('../../src/codkid/teacher-blocks/hidden');

const project = readFileToBuffer(path.resolve(__dirname, '../fixtures/default.sb3'));
const {WALK_V1, WALK_V2, ADD_SCORE_V1, CRABBY_SAYS_V1} = samples;

const originalSetXY = RenderedTarget.prototype.setXY;
RenderedTarget.prototype.setXY = function (...args) {
    originalSetXY.apply(this, args);
    this.runtime.requestRedraw();
};

const newVm = () => {
    const vm = new VirtualMachine();
    vm.attachStorage(makeTestStorage());
    vm.setCompatibilityMode(true);
    vm.runtime.currentStepTime = 1000 / 30;
    return vm;
};

const firstSprite = vm => vm.runtime.targets.find(t => t.isSprite() && t.isOriginal);
const originals = vm => vm.runtime.targets.filter(t => t.isOriginal);
const keysIn = target => findHiddenDefinitions(target.blocks).map(found => found.key)
    .sort();
const paletteOf = vm => {
    const info = vm.runtime._blockInfo.find(category => category.id === 'codkidLesson');
    if (!info) return null;
    return info.blocks.filter(block => block.info && !block.info.hideFromPalette).map(block => block.info.opcode);
};
const allBlocksOf = vm => {
    const info = vm.runtime._blockInfo.find(category => category.id === 'codkidLesson');
    return info ? info.blocks.map(block => block.info.opcode) : [];
};

// Run the green flag for a few frames and return the sprite's x.
const runX = (vm, sprite) => {
    vm.greenFlag();
    for (let i = 0; i < 10; i++) vm.runtime._step();
    return sprite.x;
};

/** A saved project in which Sprite1 uses Walk v1 (made when the catalog had v1). */
const makeWalkV1Project = async () => {
    const vm = newVm();
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1, ADD_SCORE_V1]));
    addCallerScript(firstSprite(vm), WALK_V1, {args: {STEPS: 3}});
    const sb3 = await (await vm.saveProjectSb3()).arrayBuffer();
    vm.quit();
    return sb3;
};

test('project load: definitions set before the load are put into every target', async t => {
    const vm = newVm();
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1, CRABBY_SAYS_V1]));
    await vm.loadProject(project);
    originals(vm).forEach(target => {
        t.same(keysIn(target), ['crabbySays_v1', 'walk_v1'], `${target.getName()} has both definitions`);
    });
    t.same(paletteOf(vm), ['walk_v1', 'crabbySays_v1'], 'palette in catalog order');
    vm.quit();
});

test('definitions that arrive after the project load are put into every target', async t => {
    const vm = newVm();
    await vm.loadProject(project);
    t.same(keysIn(vm.runtime.getTargetForStage()), [], 'nothing before');
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1]));
    originals(vm).forEach(target => t.same(keysIn(target), ['walk_v1'], `${target.getName()} has walk_v1`));
    vm.quit();
});

test('setting the same definitions again adds nothing', async t => {
    const vm = newVm();
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1]));
    const count = Object.keys(firstSprite(vm).blocks._blocks).length;
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1]));
    t.equal(Object.keys(firstSprite(vm).blocks._blocks).length, count, 'same number of blocks');
    vm.quit();
});

test('load order: the Lesson extension knows the project\'s blocks before the workspace loads', async t => {
    const sb3 = await makeWalkV1Project();
    const vm = newVm();
    // The lesson now has Walk v2 only; the project uses Walk v1.
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V2]));
    const seen = [];
    vm.on('workspaceUpdate', () => seen.push(allBlocksOf(vm)));
    await vm.loadProject(sb3);
    t.ok(seen.length > 0, 'workspace updated');
    t.ok(seen[0].includes('walk_v1'), 'walk_v1 is defined when the workspace loads');
    t.same(paletteOf(vm), ['walk_v2'], 'the palette shows only the lesson\'s version');
    vm.quit();
});

test('versions: a project keeps the version it was made with', async t => {
    const sb3 = await makeWalkV1Project();
    const vm = newVm();
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V2]));
    await vm.loadProject(sb3);
    originals(vm).forEach(target => {
        t.ok(keysIn(target).includes('walk_v1') && keysIn(target).includes('walk_v2'),
            `${target.getName()} has the project's v1 and the lesson's v2`);
    });
    t.equal(runX(vm, firstSprite(vm)), 30, 'the v1 block still moves 3 x 10 (v2 would be 3 x 20)');
    vm.quit();
});

test('deleted: a deleted teacher block leaves the palette but old projects still run', async t => {
    const sb3 = await makeWalkV1Project();
    const vm = newVm();
    await vm.codkidTeacherBlocks.setDefinitions(envelope([Object.assign({}, WALK_V2, {deleted: true})]));
    await vm.loadProject(sb3);
    t.same(paletteOf(vm), [], 'no Walk in the palette');
    t.equal(runX(vm, firstSprite(vm)), 30, 'the project\'s Walk v1 still runs');
    vm.quit();
});

test('sprite upload (.sprite3): definitions it brings spread to every target, variables join the stage', async t => {
    // Make a sprite that uses Walk v1 and Add Score v1.
    const source = newVm();
    await source.loadProject(project);
    await source.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1, ADD_SCORE_V1]));
    const exported = firstSprite(source);
    addCallerScript(exported, WALK_V1, {args: {STEPS: 2}});
    addCallerScript(exported, ADD_SCORE_V1, {args: {POINTS: 4}});
    const sprite3 = await source.exportSprite(exported.id, 'nodebuffer');
    source.quit();

    // Another lesson: only Crabby says.
    const vm = newVm();
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope([CRABBY_SAYS_V1]));
    await vm.addSprite(sprite3);
    const added = vm.editingTarget;
    t.not(added, firstSprite(vm), 'a new sprite was added');
    originals(vm).forEach(target => {
        t.same(keysIn(target), ['addScore_v1', 'crabbySays_v1', 'walk_v1'], `${target.getName()}: all three`);
    });
    t.same(paletteOf(vm), ['crabbySays_v1'], 'the palette still shows only this lesson\'s blocks');
    t.ok(allBlocksOf(vm).includes('walk_v1'), 'but walk_v1 is defined, so the sprite\'s scripts render');

    const stage = vm.runtime.getTargetForStage();
    const scores = Object.values(stage.variables).filter(v => v.name === 'Score');
    t.equal(scores.length, 1, 'one Score on the stage');
    t.notOk(Object.values(added.variables).some(v => v.name === 'Score'), 'no sprite-local Score');
    vm.greenFlag();
    for (let i = 0; i < 10; i++) vm.runtime._step();
    t.equal(added.x, 20, 'Walk 2 runs in the uploaded sprite');
    t.equal(scores[0].value, 4, 'Add Score 4 changes the stage Score');
    vm.quit();
});

test('sprite add of a sprite that already has the definitions (e.g. undo delete): no duplicates', async t => {
    const vm = newVm();
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1]));
    const sprite3 = await vm.exportSprite(firstSprite(vm).id, 'nodebuffer');
    await vm.addSprite(sprite3);
    t.same(keysIn(vm.editingTarget), ['walk_v1'], 'one walk_v1 definition');
    vm.quit();
});

test('duplicate sprite: the copy has the definitions once, and they run', async t => {
    const vm = newVm();
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1]));
    const sprite = firstSprite(vm);
    addCallerScript(sprite, WALK_V1, {args: {STEPS: 1}});
    await vm.duplicateSprite(sprite.id);
    const copy = vm.editingTarget;
    t.not(copy, sprite, 'duplicated');
    t.same(keysIn(copy), ['walk_v1'], 'one walk_v1 definition');
    t.notOk(copy.blocks.toXML(copy.comments).includes('procedures_definition'), 'still hidden');
    const copyStartX = copy.x; // A duplicate is placed at a random position.
    vm.greenFlag();
    for (let i = 0; i < 10; i++) vm.runtime._step();
    t.equal(sprite.x, 10, 'Walk 1 moves the original 10 steps');
    t.equal(copy.x - copyStartX, 10, 'and the copy 10 steps');
    vm.quit();
});

test('stage: definitions are in the stage too', async t => {
    const vm = newVm();
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope([CRABBY_SAYS_V1]));
    t.same(keysIn(vm.runtime.getTargetForStage()), ['crabbySays_v1'], 'stage has the definition');
    vm.quit();
});

// The blocks of a target's top-level script, as the GUI sends them when a script is dragged.
const scriptBlocks = (target, topId) => collectScriptBlockIds(target.blocks, topId)
    .map(id => JSON.parse(JSON.stringify(target.blocks.getBlock(id))));

test('drag to another sprite / backpack drop: the target gets the definition first', async t => {
    const vm = newVm();
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1, WALK_V2]));
    const sprite = firstSprite(vm);
    const stage = vm.runtime.getTargetForStage();
    t.same(keysIn(stage), ['walk_v2'], 'only the palette version at first');

    // An old version, e.g. from the backpack: the catalog still lists it.
    const hat = addCallerScript(sprite, WALK_V1);
    await vm.shareBlocksToTarget(scriptBlocks(sprite, hat), stage.id, sprite.id);
    t.same(keysIn(stage), ['walk_v1', 'walk_v2'], 'the stage got walk_v1 before the script');
    t.same(keysIn(sprite), ['walk_v1', 'walk_v2'], 'and so did every other target');
    t.ok(Object.values(stage.blocks._blocks).some(block => block.opcode === 'codkidLesson_walk_v1'),
        'the script was added');
    vm.quit();
});

test('drop of an unknown teacher block version is refused', async t => {
    const vm = newVm();
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope([WALK_V1]));
    const sprite = firstSprite(vm);
    const before = Object.keys(sprite.blocks._blocks).length;
    const blocks = [{
        id: 'unknown1',
        opcode: 'codkidLesson_walk_v9',
        inputs: {},
        fields: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: true,
        x: 0,
        y: 0
    }];
    await vm.shareBlocksToTarget(blocks, sprite.id);
    t.equal(Object.keys(sprite.blocks._blocks).length, before, 'nothing was added');
    vm.quit();
});

test('a project without teacher blocks and no lesson does not load the Lesson extension', async t => {
    const vm = newVm();
    await vm.loadProject(project);
    t.notOk(vm.extensionManager.isExtensionLoaded('codkidLesson'), 'not loaded');
    vm.quit();
});
