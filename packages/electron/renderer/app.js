import { AppController } from './components/app-controller.js';

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new AppController();
    app.initialize();

    console.log('Software Manager initialized');
});
