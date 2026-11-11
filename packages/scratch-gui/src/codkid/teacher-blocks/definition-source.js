/**
 * CodKid teacher blocks: the one place where teacher block definitions come in.
 *
 * A source is an object with `fetchDefinitions({lessonId})`, which returns a Promise for the
 * definitions envelope (docs/teacher-block-schema.md). Today the only source is the bundled
 * sample JSON (dev builds). The lesson API client will provide another source and install it
 * with setTeacherBlockSource; nothing else has to change.
 */
import log from '../../lib/log';
import {setTeacherBlockDefinitions} from './definition-store';

/**
 * @typedef {object} TeacherBlockSource
 * @property {function({lessonId: string}): Promise.<object>} fetchDefinitions - get the definitions
 *   envelope of a lesson.
 */

/**
 * A source that serves bundled JSON files. The lesson id is the sample name.
 * @param {object.<string, object>} samples - definitions envelopes by name.
 * @returns {TeacherBlockSource} the source.
 */
const createSampleSource = samples => ({
    fetchDefinitions: ({lessonId}) => {
        if (!Object.prototype.hasOwnProperty.call(samples, lessonId)) {
            return Promise.reject(new Error(`unknown sample "${lessonId}"`));
        }
        return Promise.resolve(samples[lessonId]);
    }
});

let currentSource = null;

/**
 * @param {?TeacherBlockSource} source - where definitions come from, or null for nowhere.
 */
const setTeacherBlockSource = source => {
    currentSource = source;
};

/**
 * @returns {?TeacherBlockSource} the current source.
 */
const getTeacherBlockSource = () => currentSource;

/**
 * Load the teacher block definitions of a lesson from the current source and hand them to the VM
 * (through the definition store). On failure, the lesson has no teacher blocks; projects that use
 * teacher blocks still run, because they contain the definitions.
 * @param {{lessonId: string}} params - which lesson.
 * @returns {Promise.<boolean>} whether definitions were loaded.
 */
const loadTeacherBlocks = params => {
    if (!currentSource) {
        log.warn('CodKid teacher blocks: no definition source');
        return Promise.resolve(false);
    }
    return Promise.resolve()
        .then(() => currentSource.fetchDefinitions(params))
        .then(json => {
            setTeacherBlockDefinitions(json);
            return true;
        })
        .catch(error => {
            log.warn(`CodKid teacher blocks: could not load definitions (${error.message})`);
            setTeacherBlockDefinitions(null);
            return false;
        });
};

/**
 * Remove the teacher blocks of the closed lesson from the palette.
 */
const unloadTeacherBlocks = () => {
    setTeacherBlockDefinitions(null);
};

export {
    createSampleSource,
    getTeacherBlockSource,
    loadTeacherBlocks,
    setTeacherBlockSource,
    unloadTeacherBlocks
};
