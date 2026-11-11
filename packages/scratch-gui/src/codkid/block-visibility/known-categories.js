/**
 * Category ids that a block visibility config may use.
 *
 * Toolbox ids come from `lib/make-toolbox-xml.js` (`<category id="...">`) and, for extensions,
 * from `vm.runtime.getBlocksXML()`, which uses the extension id.
 * This list is hard-coded on purpose: importing the extension library here would pull React
 * components into the toolbox reducer's dependency chain.
 * A unit test checks that EXTENSION_CATEGORY_IDS matches `lib/libraries/extensions/index.jsx`.
 */

const CORE_CATEGORY_IDS = [
    'motion',
    'looks',
    'sound',
    'events',
    'control',
    'sensing',
    'operators',
    'variables',
    'myBlocks'
];

const EXTENSION_CATEGORY_IDS = [
    'music',
    'pen',
    'videoSensing',
    'text2speech',
    'translate',
    'makeymakey',
    'microbit',
    'gdxfor',
    'ev3',
    'boost',
    'wedo2'
];

/**
 * Reserved for S-03 (teacher blocks). Always shown, whatever the config says.
 */
const LESSON_CATEGORY_ID = 'lesson';

/**
 * Other names that may be used in a config. The VM uses these ids for the same categories.
 */
const CATEGORY_ID_ALIASES = {
    event: 'events',
    data: 'variables',
    procedures: 'myBlocks'
};

/**
 * Dynamic categories are filled by scratch-blocks at runtime (`custom="VARIABLE"` / `custom="PROCEDURE"`).
 * Key: the scratch-blocks callback key. Value: the toolbox category id.
 */
const DYNAMIC_CATEGORY_KEYS = {
    VARIABLE: 'variables',
    PROCEDURE: 'myBlocks'
};

/**
 * Button callback keys that `hideButtons` may list, per dynamic category.
 */
const DYNAMIC_CATEGORY_BUTTONS = {
    variables: ['CREATE_VARIABLE', 'CREATE_LIST'],
    myBlocks: ['CREATE_PROCEDURE']
};

const KNOWN_CATEGORY_IDS = CORE_CATEGORY_IDS.concat(EXTENSION_CATEGORY_IDS, [LESSON_CATEGORY_ID]);

/**
 * Resolve a config category id to the toolbox category id.
 * @param {string} id - the id written in the config or found in the toolbox XML.
 * @returns {string} the toolbox category id.
 */
const resolveCategoryId = id => (
    Object.prototype.hasOwnProperty.call(CATEGORY_ID_ALIASES, id) ? CATEGORY_ID_ALIASES[id] : id
);

export {
    CATEGORY_ID_ALIASES,
    CORE_CATEGORY_IDS,
    DYNAMIC_CATEGORY_BUTTONS,
    DYNAMIC_CATEGORY_KEYS,
    EXTENSION_CATEGORY_IDS,
    KNOWN_CATEGORY_IDS,
    LESSON_CATEGORY_ID,
    resolveCategoryId
};
