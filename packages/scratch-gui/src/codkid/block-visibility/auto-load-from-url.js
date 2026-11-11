import queryString from 'query-string';

import log from '../../lib/log';
import {setBlockVisibility} from './config-store';

/**
 * DEV BUILDS ONLY: set the block visibility config from the page URL, for testing until the lesson
 * API exists.
 *
 *   ?codkidBlocks=<JSON, encoded with encodeURIComponent>
 *   ?codkidBlocksSample=<name of a file in ./samples, without .json>
 *
 * `+` in a query string means a space, so the JSON must be encoded with encodeURIComponent.
 *
 * playground/render-gui.jsx imports this module first, so the config is set before
 * reducers/toolbox.js builds the initial toolbox.
 */

/**
 * @param {string} search - the URL query string, e.g. window.location.search.
 * @param {object.<string, object>} samples - sample configs by name.
 * @returns {boolean} whether a config was set.
 */
const loadBlockVisibilityFromUrl = (search, samples) => {
    const params = queryString.parse(search);
    // A repeated parameter comes back as a list: use the first one.
    const getParam = name => {
        const value = params[name];
        if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
        return typeof value === 'string' ? value : null;
    };
    const inline = getParam('codkidBlocks');
    if (inline !== null) {
        let json;
        try {
            json = JSON.parse(inline);
        } catch (error) {
            log.warn(`CodKid block visibility: "codkidBlocks" is not valid JSON (${error.message}); ` +
                'showing all blocks');
            return false;
        }
        return setBlockVisibility(json);
    }
    const sampleName = getParam('codkidBlocksSample');
    if (sampleName !== null) {
        if (!Object.prototype.hasOwnProperty.call(samples, sampleName)) {
            log.warn(`CodKid block visibility: unknown sample "${sampleName}"; showing all blocks`);
            return false;
        }
        return setBlockVisibility(samples[sampleName]);
    }
    return false;
};

// Keep the requires inside this `if`: webpack drops the whole branch, samples included, from
// production builds.
if (process.env.NODE_ENV !== 'production') {
    if (typeof window === 'object' && window.location) {
        loadBlockVisibilityFromUrl(window.location.search, {
            'lesson-a-motion-basics': require('./samples/lesson-a-motion-basics.json'),
            'lesson-b-no-sound': require('./samples/lesson-b-no-sound.json')
        });
    }
}

export {loadBlockVisibilityFromUrl};
