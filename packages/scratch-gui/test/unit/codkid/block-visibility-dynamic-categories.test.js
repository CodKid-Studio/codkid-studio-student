/**
 * Guard for the Variables / My Blocks filter.
 *
 * src/codkid/block-visibility/dynamic-categories.js depends on how scratch-blocks builds dynamic
 * categories. These tests run against the real, installed scratch-blocks and cat-blocks, so a
 * scratch-blocks update that changes this behaviour fails here instead of silently showing hidden
 * blocks.
 */
import ScratchBlocks from 'scratch-blocks';
import CatBlocks from 'cat-blocks';

import {setBlockVisibility} from '../../../src/codkid/block-visibility/config-store';
import {
    filterDynamicXmlList,
    installDynamicCategoryFilter
} from '../../../src/codkid/block-visibility/dynamic-categories';
import {normalizeConfig} from '../../../src/codkid/block-visibility/normalize-config';

const describeItem = element => {
    const tag = element.tagName.toLowerCase();
    if (tag === 'block') return `block:${element.getAttribute('type')}`;
    if (tag === 'button') return `button:${element.getAttribute('callbackKey')}`;
    return tag;
};

/**
 * A minimal main workspace: a WorkspaceSvg instance that only has what the dynamic category
 * callbacks need. A real WorkspaceSvg needs a rendered SVG, which jsdom cannot provide.
 * @param {object} Blocks - scratch-blocks or cat-blocks.
 * @returns {object} the workspace.
 */
const makeWorkspace = Blocks => {
    const workspace = new Blocks.Workspace();
    workspace.registerButtonCallback = () => {};
    workspace.createVariable('score', '', 'var-1');
    workspace.createVariable('items', 'list', 'list-1');
    const svgWorkspace = Object.create(Blocks.WorkspaceSvg.prototype);
    svgWorkspace.toolboxCategoryCallbacks_ = {};
    svgWorkspace.registerToolboxCategoryCallback(Blocks.VARIABLE_CATEGORY_NAME, Blocks.DataCategory);
    svgWorkspace.registerToolboxCategoryCallback(Blocks.PROCEDURE_CATEGORY_NAME, Blocks.Procedures.flyoutCategory);
    return {svgWorkspace, workspace};
};

