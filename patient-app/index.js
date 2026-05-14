import { registerRootComponent } from 'expo';
import { Platform, AppRegistry } from 'react-native';
import App from './App';

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
