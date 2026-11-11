/**
 * CodKid teacher blocks: a small store for the teacher block definitions of the open lesson.
 *
 * It lives outside Redux, like the block visibility config store: the definitions only need to
 * reach the VM (connect-vm.js), and this keeps the changes to upstream files minimal.
 * The store keeps the JSON as received; the VM validates it.
 */

const state = {
    definitions: null,
    listeners: []
};

/**
 * @param {*} json - the definitions envelope (docs/teacher-block-schema.md), or null for none.
 */
const setTeacherBlockDefinitions = json => {
    state.definitions = typeof json === 'undefined' ? null : json;
    state.listeners.slice().forEach(listener => listener(state.definitions));
};

/**
 * @returns {*} the definitions envelope, or null.
 */
const getTeacherBlockDefinitions = () => state.definitions;

/**
 * Listen for changes.
 * @param {function} listener - called with the new definitions (or null) after every change.
 * @returns {function} call it to stop listening.
 */
const subscribeTeacherBlockDefinitions = listener => {
    state.listeners.push(listener);
    return () => {
        const index = state.listeners.indexOf(listener);
        if (index >= 0) state.listeners.splice(index, 1);
    };
};

export {
    getTeacherBlockDefinitions,
    setTeacherBlockDefinitions,
    subscribeTeacherBlockDefinitions
};
