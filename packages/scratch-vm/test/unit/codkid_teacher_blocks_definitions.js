/**
 * CodKid teacher blocks: validation of the definitions JSON (docs/teacher-block-schema.md).
 */
const fs = require('fs');
const path = require('path');
const test = require('tap').test;
const log = require('../../src/util/log');
const {normalizeDefinitions} = require('../../src/codkid/teacher-blocks/definitions');
const {TeacherBlockRegistry} = require('../../src/codkid/teacher-blocks/registry');
const {opcodeOf, parseTeacherOpcode, proccodeOf} = require('../../src/codkid/teacher-blocks/opcode');
const {envelope, samples, teacherDef} = require('../fixtures/codkid-teacher-blocks');

const {WALK_V1, WALK_V2, ADD_SCORE_V1, CRABBY_SAYS_V1} = samples;

// Run fn and collect log.warn messages.
const withWarnings = fn => {
    const warnings = [];
    const original = log.warn;
    log.warn = (...args) => warnings.push(args.join(' '));
    try {
        return {result: fn(), warnings};
    } finally {
        log.warn = original;
    }
};

const change = (definition, patch) => Object.assign(JSON.parse(JSON.stringify(definition)), patch);

// The warning for a single definition, or '' if it was accepted.
const rejection = definition => {
    const {result, warnings} = withWarnings(() => normalizeDefinitions(envelope([definition])));
    return result.length === 1 ? '' : warnings.join('\n');
};

test('opcode format', t => {
    t.equal(opcodeOf('walk', 1), 'codkidLesson_walk_v1');
    t.same(parseTeacherOpcode('codkidLesson_addScore_v12'), {id: 'addScore', version: 12});
    t.equal(parseTeacherOpcode('codkidLesson_walk'), null);
    t.equal(parseTeacherOpcode('motion_movesteps'), null);
    t.equal(proccodeOf('walk', 2, 2), 'codkid walk v2 %s %s');
    t.end();
});

test('the spec examples are valid', t => {
    const {result, warnings} = withWarnings(() => normalizeDefinitions(
        envelope([WALK_V1, WALK_V2, ADD_SCORE_V1, CRABBY_SAYS_V1])
    ));
    t.equal(result.length, 4, 'all four accepted');
    t.same(warnings, [], 'no warnings');
    t.same(result[0].inputs, [{name: 'STEPS', type: 'number', default: 1}]);
    t.equal(result[0].warp, false, 'warp defaults to false');
    t.end();
});

test('the GUI sample file is valid', t => {
    const file = path.resolve(__dirname, '../../../scratch-gui/src/codkid/teacher-blocks/samples/lesson-sample.json');
    const {result, warnings} = withWarnings(() => normalizeDefinitions(JSON.parse(fs.readFileSync(file, 'utf8'))));
    t.equal(result.length, 4, 'all definitions accepted');
    t.same(warnings, [], 'no warnings');
    t.end();
});

test('a broken envelope gives no definitions', t => {
    [null, undefined].forEach(json => t.same(normalizeDefinitions(json), [], `${json} means none`));
    [{}, {schemaVersion: 2, definitions: []}, {schemaVersion: 1}, [WALK_V1]].forEach(json => {
        const {result, warnings} = withWarnings(() => normalizeDefinitions(json));
        t.same(result, [], `${JSON.stringify(json).slice(0, 40)}: none`);
        t.equal(warnings.length, 1, 'with a warning');
    });
    t.end();
});

test('a broken definition is skipped; the others still load', t => {
    const {result, warnings} = withWarnings(() => normalizeDefinitions(
        envelope([WALK_V1, change(CRABBY_SAYS_V1, {version: 0})])
    ));
    t.same(result.map(d => d.id), ['walk'], 'walk loaded');
    t.match(warnings[0], /version/, 'warning says why');
    t.end();
});

test('the same id and version twice: the last one wins', t => {
    const {result, warnings} = withWarnings(() => normalizeDefinitions(
        envelope([WALK_V1, change(WALK_V1, {text: 'Walk [STEPS] big steps'})])
    ));
    t.equal(result.length, 1);
    t.equal(result[0].text, 'Walk [STEPS] big steps');
    t.match(warnings[0], /twice/);
    t.end();
});

