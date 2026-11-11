import React from 'react';
import {mount} from 'enzyme';

import extensionLibraryContent from '../../../src/lib/libraries/extensions/index.jsx';
import ExtensionButtonGate from '../../../src/codkid/block-visibility/extension-button-gate.jsx';
import {setBlockVisibility} from '../../../src/codkid/block-visibility/config-store';
import {
    filterExtensionLibrary,
    isExtensionButtonVisible
} from '../../../src/codkid/block-visibility/extension-library';

import sampleA from '../../../src/codkid/block-visibility/samples/lesson-a-motion-basics.json';
import sampleB from '../../../src/codkid/block-visibility/samples/lesson-b-no-sound.json';

const ids = items => items.map(item => item.extensionId);

describe('CodKid block visibility: extension library', () => {
    afterEach(() => {
        setBlockVisibility(null);
    });

    test('no config: the full list and the button, as upstream', () => {
        expect(filterExtensionLibrary(extensionLibraryContent)).toBe(extensionLibraryContent);
        expect(isExtensionButtonVisible(extensionLibraryContent)).toBe(true);
    });

    test('the list shows only extensions whose category is shown', () => {
        setBlockVisibility({schemaVersion: 1, categories: {pen: {show: false}, music: {show: false}}});
        const list = ids(filterExtensionLibrary(extensionLibraryContent));
        expect(list).not.toContain('pen');
        expect(list).not.toContain('music');
        expect(list).toContain('microbit');
        expect(isExtensionButtonVisible(extensionLibraryContent)).toBe(true);
    });

    test('allowlist with one extension', () => {
        setBlockVisibility({schemaVersion: 1, defaultCategory: 'hide', categories: {motion: {}, pen: {}}});
        expect(ids(filterExtensionLibrary(extensionLibraryContent))).toEqual(['pen']);
        expect(isExtensionButtonVisible(extensionLibraryContent)).toBe(true);
    });

    test('sample (a): no extension is visible, so the button is hidden', () => {
        setBlockVisibility(sampleA);
        expect(filterExtensionLibrary(extensionLibraryContent)).toEqual([]);
        expect(isExtensionButtonVisible(extensionLibraryContent)).toBe(false);
    });

    test('sample (b): allowExtensionLibrary false hides the button', () => {
        setBlockVisibility(sampleB);
        expect(filterExtensionLibrary(extensionLibraryContent).length).toBe(extensionLibraryContent.length);
        expect(isExtensionButtonVisible(extensionLibraryContent)).toBe(false);
    });

    test('the button gate follows config changes', () => {
        const wrapper = mount(
            <ExtensionButtonGate>
                <button className="add-extension" />
            </ExtensionButtonGate>
        );
        expect(wrapper.find('.add-extension').length).toBe(1);
        setBlockVisibility(sampleB);
        wrapper.update();
        expect(wrapper.find('.add-extension').length).toBe(0);
        setBlockVisibility(null);
        wrapper.update();
        expect(wrapper.find('.add-extension').length).toBe(1);
        wrapper.unmount();
    });
});
