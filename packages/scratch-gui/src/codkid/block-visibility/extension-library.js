import {getBlockVisibility} from './config-store';
import {isCategoryVisible} from './normalize-config';

/**
 * Keep only the extensions whose toolbox category the lesson shows.
 * Choosing a hidden extension would load it without showing any blocks, so it is left out.
 * @param {Array.<object>} items - extension library items (lib/libraries/extensions/index.jsx).
 * @param {?object} rules - normalized rules; defaults to the current config.
 * @returns {Array.<object>} the items to show.
 */
const filterExtensionLibrary = (items, rules = getBlockVisibility()) => {
    if (!rules) return items;
    return items.filter(item => !!item.extensionId && isCategoryVisible(rules, item.extensionId));
};

/**
 * Whether to show the "Add Extension" button. It is hidden when the config sets
 * `allowExtensionLibrary: false`, or when no extension in the library is visible.
 * @param {Array.<object>} items - extension library items (lib/libraries/extensions/index.jsx).
 * @param {?object} rules - normalized rules; defaults to the current config.
 * @returns {boolean} true to show the button.
 */
const isExtensionButtonVisible = (items, rules = getBlockVisibility()) => {
    if (!rules) return true;
    if (!rules.allowExtensionLibrary) return false;
    return filterExtensionLibrary(items, rules).length > 0;
};

export {
    filterExtensionLibrary,
    isExtensionButtonVisible
};
