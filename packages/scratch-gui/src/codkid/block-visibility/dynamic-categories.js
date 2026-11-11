import {getBlockVisibility} from './config-store';
import {DYNAMIC_CATEGORY_KEYS} from './known-categories';
import {getCategoryRule, isBlockVisible} from './normalize-config';

/**
 * Variables and My Blocks are "dynamic" categories: their toolbox XML is empty
 * (`custom="VARIABLE"` / `custom="PROCEDURE"`), and scratch-blocks builds their contents each time the
 * flyout shows them. It does this in `Flyout.prototype.show`, by calling
 * `flyout.targetWorkspace.getToolboxCategoryCallback(key)(targetWorkspace)`.
 * So we filter those contents by wrapping `getToolboxCategoryCallback` on the main workspace.
 *
 * test/unit/codkid/block-visibility-dynamic-categories.test.js checks these assumptions against the
 * installed scratch-blocks and cat-blocks, so an update that breaks them fails loudly.
 */

const FALLBACK_SEP_GAP = '36';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const tagOf = element => ((element && element.tagName) ? element.tagName.toLowerCase() : '');

/**
 * Remove leading, repeated and trailing <sep> elements from a flyout XML list.
 * @param {Array.<Element>} xmlList - the list to tidy.
 * @returns {Array.<Element>} a new, tidy list.
 */
const tidySeparators = xmlList => {
    const tidy = [];
    xmlList.forEach(element => {
        const isSep = tagOf(element) === 'sep';
        if (isSep && (tidy.length === 0 || tagOf(tidy[tidy.length - 1]) === 'sep')) return;
        tidy.push(element);
    });
    while (tidy.length > 0 && tagOf(tidy[tidy.length - 1]) === 'sep') tidy.pop();
    return tidy;
};

/**
 * Filter the XML list that scratch-blocks built for a dynamic category.
 * @param {string} key - the scratch-blocks callback key ("VARIABLE" or "PROCEDURE").
 * @param {Array.<Element>} xmlList - the list built by scratch-blocks.
 * @param {?object} rules - normalized rules, or null for "show everything".
 * @returns {Array.<Element>} the filtered list. Never empty, because scratch-blocks fails on an
 *     empty list when the category is the last one in the toolbox.
 */
const filterDynamicXmlList = (key, xmlList, rules) => {
    if (!rules || !Array.isArray(xmlList) || !hasOwn(DYNAMIC_CATEGORY_KEYS, key)) return xmlList;
    const categoryRule = getCategoryRule(rules, DYNAMIC_CATEGORY_KEYS[key]);
    if (!categoryRule) return xmlList;

    const kept = xmlList.filter(element => {
        const tag = tagOf(element);
        if (tag === 'block') return isBlockVisible(categoryRule, element.getAttribute('type'));
        if (tag === 'button') return !categoryRule.hideButtons.has(element.getAttribute('callbackKey'));
        return true;
    });
    if (kept.length === xmlList.length) return xmlList;

    const tidy = tidySeparators(kept);
    if (tidy.length > 0) return tidy;
    const sep = document.createElement('sep');
    sep.setAttribute('gap', FALLBACK_SEP_GAP);
    return [sep];
};

/**
 * Make one workspace filter its dynamic categories with the current config.
 * Only this workspace instance is changed; the scratch-blocks prototype is not.
 * @param {object} workspace - the main scratch-blocks WorkspaceSvg.
 * @returns {function} call it to undo the change.
 */
const installDynamicCategoryFilter = workspace => {
    const hadOwnMethod = hasOwn(workspace, 'getToolboxCategoryCallback');
    const original = workspace.getToolboxCategoryCallback;
    workspace.getToolboxCategoryCallback = function (key) {
        const callback = original.call(this, key);
        if (typeof callback !== 'function' || !hasOwn(DYNAMIC_CATEGORY_KEYS, key)) return callback;
        return targetWorkspace => filterDynamicXmlList(key, callback(targetWorkspace), getBlockVisibility());
    };
    return () => {
        if (hadOwnMethod) {
            workspace.getToolboxCategoryCallback = original;
        } else {
            delete workspace.getToolboxCategoryCallback;
        }
    };
};

export {
    filterDynamicXmlList,
    installDynamicCategoryFilter
};