[['scratch-blocks', ScratchBlocks], ['cat-blocks', CatBlocks]].forEach(([name, Blocks]) => {
    describe(`CodKid block visibility: dynamic categories (${name})`, () => {
        afterEach(() => {
            setBlockVisibility(null);
        });

        test('the flyout builds dynamic categories through targetWorkspace.getToolboxCategoryCallback', () => {
            // If this fails, scratch-blocks no longer calls the method we wrap on the main workspace.
            expect(Blocks.Flyout.prototype.show.toString()).toMatch(/targetWorkspace\.getToolboxCategoryCallback\(/);
            expect(Blocks.WorkspaceSvg.toString()).toMatch(/registerToolboxCategoryCallback/);
            expect(Blocks.VARIABLE_CATEGORY_NAME).toBe('VARIABLE');
            expect(Blocks.PROCEDURE_CATEGORY_NAME).toBe('PROCEDURE');
        });

        test('Variables and My Blocks contents and button keys are as expected', () => {
            const {workspace} = makeWorkspace(Blocks);
            const variables = Blocks.DataCategory(workspace).map(describeItem);
            expect(variables).toContain('button:CREATE_VARIABLE');
            expect(variables).toContain('button:CREATE_LIST');
            ['data_variable', 'data_setvariableto', 'data_changevariableby', 'data_showvariable',
                'data_hidevariable', 'data_listcontents', 'data_addtolist', 'data_showlist']
                .forEach(type => expect(variables).toContain(`block:${type}`));
            expect(Blocks.Procedures.flyoutCategory(workspace).map(describeItem)).toEqual(['button:CREATE_PROCEDURE']);
        });

        test('the installed wrapper filters the real Variables category', () => {
            const {svgWorkspace, workspace} = makeWorkspace(Blocks);
            const uninstall = installDynamicCategoryFilter(svgWorkspace);
            setBlockVisibility({schemaVersion: 1, categories: {variables: {
                onlyBlocks: ['data_variable', 'data_setvariableto', 'data_changevariableby'],
                hideButtons: ['CREATE_LIST']
            }}});

            const items = svgWorkspace.getToolboxCategoryCallback('VARIABLE')(workspace).map(describeItem);
            expect(items).toEqual([
                'button:CREATE_VARIABLE',
                'block:data_variable',
                'block:data_setvariableto',
                'block:data_changevariableby'
            ]);

            // Other keys and unknown keys pass through.
            expect(svgWorkspace.getToolboxCategoryCallback('PROCEDURE')(workspace).map(describeItem))
                .toEqual(['button:CREATE_PROCEDURE']);
            expect(svgWorkspace.getToolboxCategoryCallback('NOPE')).toBeFalsy();

            uninstall();
            expect(Object.prototype.hasOwnProperty.call(svgWorkspace, 'getToolboxCategoryCallback')).toBe(false);
            expect(svgWorkspace.getToolboxCategoryCallback('VARIABLE')).toBe(Blocks.DataCategory);
        });

        test('the wrapper follows config changes and shows everything without a config', () => {
            const {svgWorkspace, workspace} = makeWorkspace(Blocks);
            installDynamicCategoryFilter(svgWorkspace);
            const all = Blocks.DataCategory(workspace).map(describeItem);
            expect(svgWorkspace.getToolboxCategoryCallback('VARIABLE')(workspace).map(describeItem)).toEqual(all);

            setBlockVisibility({schemaVersion: 1, categories: {variables: {hideBlocks: ['data_showvariable']}}});
            expect(svgWorkspace.getToolboxCategoryCallback('VARIABLE')(workspace).map(describeItem))
                .toEqual(all.filter(item => item !== 'block:data_showvariable'));
        });

        test('an emptied list becomes one sep (an empty list breaks the flyout)', () => {
            const {svgWorkspace, workspace} = makeWorkspace(Blocks);
            installDynamicCategoryFilter(svgWorkspace);
            setBlockVisibility({schemaVersion: 1, categories: {myBlocks: {hideButtons: ['CREATE_PROCEDURE']}}});
            const items = svgWorkspace.getToolboxCategoryCallback('PROCEDURE')(workspace);
            expect(items.map(describeItem)).toEqual(['sep']);
            expect(items[0].getAttribute('gap')).toBe('36');
        });
    });
});

describe('CodKid block visibility: filterDynamicXmlList', () => {
    const make = (tag, attributes) => {
        const element = document.createElement(tag);
        Object.keys(attributes || {}).forEach(key => element.setAttribute(key, attributes[key]));
        return element;
    };

    test('tidies seps only when something was removed', () => {
        const list = [
            make('block', {type: 'data_addtolist'}),
            make('sep'),
            make('block', {type: 'data_deleteoflist'}),
            make('sep'),
            make('block', {type: 'data_itemoflist'})
        ];
        const rules = normalizeConfig({schemaVersion: 1, categories: {variables: {hideBlocks: ['data_deleteoflist']}}});
        expect(filterDynamicXmlList('VARIABLE', list, rules).map(describeItem))
            .toEqual(['block:data_addtolist', 'sep', 'block:data_itemoflist']);

        const untouched = normalizeConfig({schemaVersion: 1, categories: {variables: {hideBlocks: ['nope']}}});
        expect(filterDynamicXmlList('VARIABLE', list, untouched)).toBe(list);
        expect(filterDynamicXmlList('VARIABLE', list, null)).toBe(list);
    });

    test('a category that is not listed is not filtered', () => {
        const list = [make('button', {callbackKey: 'CREATE_PROCEDURE'})];
        const rules = normalizeConfig({schemaVersion: 1, categories: {variables: {hideButtons: ['CREATE_LIST']}}});
        expect(filterDynamicXmlList('PROCEDURE', list, rules)).toBe(list);
    });
});
