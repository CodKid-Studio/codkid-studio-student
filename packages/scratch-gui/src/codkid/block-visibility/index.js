/**
 * CodKid: per-lesson block visibility (spec S-02, issue #1).
 *
 * The lesson loader (future API client) calls `setBlockVisibility(config)` when a lesson opens and
 * `setBlockVisibility(null)` when it closes. See samples/ for the config format.
 *
 * Hook points in upstream files (marked `// CodKid:`):
 * - lib/make-toolbox-xml.js: filters the toolbox XML (applyBlockVisibility).
 * - containers/blocks.jsx: filters Variables / My Blocks and refreshes the toolbox on change.
 * - containers/extension-library.jsx: filters the extension list.
 * - components/gui/gui.jsx: hides the "Add Extension" button.
 * - playground/render-gui.jsx: dev-only URL loader.
 */
export {
    getBlockVisibility,
    getBlockVisibilityRevision,
    setBlockVisibility,
    subscribeBlockVisibility
} from './config-store';
export {applyBlockVisibility, filterToolboxXML} from './filter-toolbox-xml';
export {filterDynamicXmlList, installDynamicCategoryFilter} from './dynamic-categories';
export {filterExtensionLibrary, isExtensionButtonVisible} from './extension-library';
export {normalizeConfig} from './normalize-config';
