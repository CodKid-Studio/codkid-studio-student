import {normalizeConfig} from './normalize-config';

/**
 * A small module store for the block visibility config of the open lesson.
 *
 * It lives outside Redux on purpose: `lib/make-toolbox-xml.js` builds the toolbox XML in places
 * that have no access to the store (e.g. the toolbox reducer's initial state), and this keeps
 * the changes to upstream files minimal.
 */

const state = {
    rules: null,
    revision: 0,
    listeners: []
};

/**
 * Set the block visibility config for the open lesson. The future API client calls this when a
 * lesson opens, and calls it with null when the lesson closes.
 * @param {*} json - the config, as parsed JSON, or null to show every block (upstream behaviour).
 * @returns {boolean} whether the config was valid (null always counts as valid).
 */
const setBlockVisibility = json => {
    const rules = normalizeConfig(json);
    state.rules = rules;
    state.revision++;
    state.listeners.slice().forEach(listener => listener(rules));
    return json === null || typeof json === 'undefined' || rules !== null;
};

/**
 * @returns {?object} the normalized rules (see normalize-config.js), or null when nothing is hidden.
 */
const getBlockVisibility = () => state.rules;

/**
 * @returns {number} a counter that changes every time the config is set.
 */
const getBlockVisibilityRevision = () => state.revision;

/**
 * Listen for config changes.
 * @param {function} listener - called with the new rules (or null) after every change.
 * @returns {function} call it to stop listening.
 */
const subscribeBlockVisibility = listener => {
    state.listeners.push(listener);
    return () => {
        const index = state.listeners.indexOf(listener);
        if (index >= 0) state.listeners.splice(index, 1);
    };
};

export {
    getBlockVisibility,
    getBlockVisibilityRevision,
    setBlockVisibility,
    subscribeBlockVisibility
};
