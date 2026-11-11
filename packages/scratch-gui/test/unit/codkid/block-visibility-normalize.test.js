import log from '../../../src/lib/log';
import extensionLibraryContent from '../../../src/lib/libraries/extensions/index.jsx';
import {EXTENSION_CATEGORY_IDS} from '../../../src/codkid/block-visibility/known-categories';
import {
    getCategoryRule,
    isBlockVisible,
    isCategoryVisible,
    normalizeConfig
} from '../../../src/codkid/block-visibility/normalize-config';

import sampleA from '../../../src/codkid/block-visibility/samples/lesson-a-motion-basics.json';
import sampleB from '../../../src/codkid/block-visibility/samples/lesson-b-no-sound.json';

describe('CodKid block visibility: normalizeConfig', () => {
    let warn;
    beforeEach(() => {
        warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        warn.mockRestore();
    });

    test('no config means show everything', () => {
        expect(normalizeConfig(null)).toBeNull();
        expect(normalizeConfig()).toBeNull();
        expect(isCategoryVisible(null, 'sound')).toBe(true);
        expect(warn).not.toHaveBeenCalled();
    });

    test('defaults: show unlisted categories, allow the extension library', () => {
        const rules = normalizeConfig({schemaVersion: 1});
        expect(rules.defaultShow).toBe(true);
        expect(rules.allowExtensionLibrary).toBe(true);
        expect(isCategoryVisible(rules, 'pen')).toBe(true);
    });

    test('allowlist sample (a)', () => {
        const rules = normalizeConfig(sampleA);
        expect(rules.defaultShow).toBe(false);
        expect(isCategoryVisible(rules, 'motion')).toBe(true);
        expect(isCategoryVisible(rules, 'events')).toBe(true);
        expect(isCategoryVisible(rules, 'looks')).toBe(false);
        expect(isCategoryVisible(rules, 'variables')).toBe(false);
        expect(isCategoryVisible(rules, 'pen')).toBe(false);
        const motion = getCategoryRule(rules, 'motion');
        expect(isBlockVisible(motion, 'motion_movesteps')).toBe(true);
        expect(isBlockVisible(motion, 'motion_glideto')).toBe(false);
    });

    test('denylist sample (b)', () => {
        const rules = normalizeConfig(sampleB);
        expect(rules.defaultShow).toBe(true);
        expect(rules.allowExtensionLibrary).toBe(false);
        expect(isCategoryVisible(rules, 'sound')).toBe(false);
        expect(isCategoryVisible(rules, 'looks')).toBe(true);
    });

    test('aliases resolve to toolbox ids', () => {
        const rules = normalizeConfig({
            schemaVersion: 1,
            defaultCategory: 'hide',
            categories: {event: {}, data: {}, procedures: {show: false}}
        });
        expect(isCategoryVisible(rules, 'events')).toBe(true);
        expect(isCategoryVisible(rules, 'event')).toBe(true);
        expect(isCategoryVisible(rules, 'variables')).toBe(true);
        expect(isCategoryVisible(rules, 'myBlocks')).toBe(false);
    });

    test('onlyBlocks wins over hideBlocks', () => {
        const rules = normalizeConfig({
            schemaVersion: 1,
            categories: {motion: {onlyBlocks: ['motion_movesteps'], hideBlocks: ['motion_movesteps']}}
        });
        expect(isBlockVisible(getCategoryRule(rules, 'motion'), 'motion_movesteps')).toBe(true);
    });

    test('lesson category is always shown', () => {
        const rules = normalizeConfig({schemaVersion: 1, defaultCategory: 'hide', categories: {
            motion: {}, lesson: {show: false}
        }});
        expect(isCategoryVisible(rules, 'lesson')).toBe(true);
        expect(warn).toHaveBeenCalled();
    });

    test('unknown categories and buttons are ignored with a warning', () => {
        const rules = normalizeConfig({schemaVersion: 1, categories: {
            notACategory: {show: false},
            motion: {hideButtons: ['CREATE_VARIABLE']},
            variables: {hideButtons: ['CREATE_LIST', 'NOPE']}
        }});
        expect(rules).not.toBeNull();
        expect(Object.keys(rules.categories).sort()).toEqual(['motion', 'variables']);
        expect(Array.from(rules.categories.motion.hideButtons)).toEqual([]);
        expect(Array.from(rules.categories.variables.hideButtons)).toEqual(['CREATE_LIST']);
        expect(warn).toHaveBeenCalledTimes(3);
    });

    // jest 21 has no test.each
    [
        ['not an object', []],
        ['a string', 'motion'],
        ['wrong schemaVersion', {schemaVersion: 2}],
        ['missing schemaVersion', {categories: {}}],
        ['bad defaultCategory', {schemaVersion: 1, defaultCategory: 'none'}],
        ['bad allowExtensionLibrary', {schemaVersion: 1, allowExtensionLibrary: 'no'}],
        ['bad categories', {schemaVersion: 1, categories: []}],
        ['bad category entry', {schemaVersion: 1, categories: {motion: true}}],
        ['bad show', {schemaVersion: 1, categories: {motion: {show: 'yes'}}}],
        ['bad onlyBlocks', {schemaVersion: 1, categories: {motion: {onlyBlocks: 'motion_movesteps'}}}]
    ].forEach(([name, config]) => {
        test(`invalid config is rejected with a warning: ${name}`, () => {
            expect(normalizeConfig(config)).toBeNull();
            expect(warn).toHaveBeenCalledTimes(1);
        });
    });

    test('a config that hides every category is invalid', () => {
        expect(normalizeConfig({schemaVersion: 1, defaultCategory: 'hide'})).toBeNull();
        expect(normalizeConfig({schemaVersion: 1, defaultCategory: 'hide', categories: {
            motion: {show: false}
        }})).toBeNull();
        const allCoreHidden = {};
        ['motion', 'looks', 'sound', 'events', 'control', 'sensing', 'operators', 'variables', 'myBlocks']
            .forEach(id => {
                allCoreHidden[id] = {show: false};
            });
        expect(normalizeConfig({schemaVersion: 1, categories: allCoreHidden})).toBeNull();
        expect(warn).toHaveBeenCalledTimes(3);
    });

    test('showing only an extension category is valid', () => {
        expect(normalizeConfig({schemaVersion: 1, defaultCategory: 'hide', categories: {pen: {}}})).not.toBeNull();
    });

    test('known extension ids match the extension library', () => {
        const libraryIds = extensionLibraryContent.map(item => item.extensionId).filter(Boolean);
        expect(EXTENSION_CATEGORY_IDS.slice().sort()).toEqual(libraryIds.slice().sort());
    });
});
