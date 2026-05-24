import { registerRootComponent } from 'expo';
import { Platform, AppRegistry } from 'react-native';
import App from './App';

// SECURITY & PERFORMANCE HARDENING
// Strip all console logs in production to prevent JS thread bottlenecking 
// and to ensure no sensitive medical data leaks to device logs (logcat/syslog).
if (!__DEV__) {
    const noOp = () => {};
    console.log = noOp;
    console.warn = noOp;
    console.info = noOp;
    // We optionally keep console.error for Sentry boundaries, but override the others.
    // Error tracking should be handled exclusively by Sentry in production.
}

if (Platform.OS === 'web') {
    let root = document.getElementById('root') || document.getElementById('main');
    if (!root) {
        root = document.createElement('div');
        root.id = 'root';
        document.body.appendChild(root);
    }
    AppRegistry.registerComponent('main', () => App);
    AppRegistry.runApplication('main', {
        initialProps: {},
        rootTag: root,
    });
} else {
    registerRootComponent(App);
}
