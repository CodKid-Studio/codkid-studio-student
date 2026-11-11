import log from '../../lib/log';
import {teacherBlockIdOf} from '../teacher-blocks/opcode';
import {
    CORE_CATEGORY_IDS,
    DYNAMIC_CATEGORY_BUTTONS,
    KNOWN_CATEGORY_IDS,
    LESSON_CATEGORY_ID,
    resolveCategoryId
} from './known-categories';

const SCHEMA_VERSION = 1;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const isStringArray = value => (
    Array.isArray(value) && value.every(item => typeof item === 'string')
);

/**
 * Thrown inside normalizeConfig for a config that must be rejected as a whole.
 * @param {string} message - why the config is invalid.
 */
const InvalidConfigError = function (message) {
    this.message = message;
};

const invalid = message => {
    throw new InvalidConfigError(message);
};

const normalizeCategory = (id, entry) => {
    if (!isPlainObject(entry)) invalid(`category "${id}" must be an object`);
    if (hasOwn(entry, 'show') && typeof entry.show !== 'boolean') {
        invalid(`category "${id}": "show" must be true or false`);
    }
    ['onlyBlocks', 'hideBlocks', 'hideButtons'].forEach(key => {
        if (hasOwn(entry, key) && !isStringArray(entry[key])) {
            invalid(`category "${id}": "${key}" must be a list of strings`);
        }
    });

    let hideButtons = [];
    if (entry.hideButtons) {
        const allowedButtons = DYNAMIC_CATEGORY_BUTTONS[id] || [];
        hideButtons = entry.hideButtons.filter(button => {
            if (allowedButtons.indexOf(button) >= 0) return true;
            log.warn(`CodKid block visibility: ignoring unknown button "${button}" in category "${id}"`);
            return false;
        });
    }

    return {
        show: hasOwn(entry, 'show') ? entry.show : true,
        onlyBlocks: entry.onlyBlocks ? new Set(entry.onlyBlocks) : null,
        hideBlocks: new Set(entry.hideBlocks || []),
        hideButtons: new Set(hideButtons)
    };
};

/**
 * The Lesson category (teacher blocks) is always shown. Only its blocks can be chosen, by teacher
 * block id without the version (e.g. "walk"), so a config keeps working when a teacher block gets
 * a new version.
 * @param {*} entry - the config entry for "lesson".
 * @returns {CategoryRule} the rule.
 */
const normalizeLessonCategory = entry => {
    const id = LESSON_CATEGORY_ID;
    if (!isPlainObject(entry)) invalid(`category "${id}" must be an object`);
    ['show', 'hideButtons'].forEach(key => {
        if (hasOwn(entry, key)) {
            log.warn(`CodKid block visibility: ignoring "${key}" in category "${id}"; it is always shown`);
        }
    });
    ['onlyBlocks', 'hideBlocks'].forEach(key => {
        if (hasOwn(entry, key) && !isStringArray(entry[key])) {
            invalid(`category "${id}": "${key}" must be a list of teacher block ids`);
        }
    });
    return {
        show: true,
        onlyBlocks: entry.onlyBlocks ? new Set(entry.onlyBlocks) : null,
        hideBlocks: new Set(entry.hideBlocks || []),
        hideButtons: new Set(),
        blockKey: blockType => teacherBlockIdOf(blockType) || blockType
    };
};

/**
 * @typedef {object} CategoryRule
 * @property {boolean} show - whether the category is shown.
 * @property {?Set.<string>} onlyBlocks - if set, only these block types are shown (wins over hideBlocks).
 * @property {Set.<string>} hideBlocks - block types to hide.
 * @property {Set.<string>} hideButtons - flyout button callback keys to hide (dynamic categories only).
 * @property {function(string): string=} blockKey - turns a block type into the name the config
 *   uses (Lesson category only: the teacher block id).
 */

/**
 * @typedef {object} BlockVisibilityRules
 * @property {boolean} defaultShow - whether categories that are not listed are shown.
 * @property {boolean} allowExtensionLibrary - whether the "Add Extension" button may be shown.
 * @property {object.<string, CategoryRule>} categories - rules keyed by toolbox category id.
 */

/**
 * Validate a block visibility config and turn it into rules.
 * Any problem with the overall shape makes the whole config invalid: it returns null, which means
 * "show everything", the same as upstream.
 * @param {*} json - the config, as parsed JSON. null or undefined means "no config".
 * @returns {?BlockVisibilityRules} the rules, or null when there is no config or it is invalid.
 */