test('rejected definitions', t => {
    const cases = {
        'id with "_"': [change(WALK_V1, {id: 'walk_fast'}), /id/],
        'id starting with a digit': [change(WALK_V1, {id: '2walk'}), /id/],
        'version not a whole number': [change(WALK_V1, {version: 1.5}), /version/],
        'empty text': [change(WALK_V1, {text: ' '}), /text/],
        'input missing from the text': [change(WALK_V1, {text: 'Walk steps'}), /STEPS/],
        'unknown [placeholder]': [change(WALK_V1, {text: 'Walk [STEPS] [FAST]'}), /FAST/],
        'input type boolean': [change(WALK_V1, {inputs: [{name: 'STEPS', type: 'boolean'}]}), /type/],
        'number input with a text default': [change(WALK_V1, {inputs: [{name: 'STEPS', type: 'number', default: 'x'}]}),
            /default/],
        'warp not a boolean': [change(WALK_V1, {warp: 'yes'}), /warp/],
        'variable not listed': [change(ADD_SCORE_V1, {variables: []}), /Score/],
        'variable listed as a list': [change(ADD_SCORE_V1, {variables: [{name: 'Score', type: 'list'}]}), /Score/],
        'argument reporter with an unknown name': [teacherDef({id: 'bad',
            body: [
                {op: 'motion_movesteps', inputs: {STEPS: {arg: 'DISTANCE'}}}
            ]}), /DISTANCE/],
        'a hat block': [teacherDef({id: 'bad', body: [{op: 'event_whenflagclicked'}]}), /hat/],
        'a My Block call': [teacherDef({id: 'bad', body: [{op: 'procedures_call', mutation: {proccode: 'x'}}]}),
            /My Blocks/],
        'a teacher block call': [teacherDef({id: 'bad', body: [{op: 'codkidLesson_walk_v1'}]}), /teacher block/],
        'an extension that is not allowed': [teacherDef({id: 'bad', body: [{op: 'videoSensing_videoToggle'}]}),
            /videoSensing/],
        'two scripts': [change(WALK_V1, {blocks: Object.assign({}, WALK_V1.blocks, {
            extra: {opcode: 'looks_show',
                next: null,
                parent: null,
                inputs: {},
                fields: {},
                shadow: false,
                topLevel: true,
                x: 0,
                y: 0}
        })}), /exactly one script/],
        'a link to a missing block': [change(WALK_V1, {blocks: Object.assign({}, WALK_V1.blocks, {
            'walk-v1-1': Object.assign({}, WALK_V1.blocks['walk-v1-1'], {next: 'nowhere'})
        })}), /missing block/]
    };
    Object.keys(cases).forEach(name => {
        const [definition, pattern] = cases[name];
        t.match(rejection(definition), pattern, name);
    });
    t.end();
});

test('accepted variations', t => {
    t.equal(rejection(teacherDef({id: 'nothing'})), '', 'an empty body');
    t.equal(rejection(teacherDef({id: 'penDown', body: [{op: 'pen_penDown'}]})), '', 'a pen block');
    t.equal(rejection(change(WALK_V1, {inputs: [{name: 'STEPS', type: 'number'}]})), '', 'no default (0)');
    t.equal(rejection(teacherDef({id: 'shout',
        body: [
            {op: 'event_broadcast',
                inputs: {BROADCAST_INPUT: {op: 'event_broadcast_menu',
                    fields: {BROADCAST_OPTION: {broadcast: 'go'}}}}}
        ],
        variables: [{name: 'go', type: 'broadcast'}]})), '', 'a broadcast');
    t.end();
});

test('registry: palette shows the newest version of each id unless it is deleted', t => {
    const registry = new TeacherBlockRegistry();
    registry.setCatalog(normalizeDefinitions(envelope([
        CRABBY_SAYS_V1, WALK_V1, WALK_V2, change(ADD_SCORE_V1, {deleted: true})
    ])));
    t.same(Array.from(registry.paletteKeys()), ['crabbySays_v1', 'walk_v2']);
    registry.setEmbedded([{id: 'jump', version: 3, text: 'Jump', inputs: [], variables: []}]);
    t.same(registry.requiredKeys().sort(), ['crabbySays_v1', 'jump_v3', 'walk_v2']);
    t.same(registry.blockEntries().map(entry => `${entry.key}:${entry.inPalette}`), [
        'crabbySays_v1:true', 'walk_v1:false', 'walk_v2:true', 'addScore_v1:false', 'jump_v3:false'
    ], 'every known version is defined, in catalog order');
    t.ok(registry.knows('jump_v3') && !registry.knows('jump_v1'));
    t.end();
});
