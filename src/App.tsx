/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Since we are using a vanilla JS dashboard in index.html,
    // and Vite serves index.html as the entry point, 
    // this React component is actually mounted into the #root div.
    // We can use this to handle any React-specific logic if we wanted,
    // but the user requested a vanilla JS app.
    console.log('Site Monitor Dashboard initialized');
  }, []);

  return null; // The vanilla JS in app.js handles the UI injection into the DOM
}
