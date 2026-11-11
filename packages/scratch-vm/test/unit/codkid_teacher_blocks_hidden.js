/**
 * CodKid teacher blocks: hidden definitions never reach the workspace, never glow, and keep the
 * variables they need.
 */
const path = require('path');
const test = require('tap').test;
const VirtualMachine = require('../../src/virtual-machine');
const RenderedTarget = require('../../src/sprites/rendered-target');
const makeTestStorage = require('../fixtures/make-test-storage');
const readFileToBuffer = require('../fixtures/readProjectFile').readFileToBuffer;
const {addCallerScript, envelope, samples, teacherDef} = require('../fixtures/codkid-teacher-blocks');
const {findHiddenDefinitions} = require('../../src/codkid/teacher-blocks/hidden');
const sb3 = require('../../src/serialization/sb3');

const project = readFileToBuffer(path.resolve(__dirname, '../fixtures/default.sb3'));

const originalSetXY = RenderedTarget.prototype.setXY;
RenderedTarget.prototype.setXY = function (...args) {
    originalSetXY.apply(this, args);
    this.runtime.requestRedraw();
};

const DEFS = [samples.WALK_V1, samples.ADD_SCORE_V1, samples.CRABBY_SAYS_V1];

const setup = async (defs = DEFS) => {
    const vm = new VirtualMachine();
    vm.attachStorage(makeTestStorage());
    vm.setCompatibilityMode(true);
    vm.runtime.currentStepTime = 1000 / 30;
    await vm.loadProject(project);
    await vm.codkidTeacherBlocks.setDefinitions(envelope(defs));
    const sprite = vm.runtime.targets.find(t => t.isSprite() && t.isOriginal);
    return {vm, sprite, stage: vm.runtime.getTargetForStage()};
};

const lastWorkspaceXml = vm => new Promise(resolve => {
    vm.once('workspaceUpdate', data => resolve(data.xml));
    vm.emitWorkspaceUpdate();
});

const flushMicrotasks = () => new Promise(resolve => setImmediate(resolve));

test('every original target holds the definitions, but the workspace XML does not', async t => {
    const {vm, sprite, stage} = await setup();
    [stage, sprite].forEach(target => {
        t.equal(findHiddenDefinitions(target.blocks).length, DEFS.length, `${target.getName()}: all definitions`);
        const xml = target.blocks.toXML(target.comments);
        t.notOk(xml.includes('procedures_definition'), `${target.getName()}: toXML has no definition`);
        t.notOk(xml.includes('codkiddef'), `${target.getName()}: toXML has no marker`);
    });

    addCallerScript(sprite, samples.WALK_V1);
    const xml = await lastWorkspaceXml(vm);
    t.ok(xml.includes('codkidLesson_walk_v1'), 'the teacher block call is on the workspace');
    t.notOk(xml.includes('procedures_definition'), 'workspaceUpdate has no hidden definition');
    vm.quit();
});

test('a child\'s own My Block is still shown', async t => {
    const {vm, sprite} = await setup();
    // A plain My Block definition, as a child would make it (no marker).
    const own = {
        ownDef: {opcode: 'procedures_definition',
            next: null,
            parent: null,
            inputs: {custom_block: [1, 'ownProto']},
            fields: {},
            shadow: false,
            topLevel: true,
            x: 0,
            y: 0},
        ownProto: {opcode: 'procedures_prototype',
            next: null,
            parent: 'ownDef',
            inputs: {},
            fields: {},
            shadow: true,
            topLevel: false,
            mutation: {tagName: 'mutation',
                children: [],
                proccode: 'jump',
                argumentids: '[]',
                argumentnames: '[]',
                argumentdefaults: '[]',
                warp: 'false'}}
    };
    const blocks = sb3.deserializeBlocks(own);
    Object.keys(blocks).forEach(id => sprite.blocks.createBlock(blocks[id]));
    const xml = await lastWorkspaceXml(vm);
    t.ok(xml.includes('proccode="jump"'), 'the child\'s definition is on the workspace');
    t.notOk(xml.includes('codkid walk'), 'teacher definitions are not');
    vm.quit();
});

test('glow: a running teacher block lights up the calling script, never the hidden one', async t => {
    const LOOP = teacherDef({id: 'slowLoop',
        body: [
            {op: 'control_repeat', inputs: {TIMES: 5}, substack: [{op: 'motion_changexby', inputs: {DX: 10}}]}
        ]});
    const {vm, sprite} = await setup([LOOP]);
    vm.setEditingTarget(sprite.id);
    const hatId = addCallerScript(sprite, LOOP);
    const hidden = findHiddenDefinitions(sprite.blocks).map(found => found.topId);
    const glowed = [];
    vm.on('SCRIPT_GLOW_ON', data => glowed.push(data.id));
    vm.greenFlag();
    for (let i = 0; i < 10; i++) vm.runtime._step();
    t.equal(sprite.x, 50, 'the loop ran over several frames');
    t.ok(glowed.length > 0, 'something glowed');
    t.notOk(glowed.some(id => hidden.includes(id)), 'no hidden definition glowed');
    t.ok(glowed.every(id => id === hatId), 'only the calling script glowed');
    vm.quit();
});

test('a variable deleted from the palette comes back, with the same id', async t => {
    const {vm, sprite, stage} = await setup();
    const score = stage.lookupVariableByNameAndType('Score', '');
    // What Blockly sends when a child deletes the variable.
    vm.blockListener({type: 'var_delete', varId: score.id, varType: '', varName: 'Score', isLocal: false});
    t.notOk(stage.variables[score.id], 'deleted');
    let updated = false;
    vm.once('workspaceUpdate', () => {
        updated = true;
    });
    await flushMicrotasks();
    t.ok(stage.variables[score.id], 'put back on the stage');
    t.equal(stage.variables[score.id].name, 'Score', 'with the same name');
    t.ok(updated, 'the workspace is refreshed so the palette shows it again');

    addCallerScript(sprite, samples.ADD_SCORE_V1, {args: {POINTS: 3}});
    vm.greenFlag();
    for (let i = 0; i < 5; i++) vm.runtime._step();
    t.equal(stage.variables[score.id].value, 3, 'Add Score changes the stage variable');
    t.notOk(Object.values(sprite.variables).some(v => v.name === 'Score'), 'no sprite-local Score was made');
    vm.quit();
});

test('a deleted variable that was made again by the child is reused', async t => {
    const {vm, stage} = await setup();
    const score = stage.lookupVariableByNameAndType('Score', '');
    vm.blockListener({type: 'var_delete', varId: score.id, varType: '', varName: 'Score', isLocal: false});
    stage.createVariable('new-score-id', 'Score', '');
    await flushMicrotasks();
    t.notOk(stage.variables[score.id], 'the old id is not brought back');
    const ids = [];
    vm.runtime.targets.filter(target => target.isOriginal).forEach(target => {
        Object.values(target.blocks._blocks).forEach(block => {
            if (block.fields.VARIABLE) ids.push(block.fields.VARIABLE.id);
        });
    });
    t.ok(ids.length > 0 && ids.every(id => id === 'new-score-id'), 'hidden blocks now use the new variable');
    vm.quit();
});
