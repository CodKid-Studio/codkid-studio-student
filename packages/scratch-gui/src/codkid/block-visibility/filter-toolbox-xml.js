import log from '../../lib/log';
import {getBlockVisibility, getBlockVisibilityRevision} from './config-store';
import {getCategoryRule, isBlockVisible, isCategoryVisible} from './normalize-config';

/**
 * Attribute stamped on the root <xml> element. It makes the toolbox XML string change whenever the
 * config changes, even when only the dynamic (Variables / My Blocks) rules changed, so that
 * containers/blocks.jsx re-renders the toolbox. scratch-blocks ignores attributes on the root.
 */
const REVISION_ATTRIBUTE = 'codkid-rev';

const elementChildren = node => Array.prototype.filter.call(node.childNodes, child => child.nodeType === 1);

const hasTag = (element, tagName) => element.tagName.toLowerCase() === tagName;

const parseXml = xml => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length > 0) return null;
    return doc;
};

const serializeXml = element => {
    if (typeof XMLSerializer === 'function') return new XMLSerializer().serializeToString(element);
    return element.outerHTML; // jsdom 9 (jest) has no XMLSerializer
};

/**
 * Remove <sep> elements that no longer separate anything: leading ones, runs of more than one,
 * and trailing ones. If the parent originally ended with a <sep>, keep exactly one at the end:
 * core categories end with a <sep> that sets the gap before the next category.
 * @param {Element} parent - a <category> or the root <xml> element.
 * @param {?Element} trailingSep - the original trailing <sep> to keep, or null.
 */
const tidySeparators = (parent, trailingSep) => {
    let seenContent = false;
    let previousWasSep = false;
    elementChildren(parent).forEach(child => {
        if (!hasTag(child, 'sep')) {
            seenContent = true;
            previousWasSep = false;
        } else if (!seenContent || previousWasSep) {
            parent.removeChild(child);
        } else {
            previousWasSep = true;
        }
    });
    const remaining = elementChildren(parent);
    while (remaining.length > 0 && hasTag(remaining[remaining.length - 1], 'sep')) {
        parent.removeChild(remaining.pop());
    }
    if (trailingSep && remaining.length > 0) parent.appendChild(trailingSep);
};

/**
 * Remove hidden blocks from one category. Only <block> elements that are direct children are
 * removed; shadows inside a block are never touched.
 * @param {Element} category - the <category> element.
 * @param {?object} categoryRule - the rule for this category, or null when it is not listed.
 * @returns {{hadBlocks: boolean, hasBlocks: boolean}} block counts before and after.
 */
const filterCategoryBlocks = (category, categoryRule) => {
    const children = elementChildren(category);
    const blocks = children.filter(child => hasTag(child, 'block'));
    const hadBlocks = blocks.length > 0;
    const hidden = blocks.filter(block => !isBlockVisible(categoryRule, block.getAttribute('type')));
    if (hidden.length === 0) return {hadBlocks, hasBlocks: hadBlocks};

    const last = children[children.length - 1];
    const trailingSep = hasTag(last, 'sep') ? last : null;
    hidden.forEach(block => category.removeChild(block));
    tidySeparators(category, trailingSep);
    return {hadBlocks, hasBlocks: blocks.length > hidden.length};
};

/**
 * @param {Document} doc - the parsed toolbox XML; changed in place.
 * @param {object} rules - normalized rules.
 * @param {boolean} removeEmptied - whether to remove categories that lost all their blocks.
 * @returns {number} how many categories are left.
 */
const applyRules = (doc, rules, removeEmptied) => {
    const root = doc.documentElement;
    let removedCategory = false;
    let remaining = 0;
    elementChildren(root)
        .filter(child => hasTag(child, 'category'))
        .forEach(category => {
            const id = category.getAttribute('id');
            if (!isCategoryVisible(rules, id)) {
                root.removeChild(category);
                removedCategory = true;
                return;
            }
            const result = filterCategoryBlocks(category, getCategoryRule(rules, id));
            // A category that had no blocks to begin with (a dynamic category, or Motion when the
            // Stage is selected) is kept as upstream shows it.
            if (removeEmptied && result.hadBlocks && !result.hasBlocks) {
                root.removeChild(category);
                removedCategory = true;
                return;
            }
            remaining++;
        });
    if (removedCategory) tidySeparators(root, null);
    return remaining;
};

/**
 * Filter toolbox XML with the given rules.
 * @param {string} xml - toolbox XML as built by lib/make-toolbox-xml.js.
 * @param {?object} rules - normalized rules, or null for "show everything".
 * @param {number} revision - stamped on the root element so the string changes with the config.
 * @returns {string} the filtered XML. On any problem, the input is returned unchanged.
 */
const filterToolboxXML = (xml, rules, revision) => {
    if (!rules) return xml;
    try {
        let doc = parseXml(xml);
        if (!doc) return xml;
        if (applyRules(doc, rules, true) === 0) {
            // scratch-blocks throws when a toolbox with categories is replaced by one without.
            // Keep the configured categories as empty headers instead of showing everything.
            doc = parseXml(xml);
            if (applyRules(doc, rules, false) === 0) {
                log.warn('CodKid block visibility: the config hides every category; showing all blocks');
                return xml;
            }
        }
        doc.documentElement.setAttribute(REVISION_ATTRIBUTE, String(revision));
        return serializeXml(doc.documentElement);
    } catch (error) {
        log.warn(`CodKid block visibility: could not filter the toolbox (${error.message}); showing all blocks`);
        return xml;
    }
};

/**
 * Hook for lib/make-toolbox-xml.js: filter the toolbox XML with the current lesson's config.
 * With no config, the input string is returned as is, without parsing it.
 * @param {string} xml - toolbox XML as built by lib/make-toolbox-xml.js.
 * @returns {string} the filtered XML.
 */
const applyBlockVisibility = xml => {
    const rules = getBlockVisibility();
    if (!rules) return xml;
    return filterToolboxXML(xml, rules, getBlockVisibilityRevision());
};

export {
    applyBlockVisibility,
    filterToolboxXML
};
