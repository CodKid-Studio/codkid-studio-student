import queryString from 'query-string';

import {createSampleSource, loadTeacherBlocks, setTeacherBlockSource} from './definition-source';

/**
 * DEV BUILDS ONLY: load sample teacher block definitions, for testing until the lesson API exists.
 *
 *   ?codkidTeacherBlocksSample=<name of a file in ./samples, without .json>
 *
 * playground/render-gui.jsx imports this module.
 */

/**
 * @param {string} search - the URL query string, e.g. window.location.search.
 * @param {object.<string, object>} samples - sample definitions envelopes by name.
 * @returns {?Promise.<boolean>} the load, or null when the URL asks for no sample.
 */
const loadTeacherBlocksFromUrl = (search, samples) => {
    let name = queryString.parse(search).codkidTeacherBlocksSample;
    // A repeated parameter comes back as a list: use the first one.
    if (Array.isArray(name)) name = name[0];
    if (typeof name !== 'string') return null;
    setTeacherBlockSource(createSampleSource(samples));
    return loadTeacherBlocks({lessonId: name});
};

// Keep the requires inside this `if`: webpack drops the whole branch, samples included, from
// production builds.
if (process.env.NODE_ENV !== 'production') {
    if (typeof window === 'object' && window.location) {
        loadTeacherBlocksFromUrl(window.location.search, {
            'lesson-sample': require('./samples/lesson-sample.json')
        });
    }
}

export {loadTeacherBlocksFromUrl};