const normalizeConfig = json => {
    if (json === null || typeof json === 'undefined') return null;
    try {
        if (!isPlainObject(json)) invalid('config must be an object');
        if (json.schemaVersion !== SCHEMA_VERSION) invalid(`"schemaVersion" must be ${SCHEMA_VERSION}`);

        const defaultCategory = hasOwn(json, 'defaultCategory') ? json.defaultCategory : 'show';
        if (defaultCategory !== 'show' && defaultCategory !== 'hide') {
            invalid('"defaultCategory" must be "show" or "hide"');
        }
        if (hasOwn(json, 'allowExtensionLibrary') && typeof json.allowExtensionLibrary !== 'boolean') {
            invalid('"allowExtensionLibrary" must be true or false');
        }
        if (hasOwn(json, 'categories') && !isPlainObject(json.categories)) invalid('"categories" must be an object');

        const categories = {};
        const rawCategories = json.categories || {};
        Object.keys(rawCategories).forEach(rawId => {
            const id = resolveCategoryId(rawId);
            if (KNOWN_CATEGORY_IDS.indexOf(id) < 0) {
                log.warn(`CodKid block visibility: ignoring unknown category "${rawId}"`);
                return;
            }
            if (hasOwn(categories, id)) {
                log.warn(`CodKid block visibility: category "${rawId}" is listed twice; using the last one`);
            }
            categories[id] = id === LESSON_CATEGORY_ID ?
                normalizeLessonCategory(rawCategories[rawId]) :
                normalizeCategory(id, rawCategories[rawId]);
        });

        const rules = {
            defaultShow: defaultCategory === 'show',
            allowExtensionLibrary: hasOwn(json, 'allowExtensionLibrary') ? json.allowExtensionLibrary : true,
            categories
        };

        // A config that can never show any category is a mistake: show everything instead.
        const anyCoreVisible = CORE_CATEGORY_IDS.some(id => (
            hasOwn(categories, id) ? categories[id].show : rules.defaultShow
        ));
        // The Lesson category alone is not enough: teacher blocks need a hat block to run.
        const anyListedVisible = Object.keys(categories).some(id => id !== LESSON_CATEGORY_ID && categories[id].show);
        if (!anyCoreVisible && !anyListedVisible) invalid('every category is hidden');

        return rules;
    } catch (error) {
        if (!(error instanceof InvalidConfigError)) throw error;
        log.warn(`CodKid block visibility: invalid config (${error.message}); showing all blocks`);
        return null;
    }
};

/**
 * @param {?BlockVisibilityRules} rules - normalized rules, or null for "no config".
 * @param {string} categoryId - a toolbox category id (aliases are resolved).
 * @returns {boolean} whether the category is shown.
 */
const isCategoryVisible = (rules, categoryId) => {
    if (!rules) return true;
    const id = resolveCategoryId(categoryId);
    if (id === LESSON_CATEGORY_ID) return true;
    if (hasOwn(rules.categories, id)) return rules.categories[id].show;
    return rules.defaultShow;
};

/**
 * @param {?BlockVisibilityRules} rules - normalized rules, or null for "no config".
 * @param {string} categoryId - a toolbox category id (aliases are resolved).
 * @returns {?CategoryRule} the rule for a listed category, or null when the category is not listed.
 */
const getCategoryRule = (rules, categoryId) => {
    if (!rules) return null;
    const id = resolveCategoryId(categoryId);
    return hasOwn(rules.categories, id) ? rules.categories[id] : null;
};

/**
 * @param {?CategoryRule} categoryRule - the rule for the block's category, or null when it is not listed.
 * @param {string} blockType - the block opcode, e.g. "motion_movesteps" or "codkidLesson_walk_v1".
 * @returns {boolean} whether the block is shown in the palette.
 */
const isBlockVisible = (categoryRule, blockType) => {
    if (!categoryRule) return true;
    const key = categoryRule.blockKey ? categoryRule.blockKey(blockType) : blockType;
    if (categoryRule.onlyBlocks) return categoryRule.onlyBlocks.has(key);
    return !categoryRule.hideBlocks.has(key);
};

export {
    getCategoryRule,
    isBlockVisible,
    isCategoryVisible,
    normalizeConfig
};
