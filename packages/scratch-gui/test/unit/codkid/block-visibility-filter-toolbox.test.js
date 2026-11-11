import log from '../../../src/lib/log';
import makeToolboxXML from '../../../src/lib/make-toolbox-xml';
import {setBlockVisibility} from '../../../src/codkid/block-visibility/config-store';
import {applyBlockVisibility, filterToolboxXML} from '../../../src/codkid/block-visibility/filter-toolbox-xml';
import {normalizeConfig} from '../../../src/codkid/block-visibility/normalize-config';

import sampleA from '../../../src/codkid/block-visibility/samples/lesson-a-motion-basics.json';
import sampleB from '../../../src/codkid/block-visibility/samples/lesson-b-no-sound.json';

// An extension category in the format of vm.runtime.getBlocksXML(): blocks, a sep, a button.
const penCategory = {
    id: 'pen',
    xml: '<category name="Pen" id="pen" colour="#0fBD8C" secondaryColour="#0DA57A">' +
        '<block type="pen_clear"></block><sep gap="36"/><block type="pen_stamp"></block>' +
        '<button text="Help" callbackKey="PEN_HELP"></button></category>'
};

// The Lesson extension's category, with three teacher blocks.
const lessonCategory = {
    id: 'codkidLesson',
    xml: '<category name="Lesson" id="codkidLesson" colour="#1E8CAE" secondaryColour="#1A7B99">' +
        '<block type="codkidLesson_crabbySays_v1"></block><block type="codkidLesson_walk_v2"></block>' +
        '<block type="codkidLesson_addScore_v1"></block></category>'
};

const spriteToolbox = () => makeToolboxXML(false, false, 'sprite1', [penCategory], 'costume1', 'backdrop1', 'pop');
const stageToolbox = () => makeToolboxXML(false, true, 'stage', [penCategory], 'costume1', 'backdrop1', 'pop');

const elementChildren = node => Array.prototype.filter.call(node.childNodes, child => child.nodeType === 1);
const describeElement = element => {
    const tag = element.tagName.toLowerCase();
    return tag === 'block' ? `block:${element.getAttribute('type')}` : tag;
};

/**
 * Summarise toolbox XML as {categoryId: ['block:type', 'sep', 'label', ...]}, in order.
 * @param {string} xml - toolbox XML.
 * @returns {{root: Element, ids: Array.<string>, categories: object}} summary.
 */
const summarise = xml => {
    const root = new DOMParser().parseFromString(xml, 'text/xml').documentElement;
    const categories = {};
    const ids = [];
    elementChildren(root)
        .filter(child => child.tagName.toLowerCase() === 'category')
        .forEach(category => {
            const id = category.getAttribute('id');
            ids.push(id);
            categories[id] = elementChildren(category).map(describeElement);
        });
    return {root, ids, categories};
};

const blocksOf = list => list.filter(item => item.startsWith('block:')).map(item => item.slice(6));

const expectTidySeps = list => {
    expect(list[0]).not.toBe('sep');
    list.forEach((item, index) => {
        if (index > 0 && item === 'sep') expect(list[index - 1]).not.toBe('sep');
    });
};

