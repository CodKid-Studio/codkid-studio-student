import PropTypes from 'prop-types';
import React from 'react';

import extensionLibraryContent from '../../lib/libraries/extensions/index.jsx';
import {subscribeBlockVisibility} from './config-store';
import {isExtensionButtonVisible} from './extension-library';

/**
 * Renders its children (the "Add Extension" button) only when the lesson's block visibility
 * config allows it. Re-renders when the config changes.
 */
class ExtensionButtonGate extends React.Component {
    constructor (props) {
        super(props);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.state = {visible: isExtensionButtonVisible(extensionLibraryContent)};
    }
    componentDidMount () {
        this.unsubscribe = subscribeBlockVisibility(this.handleVisibilityChange);
        // The config may have changed between the constructor and mount.
        this.handleVisibilityChange();
    }
    componentWillUnmount () {
        this.unsubscribe();
    }
    handleVisibilityChange () {
        const visible = isExtensionButtonVisible(extensionLibraryContent);
        if (visible !== this.state.visible) this.setState({visible});
    }
    render () {
        return this.state.visible ? this.props.children : null;
    }
}

ExtensionButtonGate.propTypes = {
    children: PropTypes.node
};

export default ExtensionButtonGate;
