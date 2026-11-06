import '@fontsource-variable/inter/wght.css';
import './stil.css';
import { createApp } from 'vue';
import App from './App.vue';
import { erstelleRouter } from './router.js';

createApp(App).use(erstelleRouter()).mount('#app');