describe('CodKid block visibility: toolbox XML filter', () => {
    let warn;
    beforeEach(() => {
        warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        setBlockVisibility(null);
        warn.mockRestore();
    });

    test('no config: makeToolboxXML output is not changed at all', () => {
        const xml = '<xml><category id="motion"></category></xml>';
        expect(applyBlockVisibility(xml)).toBe(xml);
        expect(filterToolboxXML(xml, null, 1)).toBe(xml);
        expect(summarise(spriteToolbox()).ids).toEqual([
            'motion', 'looks', 'sound', 'events', 'control', 'sensing', 'operators', 'variables', 'myBlocks', 'pen'
        ]);
    });

    test('sample (a): only Motion move / turn / go to x:y and Events when flag clicked', () => {
        setBlockVisibility(sampleA);
        const {root, ids, categories} = summarise(spriteToolbox());
        expect(ids).toEqual(['motion', 'events']);
        expect(blocksOf(categories.motion)).toEqual([
            'motion_movesteps', 'motion_turnright', 'motion_turnleft', 'motion_gotoxy'
        ]);
        expect(blocksOf(categories.events)).toEqual(['event_whenflagclicked']);
        // Core categories end with a sep that sets the gap before the next category: keep it.
        expect(categories.motion[categories.motion.length - 1]).toBe('sep');
        expectTidySeps(categories.motion);
        expectTidySeps(categories.events);
        // Shadows inside kept blocks are untouched.
        const moveSteps = root.querySelector('block[type="motion_movesteps"]');
        expect(moveSteps.querySelector('shadow[type="math_number"] field[name="NUM"]').textContent).toBe('10');
        // No sep is left between or around the remaining categories.
        expect(elementChildren(root).map(describeElement)).toEqual(['category', 'sep', 'category']);
    });

    test('sample (a) with the Stage selected keeps the Motion label', () => {
        setBlockVisibility(sampleA);
        const {ids, categories} = summarise(stageToolbox());
        expect(ids).toEqual(['motion', 'events']);
        expect(categories.motion).toContain('label');
        expect(blocksOf(categories.events)).toEqual(['event_whenflagclicked']);
    });

    test('sample (b): no Sound; every other category is exactly as upstream', () => {
        const upstream = summarise(spriteToolbox());
        setBlockVisibility(sampleB);
        const filtered = summarise(spriteToolbox());
        expect(filtered.ids).toEqual(upstream.ids.filter(id => id !== 'sound'));
        filtered.ids.forEach(id => {
            expect(filtered.categories[id]).toEqual(upstream.categories[id]);
        });
    });

    test('hideBlocks keeps the upstream sep layout around the remaining blocks', () => {
        const upstream = summarise(makeToolboxXML(false, false, 'sprite1'));
        setBlockVisibility({schemaVersion: 1, categories: {looks: {hideBlocks: ['looks_say', 'looks_sayforsecs']}}});
        const {categories} = summarise(makeToolboxXML(false, false, 'sprite1'));
        expect(blocksOf(categories.looks)).toEqual(
            blocksOf(upstream.categories.looks).filter(type => type !== 'looks_say' && type !== 'looks_sayforsecs')
        );
        expectTidySeps(categories.looks);
        expect(categories.looks[categories.looks.length - 1]).toBe('sep');
    });

    test('an extension category left with only a button is removed', () => {
        setBlockVisibility({schemaVersion: 1, categories: {pen: {onlyBlocks: []}}});
        const {ids} = summarise(spriteToolbox());
        expect(ids).not.toContain('pen');
        expect(ids).toContain('motion');
    });

    test('dynamic categories are kept even though they have no blocks in the XML', () => {
        setBlockVisibility({schemaVersion: 1, defaultCategory: 'hide', categories: {variables: {}, myBlocks: {}}});
        expect(summarise(spriteToolbox()).ids).toEqual(['variables', 'myBlocks']);
    });

    test('if every category would be emptied, configured categories stay as empty headers', () => {
        // Looks for the Stage has no "say" block.
        setBlockVisibility({schemaVersion: 1, defaultCategory: 'hide', categories: {
            looks: {onlyBlocks: ['looks_sayforsecs']}
        }});
        const {ids, categories} = summarise(stageToolbox());
        expect(ids).toEqual(['looks']);
        expect(blocksOf(categories.looks)).toEqual([]);
    });

    test('if no category at all is left, show everything and warn', () => {
        // Only Pen is allowed, but Pen is not loaded.
        const rules = normalizeConfig({schemaVersion: 1, defaultCategory: 'hide', categories: {pen: {}}});
        const xml = makeToolboxXML(false, false, 'sprite1');
        expect(filterToolboxXML(xml, rules, 1)).toBe(xml);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    test('the revision is stamped on the root, so the string changes with the config', () => {
        setBlockVisibility(sampleB);
        const first = spriteToolbox();
        setBlockVisibility(sampleB);
        const second = spriteToolbox();
        expect(first).not.toBe(second);
        expect(summarise(second).root.getAttribute('codkid-rev')).toMatch(/^\d+$/);
    });

    test('lesson: only the chosen teacher blocks; the category stays even when others are hidden', () => {
        const rules = normalizeConfig({schemaVersion: 1, defaultCategory: 'hide', categories: {
            events: {},
            lesson: {onlyBlocks: ['walk', 'addScore']}
        }});
        const xml = makeToolboxXML(false, false, 'sprite1', [penCategory, lessonCategory], 'costume1', 'backdrop1', 'pop');
        const {ids, categories} = summarise(filterToolboxXML(xml, rules, 1));
        expect(ids).toEqual(['events', 'codkidLesson']);
        expect(blocksOf(categories.codkidLesson)).toEqual(['codkidLesson_walk_v2', 'codkidLesson_addScore_v1']);
    });

    test('lesson: with no lesson rule, every teacher block is shown', () => {
        const xml = makeToolboxXML(false, false, 'sprite1', [lessonCategory], 'costume1', 'backdrop1', 'pop');
        const {categories} = summarise(filterToolboxXML(xml, normalizeConfig(sampleA), 1));
        expect(blocksOf(categories.codkidLesson)).toHaveLength(3);
    });

    test('malformed XML is returned unchanged', () => {
        const rules = normalizeConfig(sampleA);
        const bad = '<xml><category id="motion"><block type="motion_movesteps"></category>';
        expect(filterToolboxXML(bad, rules, 1)).toBe(bad);
    });
});
